import { NextResponse } from 'next/server';
import { storeTransactions } from '@/utils/plaid/server';
import { createClient } from '@supabase/supabase-js';
import { plaidClient } from '@/utils/plaid/client';

// Manual refresh endpoint - replicates webhook functionality
export async function POST(request: Request) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized - Missing token' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Initialize Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Get authenticated user with token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all items for this user
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('plaid_item_id, plaid_access_token, plaid_institution_id')
      .eq('user_id', user.id);

    if (itemsError) {
      console.error('Error fetching user items:', itemsError);
      return NextResponse.json({ error: 'Failed to fetch user items' }, { status: 500 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ 
        success: false, 
        message: 'No bank accounts connected. Please connect a bank account first.',
        newTransactions: 0,
        accountsUpdated: 0 
      });
    }

    let totalNewTransactions = 0;
    let accountsUpdated = 0;
    const results = [];

    // Process each item
    for (const item of items) {
      try {
        // Calculate date range
        const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const endDate = new Date().toISOString().split('T')[0];
        // Fetch transactions for the last 90 days (same as webhook)
        let transactionsResponse;
        try {
          transactionsResponse = await plaidClient.transactionsGet({
            access_token: item.plaid_access_token,
            start_date: startDate,
            end_date: endDate,
          });
        } catch (plaidError: unknown) {
          console.error(`❌ Plaid API Error for item ${item.plaid_item_id}:`, plaidError);
          
          // Log specific error details
          if (plaidError && typeof plaidError === 'object' && 'response' in plaidError) {
            const error = plaidError as { response?: { data?: { error_code?: string }; status?: number } };
            if (error.response) {
              console.error('Plaid Error Response:', error.response.data);
              console.error('Plaid Error Status:', error.response.status);
              
              // Check if it's an access token issue
              if (error.response.data?.error_code === 'INVALID_ACCESS_TOKEN' || 
                  error.response.data?.error_code === 'ACCESS_TOKEN_EXPIRED') {
                throw new Error(`Access token invalid or expired. Please reconnect your bank account.`);
              }
            }
          }
          
          throw plaidError;
        }

        // Log recent transactions (last 10 days)
        const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const recentTransactions = transactionsResponse.data.transactions.filter(t => t.date >= tenDaysAgo);
        if (recentTransactions.length > 0) {
        }

        // Store transactions in database (using verified database plaid_item_id)
        const storedTransactions = await storeTransactions(
          transactionsResponse.data.transactions, 
          item.plaid_item_id
        );

        totalNewTransactions += storedTransactions?.length || 0;

        // 🤖 Auto-tag new transactions with AI (non-blocking)
        if (storedTransactions && storedTransactions.length > 0) {
          // Call the existing AI tagging API in background
          triggerBackgroundAITagging().catch((error: unknown) => {
            console.warn('⚠️ Background AI tagging failed (non-critical):', error);
          });
        }

        // Update account balances (same as webhook)
        try {
          const accountsResponse = await plaidClient.accountsGet({
            access_token: item.plaid_access_token,
          });

          const supabaseService = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          );

          for (const account of accountsResponse.data.accounts) {
            const balance = account.balances;
            
            await supabaseService
              .from('accounts')
              .update({
                current_balance: balance.current,
                available_balance: balance.available,
                iso_currency_code: balance.iso_currency_code || 'USD',
                balance_last_updated: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('plaid_account_id', account.account_id);

            accountsUpdated++;
          }
        } catch (balanceError) {
          console.error('Error updating balances for item:', item.plaid_item_id, balanceError);
        }

        results.push({
          item_id: item.plaid_item_id,
          institution_id: item.plaid_institution_id,
          transactions_fetched: transactionsResponse.data.transactions.length,
          new_transactions: storedTransactions?.length || 0,
          status: 'success'
        });

      } catch (itemError) {
        console.error(`❌ Error processing item ${item.plaid_item_id}:`, itemError);
        results.push({
          item_id: item.plaid_item_id,
          institution_id: item.plaid_institution_id,
          status: 'error',
          error: itemError instanceof Error ? itemError.message : 'Unknown error'
        });
      }
    }

    const message = totalNewTransactions > 0 
      ? `Successfully refreshed! Found ${totalNewTransactions} new/updated transactions across ${items.length} connected account(s).`
      : `Refresh complete! No new transactions found. Your data is up to date.`;

    return NextResponse.json({
      success: true,
      message,
      newTransactions: totalNewTransactions,
      accountsUpdated,
      itemsProcessed: items.length,
      results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Manual refresh error:', error);
    return NextResponse.json(
      { 
        error: 'Transaction refresh failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// 🤖 Simple background AI tagging using existing API
async function triggerBackgroundAITagging() {
  try {
    // Call the existing tag-all-transactions API (internal call)
    const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/tag-all-transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ max_transactions: 100 })
    });

    if (response.ok) {
      await response.json();
    } else {
      console.warn('🤖 Background AI tagging failed with status:', response.status);
    }
  } catch (error) {
    console.error('🤖 Background AI tagging error:', error);
  }
} 