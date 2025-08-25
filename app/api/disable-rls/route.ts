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
    
    // Check accounts access before
    const { data: accountsBefore, error: accountsErrorBefore, count: accountsCountBefore } = await supabase
      .from('accounts')
      .select('*', { count: 'exact' })
      .eq('user_id', targetUserId)
      .is('deleted_at', null)
      .limit(5);

    // Check transactions access before
    const { data: transactionsBefore, error: transactionsErrorBefore, count: transactionsCountBefore } = await supabase
      .from('transactions')
      .select('*', { count: 'exact' })
      .eq('user_id', targetUserId)
      .limit(5);

    // Check total data in tables (without user filter)
    const { count: totalAccounts } = await supabase
      .from('accounts')
      .select('*', { count: 'exact', head: true });

    const { count: totalTransactions } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true });

    console.log(`📊 Before RLS fix - Accounts: ${accountsCountBefore || 0}, Transactions: ${transactionsCountBefore || 0}`);
    console.log(`📊 Total in tables - Accounts: ${totalAccounts || 0}, Transactions: ${totalTransactions || 0}`);

    // Since we can't run SQL commands directly, let's provide instructions
    const instructions = `
    🔧 TO FIX RLS ISSUES, RUN THESE COMMANDS IN YOUR SUPABASE DASHBOARD SQL EDITOR:

    1. Go to your Supabase Dashboard > SQL Editor
    2. Run this SQL:

    -- Disable RLS on accounts table
    ALTER TABLE accounts DISABLE ROW LEVEL SECURITY;
    
    -- Disable RLS on transactions table  
    ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
    
    -- Grant SELECT permissions
    GRANT SELECT ON accounts TO authenticated;
    GRANT SELECT ON transactions TO authenticated;
    
    -- Verify the fix
    SELECT 
        'accounts' as table_name,
        COUNT(*) as total_count,
        COUNT(CASE WHEN user_id = 'bc474c8b-4b47-4c7d-b202-f469330af2a2' THEN 1 END) as user_count
    FROM accounts
    UNION ALL
    SELECT 
        'transactions' as table_name,
        COUNT(*) as total_count,
        COUNT(CASE WHEN user_id = 'bc474c8b-4b47-4c7d-b202-f469330af2a2' THEN 1 END) as user_count
    FROM transactions;
    `;

    return NextResponse.json({
      success: true,
      message: 'RLS diagnostic complete - manual fix required',
      targetUser: targetUserId,
      beforeFix: {
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
        accounts: totalAccounts || 0,
        transactions: totalTransactions || 0
      },
      diagnosis: {
        hasData: (totalAccounts || 0) > 0 || (totalTransactions || 0) > 0,
        canAccessTargetUserData: (accountsCountBefore || 0) > 0 || (transactionsCountBefore || 0) > 0,
        issue: (totalAccounts || 0) > 0 && (accountsCountBefore || 0) === 0 ? 'RLS blocking access' : 'No data in tables'
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
