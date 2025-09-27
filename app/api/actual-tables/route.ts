import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
  try {
    const supabase = await createSupabaseClient();

    // Try different approaches to see what tables exist
    const tableQueries = [
      'SELECT tablename FROM pg_tables WHERE schemaname = \'public\'',
      'SELECT table_name FROM information_schema.tables WHERE table_schema = \'public\'',
      'SELECT name FROM sqlite_master WHERE type=\'table\''
    ];

    const results: any[] = [];

    for (const query of tableQueries) {
      try {
        const { data, error } = await supabase.rpc('exec_sql', { sql: query });
        results.push({
          query,
          data: data || [],
          error: error?.message
        });
      } catch (err) {
        results.push({
          query,
          error: err instanceof Error ? err.message : 'Query failed'
        });
      }
    }

    // Try to describe the structure of existing tables
    const knownTables = ['users', 'accounts', 'items', 'transactions', 'profiles'];
    const tableDescriptions: { [key: string]: any } = {};

    for (const tableName of knownTables) {
      try {
        // Try to get table structure
        const { data: structure, error: structError } = await supabase
          .from(tableName)
          .select('*')
          .limit(0); // Just get structure, no data

        tableDescriptions[tableName] = {
          structureAttempt: structure,
          error: structError?.message
        };

        // Try to get column information
        const columnQuery = `
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_name = '${tableName}' AND table_schema = 'public'
          ORDER BY ordinal_position
        `;

        try {
          const { data: columns, error: colError } = await supabase.rpc('exec_sql', { sql: columnQuery });
          tableDescriptions[tableName].columns = columns || [];
          tableDescriptions[tableName].columnError = colError?.message;
        } catch (colErr) {
          tableDescriptions[tableName].columnError = colErr instanceof Error ? colErr.message : 'Column query failed';
        }

      } catch (err) {
        tableDescriptions[tableName] = {
          error: err instanceof Error ? err.message : 'Table check failed'
        };
      }
    }

    return NextResponse.json({
      tableDiscovery: results,
      tableDescriptions,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Table discovery error:', error);
    return NextResponse.json({
      error: 'Failed to discover tables',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
