import { NextResponse } from 'next/server';
import { plaidClient } from '@/utils/plaid/client';
import { storeTransactions } from '@/utils/plaid/server';
import { createClient } from '@supabase/supabase-js';

export async function POST() {
  try {
    // Get Supabase service client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get all items that don't have accounts yet
    const { data: items } = await supabase
      .from('items')
      .select('*')
      .limit(10);

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'No items found' });
    }

    const results = [];

    for (const item of items) {
      try {
        // Check if accounts already exist for this item
        const { data: existingAccounts } = await supabase
          .from('accounts')
          .select('plaid_account_id')
          .eq('plaid_item_id', item.plaid_item_id);

        if (existingAccounts && existingAccounts.length > 0) {
          results.push({ 
            item_id: item.plaid_item_id, 
            status: 'accounts already exist', 
            accounts: existingAccounts.length 
          });
          continue;
        }

        // Fetch accounts
        const accountsResponse = await plaidClient.accountsGet({
          access_token: item.plaid_access_token,
        });

        // Store accounts
        for (const account of accountsResponse.data.accounts) {
          await supabase
            .from('accounts')
            .upsert({
              plaid_account_id: account.account_id,
              plaid_item_id: item.plaid_item_id,
              name: account.name,
              official_name: account.official_name,
              type: account.type,
              subtype: account.subtype,
              mask: account.mask,
            }, { onConflict: 'plaid_account_id' });
        }

        // Fetch transactions (last 30 days)
        const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const endDate = new Date().toISOString().split('T')[0];

        const transactionsResponse = await plaidClient.transactionsGet({
          access_token: item.plaid_access_token,
          start_date: startDate,
          end_date: endDate,
        });

        // Store transactions
        if (transactionsResponse.data.transactions.length > 0) {
          await storeTransactions(transactionsResponse.data.transactions, item.plaid_item_id);
        }

        results.push({
          item_id: item.plaid_item_id,
          status: 'success',
          accounts: accountsResponse.data.accounts.length,
          transactions: transactionsResponse.data.transactions.length
        });

      } catch (error) {
        console.error(`Error syncing item ${item.plaid_item_id}:`, error);
        results.push({
          item_id: item.plaid_item_id,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({ 
      success: true,
      results
    });

  } catch (error) {
    console.error('Error in sync-existing:', error);
    return NextResponse.json(
      { error: 'Failed to sync existing connections' },
      { status: 500 }
    );
  }
} 