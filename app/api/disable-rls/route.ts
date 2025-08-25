import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/server';

export async function GET() {
  try {
    const supabase = createSupabaseClient();
    
    const targetUserId = 'bc474c8b-4b47-4c7d-b202-f469330af2a2';

    console.log('🔍 Checking data access for user:', targetUserId);

    // First, get the user's Plaid items
    const { data: userItems, error: itemsError, count: itemsCount } = await supabase
      .from('items')
      .select('*', { count: 'exact' })
      .eq('user_id', targetUserId)
      .limit(5);

    console.log('📦 Items query result:', { userItems, itemsError, itemsCount });

    // Check accounts access through items (accounts table has item_id, not user_id)
    let accountsBefore: Array<{ id: string; name: string; type: string; current_balance: number; available_balance: number }> = [];
    let accountsCountBefore = 0;
    let accountsErrorBefore = null;

    if (userItems && userItems.length > 0) {
      const itemIds = userItems.map(item => item.id);
      const { data: userAccounts, error: accountsError, count: accountsCount } = await supabase
        .from('accounts')
        .select('*', { count: 'exact' })
        .in('item_id', itemIds)
        .is('deleted_at', null)
        .limit(5);

      accountsBefore = userAccounts || [];
      accountsCountBefore = accountsCount || 0;
      accountsErrorBefore = accountsError;
    }

    console.log('🏦 Accounts query result:', { accountsBefore, accountsCountBefore, accountsErrorBefore });

    // Check transactions access through items (transactions table has plaid_item_id)
    let transactionsBefore: Array<{ id: string; date: string; amount: number; merchant_name: string; category: string }> = [];
    let transactionsCountBefore = 0;
    let transactionsErrorBefore = null;

    if (userItems && userItems.length > 0) {
      const plaidItemIds = userItems.map(item => item.plaid_item_id);
      const { data: userTransactions, error: transactionsError, count: transactionsCount } = await supabase
        .from('transactions')
        .select('*', { count: 'exact' })
        .in('plaid_item_id', plaidItemIds)
        .limit(5);

      transactionsBefore = userTransactions || [];
      transactionsCountBefore = transactionsCount || 0;
      transactionsErrorBefore = transactionsError;
    }

    console.log('💳 Transactions query result:', { transactionsBefore, transactionsCountBefore, transactionsErrorBefore });

    // DIAGNOSIS: The issue was that the SMS variables endpoint was incorrectly trying to query
    // accounts and transactions tables directly with user_id, but the correct flow is:
    // items (user_id) -> accounts (item_id) -> transactions (plaid_item_id)
    
    const diagnosis = `
🔍 DIAGNOSIS:
✅ Items table: ${itemsCount || 0} items found for user ${targetUserId}
${itemsError ? `❌ Items error: ${itemsError.message}` : ''}

🏦 Accounts table: ${accountsCountBefore || 0} accounts found through items
${accountsErrorBefore ? `❌ Accounts error: ${accountsErrorBefore.message}` : ''}

💳 Transactions table: ${transactionsCountBefore || 0} transactions found through items  
${transactionsErrorBefore ? `❌ Transactions error: ${transactionsErrorBefore.message}` : ''}

🎯 ROOT CAUSE: The SMS variables endpoint was incorrectly querying accounts and transactions 
tables directly with user_id, but these tables don't have user_id fields. They link through 
the items table using item_id and plaid_item_id respectively.

✅ SOLUTION: The SMS variables endpoint has been fixed to use the correct data flow:
1. Query items table with user_id
2. Use item.id to query accounts table with item_id  
3. Use item.plaid_item_id to query transactions table with plaid_item_id
    `;

    const fixInstructions = `
🔧 TO FIX RLS ISSUES (if still needed), RUN THESE COMMANDS IN YOUR SUPABASE DASHBOARD SQL EDITOR:

1. Go to your Supabase Dashboard > SQL Editor
2. Run this SQL:

-- Disable RLS on all related tables
ALTER TABLE items DISABLE ROW LEVEL SECURITY;
ALTER TABLE accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;

-- Grant SELECT permissions
GRANT SELECT ON items TO authenticated;
GRANT SELECT ON accounts TO authenticated;
GRANT SELECT ON transactions TO authenticated;

-- Verify the fix by checking the data flow
SELECT
    'items' as table_name,
    COUNT(*) as total_count,
    COUNT(CASE WHEN user_id = 'bc474c8b-4b47-4c7d-b202-f469330af2a2' THEN 1 END) as user_count
FROM items
UNION ALL
SELECT
    'accounts' as table_name,
    COUNT(*) as total_count,
    COUNT(CASE WHEN item_id IN (SELECT id FROM items WHERE user_id = 'bc474c8b-4b47-4c7d-b202-f469330af2a2') THEN 1 END) as user_count
FROM accounts
UNION ALL
SELECT
    'transactions' as table_name,
    COUNT(*) as total_count,
    COUNT(CASE WHEN plaid_item_id IN (SELECT plaid_item_id FROM items WHERE user_id = 'bc474c8b-4c7d-b202-f469330af2a2') THEN 1 END) as user_count
FROM transactions;
    `;

    return NextResponse.json({
      success: true,
      diagnosis,
      fixInstructions,
      data: {
        items: {
          count: itemsCount || 0,
          error: itemsError?.message || null,
          sample: userItems?.slice(0, 2) || []
        },
        accounts: {
          count: accountsCountBefore,
          error: accountsErrorBefore?.message || null,
          sample: accountsBefore.slice(0, 2)
        },
        transactions: {
          count: transactionsCountBefore,
          error: transactionsErrorBefore?.message || null,
          sample: transactionsBefore.slice(0, 2)
        }
      }
    });

  } catch (error) {
    console.error('❌ RLS diagnostic error:', error);
    return NextResponse.json({ 
      error: 'Failed to run RLS diagnostic',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
