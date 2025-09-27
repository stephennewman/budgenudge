import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
  try {
    const supabase = await createSupabaseClient();

    // Try to get schema information for each table
    const tables = ['users', 'items', 'transactions', 'accounts'];

    const schemaInfo: { [key: string]: any } = {};

    for (const tableName of tables) {
      try {
        // Try to get a sample record to see the structure
        const { data: sample, error: sampleError } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);

        schemaInfo[tableName] = {
          sample: sample?.[0] || null,
          sampleError: sampleError?.message,
          hasData: sample && sample.length > 0
        };

        // Try an insert to see what fields are required
        if (!sample || sample.length === 0) {
          const testInsert = {
            id: `test_${Date.now()}`,
            created_at: new Date().toISOString()
          };

          if (tableName === 'users') {
            testInsert.email = 'test@example.com';
          } else if (tableName === 'items') {
            testInsert.user_id = 'test_user_id';
            testInsert.plaid_item_id = 'test_plaid_id';
            testInsert.institution_name = 'Test Bank';
            testInsert.status = 'good';
          } else if (tableName === 'transactions') {
            testInsert.plaid_item_id = 'test_item_id';
            testInsert.name = 'Test Transaction';
            testInsert.amount = -10.00;
            testInsert.date = new Date().toISOString().split('T')[0];
          }

          const { error: insertError } = await supabase
            .from(tableName)
            .insert(testInsert);

          schemaInfo[tableName].insertTest = {
            success: !insertError,
            error: insertError?.message,
            testData: testInsert
          };

          // Clean up test record if it was inserted
          if (!insertError) {
            await supabase
              .from(tableName)
              .delete()
              .eq('id', testInsert.id);
          }
        }
      } catch (err) {
        schemaInfo[tableName] = {
          error: err instanceof Error ? err.message : 'Unknown error'
        };
      }
    }

    return NextResponse.json({
      schemaAnalysis: schemaInfo,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Schema check error:', error);
    return NextResponse.json({
      error: 'Failed to check schema',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
