import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/server';

export async function GET() {
  try {
    const supabase = await createSupabaseClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`🔍 Checking data access for user: ${user.id}`);

    // Check accounts table access
    const { data: accounts, error: accountsError, count: accountsCount } = await supabase
      .from('accounts')
      .select('*', { count: 'exact' })
      .is('deleted_at', null)
      .limit(5);

    // Check transactions table access
    const { data: transactions, error: transactionsError, count: transactionsCount } = await supabase
      .from('transactions')
      .select('*', { count: 'exact' })
      .limit(5);

    // Check if there are any accounts/transactions at all (without user_id filter)
    const { count: totalAccounts } = await supabase
      .from('accounts')
      .select('*', { count: 'exact', head: true });

    const { count: totalTransactions } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true });

    // Check RLS status
    const { data: rlsStatus } = await supabase
      .from('information_schema.tables')
      .select('table_name, row_security')
      .eq('table_schema', 'public')
      .in('table_name', ['accounts', 'transactions']);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email
      },
      dataAccess: {
        accounts: {
          userFiltered: {
            count: accountsCount,
            data: accounts?.slice(0, 3) || [],
            error: accountsError?.message
          },
          totalInTable: totalAccounts,
          error: accountsError?.message
        },
        transactions: {
          userFiltered: {
            count: transactionsCount,
            data: transactions?.slice(0, 3) || [],
            error: transactionsError?.message
          },
          totalInTable: totalTransactions,
          error: transactionsError?.message
        }
      },
      rlsStatus,
      diagnosis: {
        hasData: (totalAccounts || 0) > 0 || (totalTransactions || 0) > 0,
        canAccessData: (accountsCount || 0) > 0 || (transactionsCount || 0) > 0,
        issue: (totalAccounts || 0) > 0 && (accountsCount || 0) === 0 ? 'RLS blocking access' : 'No data in tables'
      }
    });
    
  } catch (error) {
    console.error('❌ Check data access error:', error);
    return NextResponse.json({ 
      error: 'Internal server error while checking data access' 
    }, { status: 500 });
  }
}
