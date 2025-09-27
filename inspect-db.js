const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://oexkzqvoepdeywlyfsdj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9leGt6cXZvZXBkZXl3bHlmc2RqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDI3NjMwOCwiZXhwIjoyMDY1ODUyMzA4fQ.e6qBDSRAbVlUjs7vjdOJct-G1t_uYgB3L_uS5VnWaAw';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function inspectDatabase() {
  console.log('🔍 Inspecting Supabase Database...\n');

  // Check tables
  const tables = ['users', 'items', 'transactions', 'accounts', 'profiles'];

  for (const tableName of tables) {
    try {
      console.log(`📋 Checking table: ${tableName}`);

      // Get count
      const { count, error: countError } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      if (countError) {
        console.log(`  ❌ Error: ${countError.message}`);
      } else {
        console.log(`  ✅ Records: ${count || 0}`);
      }

      // Get sample data if table has records
      if (count && count > 0) {
        const { data: sample, error: sampleError } = await supabase
          .from(tableName)
          .select('*')
          .limit(3);

        if (!sampleError && sample) {
          console.log(`  📊 Sample records:`);
          sample.forEach((record, index) => {
            console.log(`    ${index + 1}. ${JSON.stringify(record, null, 2).split('\n').join('\n       ')}`);
          });
        }
      }

      console.log('');

    } catch (err) {
      console.log(`  ❌ Unexpected error: ${err.message}`);
      console.log('');
    }
  }

  // Check specific user data
  const userId = 'bc474c8b-4b47-4c7d-b202-f469330af2a2';
  console.log(`👤 Checking data for user: ${userId}\n`);

  try {
    // Check user in users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId);

    if (userError) {
      console.log(`❌ Users table error: ${userError.message}`);
    } else {
      console.log(`✅ User exists: ${userData && userData.length > 0 ? 'YES' : 'NO'}`);
      if (userData && userData.length > 0) {
        console.log(`📊 User data:`, userData[0]);
      }
    }

    // Check items/accounts for this user
    const { data: itemsData, error: itemsError } = await supabase
      .from('items')
      .select('*')
      .eq('user_id', userId);

    if (itemsError) {
      console.log(`❌ Items table error: ${itemsError.message}`);
    } else {
      console.log(`✅ User items: ${itemsData ? itemsData.length : 0}`);
      if (itemsData && itemsData.length > 0) {
        console.log(`📊 Items data:`, itemsData);
      }
    }

    // Check transactions for this user
    const { data: txData, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('items.user_id', userId)
      .limit(5);

    if (txError) {
      console.log(`❌ Transactions table error: ${txError.message}`);
    } else {
      console.log(`✅ User transactions: ${txData ? txData.length : 0} (showing first 5)`);
      if (txData && txData.length > 0) {
        console.log(`📊 Transaction samples:`, txData.slice(0, 3));
      }
    }

  } catch (err) {
    console.log(`❌ User data check error: ${err.message}`);
  }
}

inspectDatabase().catch(console.error);
