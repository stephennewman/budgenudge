import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { plaidClient } from '@/utils/plaid/client';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const targetUserId = 'bc474c8b-4b47-4c7d-b202-f469330af2a2';

    console.log(`🎯 Testing pending transactions for user: ${targetUserId}`);

    // Get user's items and accounts
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select(`
        plaid_item_id,
        plaid_access_token,
        plaid_institution_id,
        accounts!inner(plaid_account_id, name, account_type, current_balance, available_balance)
      `)
      .eq('user_id', targetUserId)
      .is('deleted_at', null);

    if (itemsError || !items || items.length === 0) {
      return NextResponse.json({
        error: 'No items found for this user',
        user_id: targetUserId,
        details: itemsError
      }, { status: 404 });
    }

    console.log(`📊 Found ${items.length} items for user`);

    // Get pending transactions from KREZZO database
    const { data: pendingTransactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('pending', true)
      .in('plaid_item_id', items.map(i => i.plaid_item_id));

    console.log(`⏳ Found ${pendingTransactions?.length || 0} pending transactions in KREZZO database`);

    // Get real-time data from Plaid for comparison
    const plaidResults = [];
    for (const item of items) {
      try {
        // Get real-time account data
        const accountsResponse = await plaidClient.accountsGet({
          access_token: item.plaid_access_token,
        });

        // Get recent transactions (including pending)
        const transactionsResponse = await plaidClient.transactionsGet({
          access_token: item.plaid_access_token,
          start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Last 30 days
          end_date: new Date().toISOString().split('T')[0],
        });

        const pendingFromPlaid = transactionsResponse.data.transactions.filter(tx => tx.pending);

        plaidResults.push({
          item_id: item.plaid_item_id,
          institution: item.plaid_institution_id,
          accounts: accountsResponse.data.accounts.map(acc => ({
            account_id: acc.account_id,
            name: acc.name,
            type: acc.type,
            subtype: acc.subtype,
            current_balance: acc.balances.current,
            available_balance: acc.balances.available,
            stored_current: item.accounts.find(a => a.plaid_account_id === acc.account_id)?.current_balance,
            stored_available: item.accounts.find(a => a.plaid_account_id === acc.account_id)?.available_balance,
          })),
          pending_transactions_from_plaid: pendingFromPlaid.map(tx => ({
            transaction_id: tx.transaction_id,
            account_id: tx.account_id,
            amount: tx.amount,
            name: tx.name,
            date: tx.date,
            pending: tx.pending,
            merchant_name: tx.merchant_name
          }))
        });

        console.log(`🏦 Plaid API shows ${pendingFromPlaid.length} pending transactions for item ${item.plaid_item_id}`);

      } catch (plaidError) {
        console.error(`❌ Plaid error for item ${item.plaid_item_id}:`, plaidError);
        plaidResults.push({
          item_id: item.plaid_item_id,
          institution: item.plaid_institution_id,
          error: 'Failed to fetch from Plaid',
          error_details: plaidError instanceof Error ? plaidError.message : 'Unknown error'
        });
      }
    }

    // Summary analysis
    const totalPendingKrezzo = pendingTransactions?.length || 0;
    const totalPendingPlaid = plaidResults.reduce((sum, result) => 
      sum + (result.pending_transactions_from_plaid?.length || 0), 0
    );

    const analysis = {
      user_id: targetUserId,
      timestamp: new Date().toISOString(),
      user_reports_pending: 1,
      krezzo_database_pending: totalPendingKrezzo,
      plaid_api_pending: totalPendingPlaid,
      data_sync_status: totalPendingKrezzo === totalPendingPlaid ? 'IN_SYNC' : 'OUT_OF_SYNC',
      can_access_pending: totalPendingPlaid > 0,
      recommendation: totalPendingPlaid > 0 ? 
        'KREZZO can access pending transactions from Plaid. Consider including them in balance calculations.' :
        'No pending transactions detected in Plaid API. May need to check specific account or wait for sync.'
    };

    return NextResponse.json({
      success: true,
      analysis,
      pending_transactions_in_krezzo: pendingTransactions,
      plaid_results: plaidResults,
      raw_data: {
        items_count: items.length,
        accounts_count: items.reduce((sum, item) => sum + item.accounts.length, 0)
      }
    });

  } catch (error) {
    console.error('❌ User pending transaction test error:', error);
    return NextResponse.json(
      { 
        error: 'Test failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
