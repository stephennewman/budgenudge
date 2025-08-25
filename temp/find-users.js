const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('🔍 Connecting to Supabase...');
const supabase = createClient(supabaseUrl, supabaseKey);

async function findUsersWithData() {
  try {
    // Check items table for connected accounts
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('user_id, institution_name, status, plaid_item_id')
      .limit(10);

    if (itemsError) {
      console.error('❌ Items query error:', itemsError);
      return null;
    }

    console.log(`📋 Found ${items?.length || 0} connected accounts:`);
    items?.forEach((item, i) => {
      console.log(`${i + 1}. User: ${item.user_id.substring(0, 8)}... | ${item.institution_name}`);
    });

    // Check transaction counts for each user
    if (items && items.length > 0) {
      for (const item of items) {
        const { data: transactions, error: txError } = await supabase
          .from('transactions')
          .select('id, merchant_name, amount, date')
          .eq('plaid_item_id', item.plaid_item_id)
          .gt('amount', 0)
          .limit(10);

        if (!txError && transactions && transactions.length > 0) {
          console.log(`\n✅ User ${item.user_id} has ${transactions.length}+ transactions`);
          console.log(`   Sample: $${transactions[0].amount} at ${transactions[0].merchant_name || 'Unknown'}`);
          return item.user_id; // Return first user with data
        }
      }
    }

    return null;
  } catch (error) {
    console.error('❌ Error:', error.message);
    return null;
  }
}

findUsersWithData().then(userId => {
  if (userId) {
    console.log(`\n🎯 Found user with data: ${userId}`);
  } else {
    console.log('\n❌ No users with transaction data found');
  }
  process.exit(0);
});
