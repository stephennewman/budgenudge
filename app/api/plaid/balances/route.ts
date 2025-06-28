import { NextRequest, NextResponse } from 'next/server';
import { plaidClient, handlePlaidError } from '@/utils/plaid/client';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
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

    // Get user's items (bank connections)
    const { data: items } = await supabase
      .from('items')
      .select('plaid_access_token, plaid_item_id')
      .eq('user_id', user.id);

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'No connected accounts found' }, { status: 404 });
    }

    const supabaseService = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let totalUpdated = 0;

    // Fetch balances for each connected item
    for (const item of items) {
      try {
        const accountsResponse = await plaidClient.accountsGet({
          access_token: item.plaid_access_token,
        });

        // Update each account's balance
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

          totalUpdated++;
        }
      } catch (error) {
        console.error(`Error fetching balances for item ${item.plaid_item_id}:`, error);
        // Continue with other items even if one fails
      }
    }

    return NextResponse.json({ 
      success: true,
      accounts_updated: totalUpdated,
      message: `Updated balances for ${totalUpdated} accounts`
    });

  } catch (error) {
    console.error('Error fetching balances:', error);
    handlePlaidError(error);
    return NextResponse.json(
      { error: 'Failed to fetch balances' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
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

    // First get the user's item IDs
    const { data: userItems } = await supabase
      .from('items')
      .select('id')
      .eq('user_id', user.id);

    if (!userItems || userItems.length === 0) {
      return NextResponse.json({ 
        success: true,
        accounts: []
      });
    }

    const itemIds = userItems.map((item: { id: number }) => item.id);

    // Get user's account balances from database
    const { data: accounts } = await supabase
      .from('accounts')
      .select(`
        plaid_account_id,
        name,
        type,
        subtype,
        current_balance,
        available_balance,
        iso_currency_code,
        balance_last_updated
      `)
      .in('item_id', itemIds);

    return NextResponse.json({ 
      success: true,
      accounts: accounts || []
    });

  } catch (error) {
    console.error('Error getting balances:', error);
    return NextResponse.json(
      { error: 'Failed to get balances' },
      { status: 500 }
    );
  }
} 