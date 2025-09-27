const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTableStructure() {
  console.log('🔍 Checking transactions table structure...');
  
  try {
    // Get a sample transaction to see the structure
    const { data: sampleTx, error: sampleError } = await supabase
      .from('transactions')
      .select('*')
      .limit(1);
    
    if (sampleError) {
      console.error('❌ Sample error:', sampleError);
    } else if (sampleTx && sampleTx.length > 0) {
      console.log('📊 Sample transaction structure:');
      console.log(JSON.stringify(sampleTx[0], null, 2));
    } else {
      console.log('❌ No transactions found');
    }
    
    // Try to get transactions by plaid_item_id instead
    console.log('\n🔍 Checking items table...');
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('*')
      .limit(5);
    
    if (itemsError) {
      console.error('❌ Items error:', itemsError);
    } else if (items) {
      console.log('📊 Items found:', items.length);
      if (items.length > 0) {
        console.log('Sample item:', JSON.stringify(items[0], null, 2));
      }
    }
    
    // Try to get transactions by plaid_item_id
    if (items && items.length > 0) {
      const itemId = items[0].plaid_item_id;
      console.log(`\n🔍 Getting transactions for item: ${itemId}`);
      
      const { data: itemTx, error: itemTxError } = await supabase
        .from('transactions')
        .select('*')
        .eq('plaid_item_id', itemId)
        .order('date', { ascending: false })
        .limit(10);
      
      if (itemTxError) {
        console.error('❌ Item transactions error:', itemTxError);
      } else if (itemTx) {
        console.log(`📊 Found ${itemTx.length} transactions for this item`);
        if (itemTx.length > 0) {
          console.log('Sample transaction:', JSON.stringify(itemTx[0], null, 2));
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkTableStructure();
