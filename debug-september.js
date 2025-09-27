const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugSeptemberData() {
  try {
    console.log('🔍 Debugging September 2025 data...\n');

    // Get all transactions from September 2025
    const { data: septemberTransactions, error: septError } = await supabase
      .from('transactions')
      .select('id, amount, ai_merchant_name, merchant_name, name, date, ai_category_tag')
      .gte('date', '2025-09-01')
      .lt('date', '2025-10-01')
      .gt('amount', 0)
      .order('date', { ascending: true });

    if (septError) {
      console.error('❌ Error fetching September transactions:', septError);
      return;
    }

    console.log(`📊 Found ${septemberTransactions?.length || 0} September 2025 transactions`);
    
    if (septemberTransactions && septemberTransactions.length > 0) {
      console.log('\n📅 September transactions:');
      septemberTransactions.forEach(tx => {
        console.log(`  ${tx.date}: ${tx.ai_merchant_name || tx.merchant_name || tx.name} - $${tx.amount}`);
      });
    } else {
      console.log('❌ No September 2025 transactions found');
    }

    // Check all transactions from 2025
    const { data: all2025Transactions, error: all2025Error } = await supabase
      .from('transactions')
      .select('id, amount, date, ai_merchant_name, merchant_name, name')
      .gte('date', '2025-01-01')
      .lt('date', '2026-01-01')
      .gt('amount', 0)
      .order('date', { ascending: true });

    if (all2025Error) {
      console.error('❌ Error fetching 2025 transactions:', all2025Error);
      return;
    }

    console.log(`\n📊 Found ${all2025Transactions?.length || 0} total 2025 transactions`);
    
    if (all2025Transactions && all2025Transactions.length > 0) {
      // Group by month
      const monthlyCounts = {};
      all2025Transactions.forEach(tx => {
        const month = tx.date.substring(0, 7); // YYYY-MM
        monthlyCounts[month] = (monthlyCounts[month] || 0) + 1;
      });

      console.log('\n📅 2025 transactions by month:');
      Object.entries(monthlyCounts).forEach(([month, count]) => {
        console.log(`  ${month}: ${count} transactions`);
      });

      // Show recent transactions
      console.log('\n📅 Most recent 10 transactions:');
      all2025Transactions.slice(-10).forEach(tx => {
        console.log(`  ${tx.date}: ${tx.ai_merchant_name || tx.merchant_name || tx.name} - $${tx.amount}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugSeptemberData();
