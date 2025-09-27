import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
  try {
    const supabase = await createSupabaseClient();

    // Try to get all tables in the public schema
    const { data: tables, error: tablesError } = await supabase
      .rpc('get_table_list');

    // If that doesn't work, try direct table queries to see what exists
    const tablesToCheck = [
      'users', 'accounts', 'items', 'transactions', 'profiles',
      'plaid_items', 'plaid_accounts', 'plaid_transactions'
    ];

    const tableResults: { [key: string]: any } = {};

    for (const tableName of tablesToCheck) {
      try {
        // Try to get a count from each table
        const { count, error } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true });

        tableResults[tableName] = {
          exists: !error,
          count: count || 0,
          error: error?.message
        };

        // If table exists, get a sample record
        if (!error && count && count > 0) {
          const { data: sample } = await supabase
            .from(tableName)
            .select('*')
            .limit(1);

          tableResults[tableName].sample = sample?.[0] || null;
        }
      } catch (err) {
        tableResults[tableName] = {
          exists: false,
          error: err instanceof Error ? err.message : 'Unknown error'
        };
      }
    }

    return NextResponse.json({
      rpcTables: tables,
      rpcError: tablesError?.message,
      directTableCheck: tableResults
    });

  } catch (error) {
    console.error('Table check error:', error);
    return NextResponse.json({
      error: 'Failed to check tables',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
