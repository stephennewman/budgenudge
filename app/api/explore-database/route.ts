import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
  try {
    const supabase = await createSupabaseClient();

    // Check what tables exist and their structure
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['users', 'items', 'transactions', 'accounts']);

    if (tablesError) {
      console.error('Tables query error:', tablesError);
    }

    // Check users table
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .limit(10);

    // Check items/accounts table
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('*')
      .limit(10);

    // Check if there's an accounts table too
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('*')
      .limit(10);

    // Check transactions table
    const { data: transactions, error: transactionsError } = await supabase
      .from('transactions')
      .select('*')
      .limit(5);

    // Check transaction counts
    const { count: transactionCount, error: countError } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true });

    // Check item counts
    const { count: itemCount, error: itemCountError } = await supabase
      .from('items')
      .select('*', { count: 'exact', head: true });

    // Check user counts
    const { count: userCount, error: userCountError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({
      database: {
        tables: tables?.map(t => t.table_name) || [],
        tablesError: tablesError?.message
      },
      users: {
        count: userCount || 0,
        error: userCountError?.message,
        sample: users?.map(u => ({ id: u.id, email: u.email, created_at: u.created_at })) || []
      },
      items: {
        count: itemCount || 0,
        error: itemCountError?.message,
        sample: items?.map(i => ({
          id: i.id,
          user_id: i.user_id,
          institution_name: i.institution_name,
          status: i.status,
          created_at: i.created_at
        })) || []
      },
      accounts: {
        exists: !accountsError,
        error: accountsError?.message,
        sample: accounts?.slice(0, 3) || []
      },
      transactions: {
        count: transactionCount || 0,
        error: countError?.message || transactionsError?.message,
        sample: transactions?.map(t => ({
          id: t.id,
          name: t.name,
          amount: t.amount,
          date: t.date,
          plaid_item_id: t.plaid_item_id
        })) || []
      }
    });

  } catch (error) {
    console.error('Database exploration error:', error);
    return NextResponse.json({
      error: 'Failed to explore database',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
