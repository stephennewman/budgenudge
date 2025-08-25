const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const userId = 'bc474c8b-4b47-4c7d-b202-f469330af2a2';

// ADF Classification Logic
function classifyForADF(tx) {
  const merchantName = tx.ai_merchant_name || tx.merchant_name || tx.name || '';
  const categoryTag = tx.ai_category_tag || '';
  const searchText = `${merchantName.toLowerCase()} ${categoryTag.toLowerCase()}`;
  
  const fixedKeywords = [
    'rent', 'mortgage', 'duke energy', 'verizon', 'at&t', 'utilities', 'insurance', 
    'car payment', 'loan', 'internet', 'cable', 'phone bill'
  ];
  
  const discretionaryKeywords = [
    'publix', 'walmart', 'target', 'grocery', 'starbucks', 'coffee', 'restaurant',
    'amazon', 'shopping', 'gas', 'fuel', 'circle k', 'entertainment'
  ];
  
  const isFixedExpense = fixedKeywords.some(k => searchText.includes(k));
  if (isFixedExpense) {
    return { expense_type: 'fixed_expense', adf_eligible: false, confidence: 85 };
  }
  
  const isDiscretionary = discretionaryKeywords.some(k => searchText.includes(k));
  if (isDiscretionary) {
    return { expense_type: 'discretionary', adf_eligible: true, confidence: 80 };
  }
  
  if (categoryTag.includes('subscription') && tx.amount < 50) {
    return { expense_type: 'discretionary', adf_eligible: true, confidence: 70 };
  }
  
  if (tx.amount > 200) {
    return { expense_type: 'fixed_expense', adf_eligible: false, confidence: 60 };
  }
  
  return { expense_type: 'discretionary', adf_eligible: true, confidence: 50 };
}

async function analyzeADF() {
  try {
    console.log(`🧪 Running ADF Analysis for Stephen (${userId})`);
    console.log('=' + '='.repeat(60));

    // Get connected accounts
    const { data: items } = await supabase
      .from('items')
      .select('plaid_item_id, institution_name')
      .eq('user_id', userId);

    if (!items || items.length === 0) {
      console.log('❌ No connected accounts found');
      return;
    }

    console.log(`🏦 Connected Accounts: ${items.length}`);
    items.forEach(item => console.log(`   • ${item.institution_name || 'Unknown Bank'}`));

    // Get last 90 days of transactions
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    const itemIds = items.map(item => item.plaid_item_id);
    
    const { data: transactions } = await supabase
      .from('transactions')
      .select('id, merchant_name, name, amount, ai_merchant_name, ai_category_tag, date')
      .in('plaid_item_id', itemIds)
      .gt('amount', 0) // Only expenses
      .gte('date', ninetyDaysAgo.toISOString().split('T')[0])
      .order('date', { ascending: false })
      .limit(500);

    if (!transactions || transactions.length === 0) {
      console.log('❌ No transactions found in last 90 days');
      return;
    }

    console.log(`\n💰 Analyzing ${transactions.length} transactions from last 90 days...\n`);

    // Classify each transaction
    let totalSpending = 0;
    let adfEligibleSpending = 0;
    let fixedExpenseSpending = 0;
    const adfTransactions = [];
    const fixedTransactions = [];

    transactions.forEach(tx => {
      const classification = classifyForADF(tx);
      totalSpending += tx.amount;
      
      if (classification.adf_eligible) {
        adfEligibleSpending += tx.amount;
        adfTransactions.push({ tx, classification });
      } else {
        fixedExpenseSpending += tx.amount;
        fixedTransactions.push({ tx, classification });
      }
    });

    // Calculate ADF metrics
    const adfDailyAverage = adfEligibleSpending / 90;
    const fixedDailyAverage = fixedExpenseSpending / 90;

    console.log('📊 ADF ANALYSIS RESULTS');
    console.log('=' + '='.repeat(23));
    console.log(`Total Spending (90 days): $${totalSpending.toFixed(2)}`);
    console.log(`Fixed Expenses: $${fixedExpenseSpending.toFixed(2)} (${((fixedExpenseSpending/totalSpending)*100).toFixed(1)}%)`);
    console.log(`ADF Discretionary: $${adfEligibleSpending.toFixed(2)} (${((adfEligibleSpending/totalSpending)*100).toFixed(1)}%)`);
    console.log(`\n💡 ADF Daily Average: $${adfDailyAverage.toFixed(2)}/day`);
    console.log(`🔒 Fixed Daily Average: $${fixedDailyAverage.toFixed(2)}/day`);

    // Top ADF merchants
    const merchantADF = new Map();
    adfTransactions.forEach(({tx}) => {
      const merchant = tx.ai_merchant_name || tx.merchant_name || 'Unknown';
      const existing = merchantADF.get(merchant) || { total: 0, count: 0 };
      merchantADF.set(merchant, {
        total: existing.total + tx.amount,
        count: existing.count + 1
      });
    });

    const topADFMerchants = Array.from(merchantADF.entries())
      .map(([merchant, data]) => ({
        merchant,
        total: data.total,
        daily_avg: data.total / 90,
        count: data.count
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    console.log(`\n🎯 TOP ADF OPPORTUNITIES (Controllable Spending):`);
    topADFMerchants.forEach((m, i) => {
      console.log(`${i+1}. ${m.merchant.padEnd(20)} | $${m.daily_avg.toFixed(2)}/day | $${m.total.toFixed(2)} total | ${m.count} transactions`);
    });

    // Sample classifications
    console.log(`\n🔍 SAMPLE TRANSACTION CLASSIFICATIONS:`);
    const sampleTransactions = [...adfTransactions.slice(0, 5), ...fixedTransactions.slice(0, 3)];
    sampleTransactions.forEach(({tx, classification}) => {
      const emoji = classification.adf_eligible ? '💰' : '🔒';
      const type = classification.adf_eligible ? 'ADF' : 'FIXED';
      const merchant = tx.ai_merchant_name || tx.merchant_name || 'Unknown';
      console.log(`${emoji} ${type} | $${tx.amount.toFixed(2).padStart(7)} | ${merchant.substring(0, 25)} | ${classification.confidence}%`);
    });

    console.log(`\n✨ KEY INSIGHT:`);
    console.log(`Your $${adfDailyAverage.toFixed(2)}/day ADF represents spending where behavior change`);
    console.log(`can create immediate impact! Focus optimization efforts here.`);

  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
  }
}

analyzeADF().then(() => process.exit(0));
