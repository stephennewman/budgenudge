import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/server';

export async function POST() {
  try {
    const supabase = await createSupabaseClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`🔧 Disabling RLS for user: ${user.id}`);

    // Test data access for the specific user BEFORE disabling RLS
    const targetUserId = 'bc474c8b-4b47-4c7d-b202-f469330af2a2';
    
    console.log(`📊 Testing data access for target user: ${targetUserId}`);
    
    // First, get the user's Plaid items
    const { data: userItems, error: itemsError, count: itemsCount } = await supabase
      .from('items')
      .select('*', { count: 'exact' })
      .eq('user_id', targetUserId)
      .limit(5);

    console.log(`📊 User has ${itemsCount || 0} Plaid items`);
    
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

    // Check total data in tables (without user filter)
    const { count: totalAccounts } = await supabase
      .from('accounts')
      .select('*', { count: 'exact', head: true });

    const { count: totalTransactions } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true });

    const { count: totalItems } = await supabase
      .from('items')
      .select('*', { count: 'exact', head: true });

    console.log(`📊 Before RLS fix - Items: ${itemsCount || 0}, Accounts: ${accountsCountBefore || 0}, Transactions: ${transactionsCountBefore || 0}`);
    console.log(`📊 Total in tables - Items: ${totalItems || 0}, Accounts: ${totalAccounts || 0}, Transactions: ${totalTransactions || 0}`);

    // Since we can't run SQL commands directly, let's provide instructions
    const instructions = `
    🔧 TO FIX RLS ISSUES, RUN THESE COMMANDS IN YOUR SUPABASE DASHBOARD SQL EDITOR:

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
        COUNT(CASE WHEN plaid_item_id IN (SELECT plaid_item_id FROM items WHERE user_id = 'bc474c8b-4b47-4c7d-b202-f469330af2a2') THEN 1 END) as user_count
    FROM transactions;
    `;

    return NextResponse.json({
      success: true,
      message: 'RLS diagnostic complete - manual fix required',
      targetUser: targetUserId,
      beforeFix: {
        items: {
          count: itemsCount || 0,
          sample: userItems?.slice(0, 3) || [],
          error: itemsError?.message
        },
        accounts: {
          count: accountsCountBefore || 0,
          sample: accountsBefore?.slice(0, 3) || [],
          error: accountsErrorBefore?.message
        },
        transactions: {
          count: transactionsCountBefore || 0,
          sample: transactionsBefore?.slice(0, 3) || [],
          error: transactionsErrorBefore?.message
        }
      },
      totalInTables: {
        items: totalItems || 0,
        accounts: totalAccounts || 0,
        transactions: totalTransactions || 0
      },
      diagnosis: {
        hasData: (totalItems || 0) > 0 || (totalAccounts || 0) > 0 || (totalTransactions || 0) > 0,
        canAccessTargetUserData: (itemsCount || 0) > 0 && (accountsCountBefore || 0) > 0 && (transactionsCountBefore || 0) > 0,
        issue: (totalItems || 0) > 0 && (itemsCount || 0) === 0 ? 'RLS blocking access to items' : 
               (totalAccounts || 0) > 0 && (accountsCountBefore || 0) === 0 ? 'RLS blocking access to accounts' :
               (totalTransactions || 0) > 0 && (transactionsCountBefore || 0) === 0 ? 'RLS blocking access to transactions' :
               'No data in tables or data flow issue'
      },
      fixInstructions: instructions
    });
    
  } catch (error) {
    console.error('❌ Disable RLS error:', error);
    return NextResponse.json({ 
      error: 'Internal server error while checking RLS' 
    }, { status: 500 });
  }
}
