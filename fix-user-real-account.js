require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fixUserRealAccount() {
  console.log('🔧 FIXING USER REAL ACCOUNT');
  console.log('===========================');
  
  const itemId = 13;
  const realAccountId = '66bqzN8738SeA9XAOprRH7PBLOz9mOtN170qE';
  
  console.log('📋 Item ID:', itemId);
  console.log('🎯 Real Plaid Account ID:', realAccountId);
  
  // Delete temp account
  console.log('\n🗑️  Removing temp_account_1...');
  const { error: deleteError } = await supabase
    .from('accounts')
    .delete()
    .eq('plaid_account_id', 'temp_account_1');
    
  if (deleteError) {
    console.error('❌ Error deleting temp account:', deleteError);
    return;
  }
  console.log('✅ Temp account removed');
  
  // Create real account with proper foreign key and real Plaid ID
  console.log('\n💾 Creating real account...');
  const { error: insertError } = await supabase
    .from('accounts')
    .insert({
      item_id: itemId, // ✅ Correct database foreign key
      plaid_account_id: realAccountId, // ✅ Real Plaid account ID from transactions
      name: 'Bank Account', // Will be updated when Plaid API is called next
      type: 'depository',
      subtype: 'checking',
      current_balance: 0,
      available_balance: 0,
      iso_currency_code: 'USD',
      balance_last_updated: new Date().toISOString(),
    });
    
  if (insertError) {
    console.error('❌ Error creating real account:', insertError);
    return;
  }
  
  console.log('✅ SUCCESS: Real account created!');
  
  // Verify the fix
  console.log('\n🔍 VERIFICATION:');
  const { data: accounts } = await supabase
    .from('accounts')
    .select('*')
    .eq('item_id', itemId);
    
  accounts?.forEach(acc => {
    console.log('✅ Account:', acc.plaid_account_id, '-', acc.name);
  });
  
  console.log('\n🎉 Your account page should now work correctly!');
  console.log('📊 The account will show proper data from:', realAccountId);
}

fixUserRealAccount().catch(console.error);