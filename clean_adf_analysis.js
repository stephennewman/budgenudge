// Clean ADF Analysis - ONLY Active Account Data
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const userId = 'bc474c8b-4b47-4c7d-b202-f469330af2a2';

// Clean ADF Classification 
function classifyForADF(tx) {
  const merchantName = (tx.ai_merchant_name || tx.merchant_name || tx.name || '').toLowerCase();
  const categoryTag = (tx.ai_category_tag || '').toLowerCase();
  
  // Fixed Expenses (excluded from ADF)
  const fixedKeywords = [
    'utilities', 'mortgage', 'lakeview loan', 'spectrum', 'p c utilities',
    'duke energy', 't-mobile', 'verizon', 'insurance', 'payment', 'autopay',
    'chase credit', 'fccu', 'mercantile solut'
  ];
  
  // Transfers/Other (excluded from ADF)  
  const transferKeywords = ['transfer', 'venmo', 'zelle', 'apple cash'];
  
  // Tithe/Charity (excluded from ADF)
  const charityKeywords = ['generations', 'compassion', 'tithe', 'charities'];
  
  if (fixedKeywords.some(k => merchantName.includes(k) || categoryTag.includes(k))) {
    return { type: 'FIXED_EXPENSE', adf_eligible: false };
  }
  
  if (transferKeywords.some(k => categoryTag.includes(k))) {
    return { type: 'TRANSFER', adf_eligible: false };
  }
  
  if (charityKeywords.some(k => merchantName.includes(k) || categoryTag.includes(k))) {
    return { type: 'CHARITY', adf_eligible: false };
  }
  
  // Everything else is discretionary (ADF eligible)
  return { type: 'DISCRETIONARY', adf_eligible: true };
}

async function analyzeCleanADF() {
  try {
    console.log('🔍 Fetching CLEAN transaction data (active accounts only)...\n');
    
    // Get transactions from ACTIVE accounts only
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select(`
        name,
        merchant_name, 
        ai_merchant_name,
        ai_category_tag,
        amount,
        date,
        items!inner(user_id, status)
      `)
      .eq('items.user_id', userId)
      .eq('items.status', 'good')  // ONLY active accounts
      .gt('amount', 0)
      .gte('date', '2025-07-02')
      .lte('date', '2025-08-01')
      .order('date', { ascending: false });

    if (error) {
      console.error('❌ Database error:', error);
      return;
    }

    console.log(`📊 Found ${transactions.length} clean transactions (30-day window)\n`);
    
    // Classify and analyze
    let totalADF = 0;
    let totalFixed = 0;
    let totalTransfers = 0;
    const adfByCategory = {};
    const adfByMerchant = {};
    
    transactions.forEach(tx => {
      const classification = classifyForADF(tx);
      const amount = parseFloat(tx.amount);
      
      if (classification.adf_eligible) {
        totalADF += amount;
        
        // Track by category
        const category = tx.ai_category_tag || 'Unknown';
        if (!adfByCategory[category]) adfByCategory[category] = 0;
        adfByCategory[category] += amount;
        
        // Track by merchant
        const merchant = tx.ai_merchant_name || tx.merchant_name || tx.name;
        if (!adfByMerchant[merchant]) adfByMerchant[merchant] = 0;
        adfByMerchant[merchant] += amount;
      } else if (classification.type === 'FIXED_EXPENSE') {
        totalFixed += amount;
      } else if (classification.type === 'TRANSFER') {
        totalTransfers += amount;
      }
    });
    
    const dailyADF = totalADF / 30;
    const totalSpending = totalADF + totalFixed + totalTransfers;
    
    console.log('📈 CLEAN ADF ANALYSIS (30-Day Window: 7/2 - 8/1):');
    console.log('=' .repeat(60));
    console.log(`Total Spending: $${totalSpending.toFixed(2)}`);
    console.log(`Fixed Expenses: $${totalFixed.toFixed(2)} (${(totalFixed/totalSpending*100).toFixed(1)}%)`);
    console.log(`Transfers: $${totalTransfers.toFixed(2)} (${(totalTransfers/totalSpending*100).toFixed(1)}%)`);
    console.log(`✅ ADF Spending: $${totalADF.toFixed(2)} (${(totalADF/totalSpending*100).toFixed(1)}%)`);
    console.log(`🎯 Daily ADF: $${dailyADF.toFixed(2)}/day`);
    
    console.log('\n🏷️  ADF BY CATEGORY:');
    console.log('=' .repeat(40));
    Object.entries(adfByCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .forEach(([category, amount]) => {
        const dailyAvg = amount / 30;
        console.log(`${category}: $${dailyAvg.toFixed(2)}/day ($${amount.toFixed(2)} total)`);
      });
    
    console.log('\n🏪 TOP ADF MERCHANTS:');
    console.log('=' .repeat(40));
    Object.entries(adfByMerchant)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([merchant, amount]) => {
        const dailyAvg = amount / 30;
        console.log(`${merchant}: $${dailyAvg.toFixed(2)}/day ($${amount.toFixed(2)} total)`);
      });
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

analyzeCleanADF();
