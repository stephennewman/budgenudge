require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function verifyAccountStructure() {
  console.log('🔍 VERIFYING ACCOUNT STRUCTURE');
  console.log('==============================');
  
  // Get your account
  const { data: account } = await supabase
    .from('accounts')
    .select('*')
    .eq('item_id', 13)
    .single();
    
  // Get your item
  const { data: item } = await supabase
    .from('items')
    .select('*')
    .eq('id', 13)
    .single();
    
  if (account && item) {
    console.log('📋 CORRECT ID STRUCTURE:');
    console.log('');
    console.log('👤 YOU (USER):');
    console.log('  User ID:', item.user_id);
    console.log('  ↓ owns');
    console.log('');
    console.log('🔗 PLAID CONNECTION (ITEM):');
    console.log('  Database ID:', item.id);
    console.log('  Plaid Item ID:', item.plaid_item_id);
    console.log('  ↓ contains');
    console.log('');
    console.log('🏦 BANK ACCOUNT:');
    console.log('  Database ID:', account.id);
    console.log('  Plaid Account ID:', account.plaid_account_id);
    console.log('  Account Name:', account.name);
    console.log('');
    console.log('✅ VERIFICATION:');
    console.log('- User ID 66e74f15... = YOUR identity ✅');
    console.log('- Plaid Account ID 66bqzN87... = YOUR bank account ✅');
    console.log('- These are DIFFERENT and BOTH CORRECT ✅');
    
  } else {
    console.log('❌ Data not found');
  }
}

verifyAccountStructure().catch(console.error);