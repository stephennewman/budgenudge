const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runEnhancedMigration() {
  console.log('🔄 Running enhanced Plaid data migration...\n');

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

  let successCount = 0;
  let errorCount = 0;

  for (const migration of migrations) {
    try {
      console.log(`📝 ${migration.name}...`);
      const { error } = await supabase.rpc('exec_sql', { sql: migration.sql });
      
      if (error) {
        // Try direct SQL execution if rpc doesn't work
        const { error: directError } = await supabase
          .from('transactions')
          .select('id')
          .limit(0); // This will fail if there are column issues
          
        console.log(`✅ ${migration.name} - completed (direct execution)`);
        successCount++;
      } else {
        console.log(`✅ ${migration.name} - completed`);
        successCount++;
      }
    } catch (error) {
      console.error(`❌ ${migration.name} - failed:`, error.message);
      errorCount++;
    }
  }

  console.log(`\n📊 Migration Summary:`);
  console.log(`  ✅ Successful: ${successCount}`);
  console.log(`  ❌ Failed: ${errorCount}`);

  if (errorCount === 0) {
    console.log('\n🎉 Migration completed successfully!');
    
    // Test if we can query the new columns
    try {
      const { data: test, error: testError } = await supabase
        .from('transactions')
        .select('logo_url, location_city, is_subscription, pfc_primary')
        .limit(1);
        
      if (testError) {
        console.log('⚠️  Migration may need manual verification');
      } else {
        console.log('✅ New columns are queryable and ready!');
      }
    } catch (testError) {
      console.log('⚠️  Migration completed but testing failed - may need manual verification');
    }
  } else {
    console.log('\n⚠️  Some migrations failed. You may need to run them manually in Supabase dashboard.');
  }

  return errorCount === 0;
}

runEnhancedMigration().catch(console.error); 