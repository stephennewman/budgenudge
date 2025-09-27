const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function showRealData() {
  const userId = 'bc474c8b-4b47-4c7d-b202-f469330af2a2';
  
  console.log(`🔍 Showing real transaction data for user: ${userId}`);
  console.log('=' .repeat(80));
  
  try {
    // Get total count
    const { count: totalCount, error: countError } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    
    if (countError) {
      console.error('❌ Count error:', countError);
    } else {
      console.log(`📊 Total transactions: ${totalCount}`);
    }
    
    // Get date range
    const { data: firstTx, error: firstError } = await supabase
      .from('transactions')
      .select('date')
      .eq('user_id', userId)
      .order('date', { ascending: true })
      .limit(1);
    
    const { data: lastTx, error: lastError } = await supabase
      .from('transactions')
      .select('date')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(1);
    
    if (firstError || lastError) {
      console.error('❌ Date range error:', firstError || lastError);
    } else {
      console.log(`📅 Date range: ${firstTx[0]?.date} to ${lastTx[0]?.date}`);
    }
    
    // Get September 2025 transactions
    console.log('\n📅 SEPTEMBER 2025 TRANSACTIONS:');
    console.log('=' .repeat(50));
    
    const { data: septTransactions, error: septError } = await supabase
      .from('transactions')
      .select('id, date, amount, merchant_name, ai_merchant_name, category, ai_category_tag, name')
      .eq('user_id', userId)
      .gte('date', '2025-09-01')
      .lte('date', '2025-09-30')
      .order('date', { ascending: false });
    
    if (septError) {
      console.error('❌ September error:', septError);
    } else {
      console.log(`📊 September 2025 transactions: ${septTransactions.length}`);
      
      if (septTransactions.length > 0) {
        console.log('\nRecent September transactions:');
        septTransactions.forEach((tx, index) => {
          const merchant = tx.ai_merchant_name || tx.merchant_name || tx.name || 'Unknown';
          const category = tx.ai_category_tag || tx.category || 'Unknown';
          console.log(`${index + 1}. ${tx.date}: ${merchant} (${category}) - $${tx.amount.toFixed(2)}`);
        });
        
        // Group by merchant
        const merchantGroups = {};
        septTransactions.forEach(tx => {
          const merchant = tx.ai_merchant_name || tx.merchant_name || tx.name || 'Unknown';
          if (!merchantGroups[merchant]) {
            merchantGroups[merchant] = { total: 0, count: 0, transactions: [] };
          }
          merchantGroups[merchant].total += tx.amount;
          merchantGroups[merchant].count += 1;
          merchantGroups[merchant].transactions.push(tx);
        });
        
        console.log('\n📊 September 2025 by Merchant:');
        console.log('=' .repeat(40));
        Object.entries(merchantGroups)
          .sort(([,a], [,b]) => b.total - a.total)
          .forEach(([merchant, data]) => {
            console.log(`${merchant}: $${data.total.toFixed(2)} (${data.count} transactions)`);
          });
      } else {
        console.log('❌ No September 2025 transactions found');
      }
    }
    
    // Get all 2025 transactions by month
    console.log('\n📅 2025 TRANSACTIONS BY MONTH:');
    console.log('=' .repeat(40));
    
    const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    for (let i = 0; i < months.length; i++) {
      const month = months[i];
      const monthName = monthNames[i];
      
      const { data: monthTx, error: monthError } = await supabase
        .from('transactions')
        .select('amount')
        .eq('user_id', userId)
        .gte('date', `2025-${month}-01`)
        .lte('date', `2025-${month}-31`)
        .gt('amount', 0);
      
      if (!monthError && monthTx) {
        const total = monthTx.reduce((sum, tx) => sum + tx.amount, 0);
        const count = monthTx.length;
        console.log(`${monthName} 2025: $${total.toFixed(2)} (${count} transactions)`);
      }
    }
    
    // Get recent transactions (last 20)
    console.log('\n📅 MOST RECENT TRANSACTIONS:');
    console.log('=' .repeat(40));
    
    const { data: recentTx, error: recentError } = await supabase
      .from('transactions')
      .select('id, date, amount, merchant_name, ai_merchant_name, category, ai_category_tag, name')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(20);
    
    if (!recentError && recentTx) {
      recentTx.forEach((tx, index) => {
        const merchant = tx.ai_merchant_name || tx.merchant_name || tx.name || 'Unknown';
        const category = tx.ai_category_tag || tx.category || 'Unknown';
        console.log(`${index + 1}. ${tx.date}: ${merchant} (${category}) - $${tx.amount.toFixed(2)}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

showRealData();
