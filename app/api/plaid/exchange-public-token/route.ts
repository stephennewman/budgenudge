import { NextRequest, NextResponse } from 'next/server';
import { plaidClient, handlePlaidError } from '@/utils/plaid/client';
import { storeItem, storeTransactions } from '@/utils/plaid/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { public_token } = await request.json();

    if (!public_token) {
      return NextResponse.json(
        { error: 'public_token is required' },
        { status: 400 }
      );
    }

    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized - Missing token' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Create Supabase client and get user with token
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Exchange public token for access token
    const response = await plaidClient.itemPublicTokenExchange({
      public_token,
    });

    const { access_token, item_id } = response.data;

    // Get institution info
    const itemResponse = await plaidClient.itemGet({
      access_token,
    });

    // Store item in database
    await storeItem(
      user.id,
      item_id,
      access_token,
      itemResponse.data.item.institution_id!
    );

    // Fetch and store accounts
    const accountsResponse = await plaidClient.accountsGet({
      access_token,
    });

    // Store accounts in database
    const supabaseService = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    for (const account of accountsResponse.data.accounts) {
      const balance = account.balances;
      await supabaseService
        .from('accounts')
        .upsert({
          plaid_account_id: account.account_id,
          plaid_item_id: item_id,
          name: account.name,
          official_name: account.official_name,
          type: account.type,
          subtype: account.subtype,
          mask: account.mask,
          current_balance: balance.current,
          available_balance: balance.available,
          iso_currency_code: balance.iso_currency_code || 'USD',
          balance_last_updated: new Date().toISOString(),
        }, { onConflict: 'plaid_account_id' });
    }

    // Fetch initial transactions (last 30 days)
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = new Date().toISOString().split('T')[0];

    const transactionsResponse = await plaidClient.transactionsGet({
      access_token,
      start_date: startDate,
      end_date: endDate,
    });

    // Store transactions in database
    if (transactionsResponse.data.transactions.length > 0) {
      await storeTransactions(transactionsResponse.data.transactions, item_id);
      
      // 🆕 PHASE 1: Trigger AI tagging for all historical transactions
      // This ensures new users see clean merchant names from day 1
      try {
        console.log('🤖 Triggering historical AI tagging for new account...');
        const tagResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/tag-all-transactions`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` // Pass through user's auth token
          },
          body: JSON.stringify({ 
            max_transactions: 1000 // Process up to 1000 historical transactions
          })
        });

        if (tagResponse.ok) {
          const tagResult = await tagResponse.json();
          console.log('✅ Historical AI tagging initiated:', tagResult.tagged || 0, 'transactions processed');
        } else {
          console.log('⚠️ Historical AI tagging failed (non-blocking):', tagResponse.status);
        }
      } catch (tagError) {
        console.log('⚠️ Historical AI tagging error (non-blocking):', tagError);
        // Non-blocking: Account setup continues even if AI tagging fails
      }
    }

    return NextResponse.json({ 
      success: true,
      item_id,
      accounts: accountsResponse.data.accounts.length,
      transactions: transactionsResponse.data.transactions.length
    });
  } catch (error) {
    console.error('Error exchanging public token:', error);
    handlePlaidError(error);
    return NextResponse.json(
      { error: 'Failed to exchange token' },
      { status: 500 }
    );
  }
} 