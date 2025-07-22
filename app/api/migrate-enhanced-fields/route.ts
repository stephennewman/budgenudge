import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    // Security: Only allow if secret key is provided
    const { secret } = await request.json();
    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔄 Running enhanced fields migration...');

    const supabaseService = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Test current table structure first
    const { data: currentStructure, error: structureError } = await supabaseService
      .from('transactions')
      .select('*')
      .limit(1);

    if (structureError) {
      return NextResponse.json({ 
        error: 'Failed to access transactions table',
        details: structureError 
      }, { status: 500 });
    }

    console.log('✅ Transactions table accessible');

    // Check if columns already exist
    const sampleTransaction = currentStructure?.[0];
    const hasNewColumns = sampleTransaction && (
      'logo_url' in sampleTransaction ||
      'location_city' in sampleTransaction ||
      'is_subscription' in sampleTransaction ||
      'pfc_primary' in sampleTransaction
    );

    if (hasNewColumns) {
      console.log('✅ Enhanced columns already exist');
      return NextResponse.json({ 
        success: true,
        message: 'Enhanced columns already exist',
        status: 'already_migrated'
      });
    }

    // For Supabase, we'll need to run the migration through the dashboard
    // Let's just verify we can add the columns and return instructions
    return NextResponse.json({ 
      success: true,
      message: 'Migration ready - run SQL in Supabase dashboard',
      sql_to_run: `
-- Add enhanced transaction fields (run in Supabase SQL Editor):
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS location_city TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_subscription BOOLEAN DEFAULT FALSE;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS pfc_primary TEXT;

-- Create performance indexes:
CREATE INDEX IF NOT EXISTS idx_transactions_location_city ON transactions(location_city) WHERE location_city IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_is_subscription ON transactions(is_subscription) WHERE is_subscription = TRUE;
CREATE INDEX IF NOT EXISTS idx_transactions_pfc_primary ON transactions(pfc_primary) WHERE pfc_primary IS NOT NULL;
      `,
      next_steps: [
        '1. Copy the SQL above',
        '2. Go to Supabase Dashboard > SQL Editor', 
        '3. Paste and run the SQL',
        '4. Come back and test with /api/test-enhanced-fields'
      ]
    });

  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({ 
      error: 'Migration failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 