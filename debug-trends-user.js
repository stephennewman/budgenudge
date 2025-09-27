const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugTrendsUser() {
  try {
    console.log('🔍 Debugging trends API user data...\n');

    // Use the user ID we found
    const userId = 'bc474c8b-4b47-4c7d-b202-f469330af2a2';
    console.log(`👤 Using user: ${userId}`);

    // Get user's item IDs (same as trends API)
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('plaid_item_id')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (itemsError || !items?.length) {
      console.error('❌ No connected accounts found:', itemsError);
      return;
    }

    const itemIds = items.map(item => item.plaid_item_id);
    console.log(`🔗 Found ${itemIds.length} connected accounts:`, itemIds);

    // Fetch transactions exactly like trends API
    const { data: allTransactions, error: transactionsError } = await supabase
      .from('transactions')
      .select('id, amount, ai_merchant_name, ai_category_tag, merchant_name, name, date')
      .in('plaid_item_id', itemIds)
      .gt('amount', 0) // Only expenses (positive amounts in Plaid)
      .order('date', { ascending: true }); // Chronological order

    if (transactionsError) {
      console.error('❌ Error fetching transactions:', transactionsError);
      return;
    }

    console.log(`📊 Found ${allTransactions?.length || 0} transactions for this user`);

    if (allTransactions && allTransactions.length > 0) {
      // Show date range
      const firstDate = allTransactions[0].date;
      const lastDate = allTransactions[allTransactions.length - 1].date;
      console.log(`📅 Date range: ${firstDate} to ${lastDate}`);

      // Group by month
      const monthlyCounts = {};
      allTransactions.forEach(tx => {
        const month = tx.date.substring(0, 7); // YYYY-MM
        monthlyCounts[month] = (monthlyCounts[month] || 0) + 1;
      });

      console.log('\n📅 Transactions by month:');
      Object.entries(monthlyCounts).forEach(([month, count]) => {
        console.log(`  ${month}: ${count} transactions`);
      });

      // Show recent transactions
      console.log('\n📅 Most recent 10 transactions:');
      allTransactions.slice(-10).forEach(tx => {
        console.log(`  ${tx.date}: ${tx.ai_merchant_name || tx.merchant_name || tx.name} - $${tx.amount}`);
      });

      // Check for September 2025 specifically
      const september2025 = allTransactions.filter(tx => 
        tx.date >= '2025-09-01' && tx.date < '2025-10-01'
      );
      console.log(`\n📅 September 2025 transactions: ${september2025.length}`);
      
      if (september2025.length > 0) {
        console.log('First few September transactions:');
        september2025.slice(0, 5).forEach(tx => {
          console.log(`  ${tx.date}: ${tx.ai_merchant_name || tx.merchant_name || tx.name} - $${tx.amount}`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugTrendsUser();
