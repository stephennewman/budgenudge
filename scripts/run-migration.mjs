import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get the directory of this script
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables (they should be available in the Next.js environment)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing environment variables:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL:', SUPABASE_URL ? '✅' : '❌');
  console.error('  SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_KEY ? '✅' : '❌');
  console.error('\n💡 Make sure you have these in your .env.local or environment');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function runMigration() {
  console.log('🔄 Starting enhanced Plaid data migration...\n');

  try {
    // Test connection first
    const { data: testData, error: testError } = await supabase
      .from('transactions')
      .select('id')
      .limit(1);

    if (testError) {
      console.error('❌ Database connection failed:', testError.message);
      return false;
    }

    console.log('✅ Database connection successful');

    // Check if columns already exist
    const { data: existing, error: checkError } = await supabase
      .rpc('check_column_exists', { 
        table_name: 'transactions', 
        column_name: 'logo_url' 
      })
      .then(() => ({ data: true, error: null }))
      .catch(() => ({ data: false, error: null }));

    // The migrations to run
    const migrations = [
      {
        name: 'Add logo_url column',
        sql: 'ALTER TABLE transactions ADD COLUMN IF NOT EXISTS logo_url TEXT;'
      },
      {
        name: 'Add location_city column', 
        sql: 'ALTER TABLE transactions ADD COLUMN IF NOT EXISTS location_city TEXT;'
      },
      {
        name: 'Add is_subscription column',
        sql: 'ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_subscription BOOLEAN DEFAULT FALSE;'
      },
      {
        name: 'Add pfc_primary column',
        sql: 'ALTER TABLE transactions ADD COLUMN IF NOT EXISTS pfc_primary TEXT;'
      },
      {
        name: 'Create index on location_city',
        sql: 'CREATE INDEX IF NOT EXISTS idx_transactions_location_city ON transactions(location_city) WHERE location_city IS NOT NULL;'
      },
      {
        name: 'Create index on is_subscription', 
        sql: 'CREATE INDEX IF NOT EXISTS idx_transactions_is_subscription ON transactions(is_subscription) WHERE is_subscription = TRUE;'
      },
      {
        name: 'Create index on pfc_primary',
        sql: 'CREATE INDEX IF NOT EXISTS idx_transactions_pfc_primary ON transactions(pfc_primary) WHERE pfc_primary IS NOT NULL;'
      }
    ];

    console.log('📝 Running migrations...\n');

    let successCount = 0;

    for (const migration of migrations) {
      try {
        console.log(`  🔄 ${migration.name}...`);
        
        // For Supabase, we need to use a function that can execute raw SQL
        // This approach should work with the service role key
        const { error } = await supabase.rpc('exec_sql', { 
          query: migration.sql 
        });

        if (error) {
          // Fallback: Try to detect if the column already exists
          console.log(`  ⚠️  ${migration.name} - may already exist or need manual execution`);
        } else {
          console.log(`  ✅ ${migration.name} - completed`);
          successCount++;
        }
      } catch (error) {
        console.log(`  ⚠️  ${migration.name} - ${error.message}`);
      }
    }

    console.log(`\n📊 Migration Summary: ${successCount}/${migrations.length} completed`);

    // Test if we can now query the new columns
    try {
      const { data: test, error: testNewError } = await supabase
        .from('transactions')
        .select('logo_url, location_city, is_subscription, pfc_primary')
        .limit(1);
        
      if (testNewError) {
        console.log('\n⚠️  Migration completed but columns not immediately queryable');
        console.log('   This may be normal - try the test endpoint in a moment');
        return false;
      } else {
        console.log('\n🎉 Migration successful! New columns are queryable');
        console.log('✅ Enhanced Plaid data capture is now active');
        return true;
      }
    } catch (testError) {
      console.log('\n⚠️  Migration may need manual verification');
      return false;
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    return false;
  }
}

// Run the migration
runMigration()
  .then(success => {
    if (success) {
      console.log('\n🚀 Next steps:');
      console.log('  1. Test with: curl -s "https://budgenudge.vercel.app/api/test-enhanced-fields" | jq \'.\'');
      console.log('  2. Make a test transaction to see enhanced data capture');
      console.log('  3. Enhanced webhook is already deployed and capturing data');
    } else {
      console.log('\n📋 Manual steps required:');
      console.log('  1. Go to Supabase Dashboard > SQL Editor');
      console.log('  2. Run the SQL from run-migration-direct.sql file');
      console.log('  3. Test with the API endpoint');
    }
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }); 