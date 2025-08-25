// Corrected ADF Analysis - Excluding Misclassified Merchants
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const userId = 'bc474c8b-4b47-4c7d-b202-f469330af2a2';

// Improved ADF Classification with Known Misclassifications
function classifyForADF(tx) {
  const merchantName = (tx.ai_merchant_name || tx.merchant_name || tx.name || '').toLowerCase();
  const categoryTag = (tx.ai_category_tag || '').toLowerCase();
  const amount = parseFloat(tx.amount);
  
  // Known misclassifications to exclude
  const knownMisclassifications = [
    'tectra inc',     // Software company, not restaurant
    'sparkfun',       // Electronics retailer, not restaurant  
  ];
  
  // Suspicious patterns to flag
  const suspiciousPatterns = [
    { merchant: 'kfc', amount: 500 },  // $500 at KFC is clearly wrong
  ];
  
  // Check for known misclassifications
  if (knownMisclassifications.some(bad => merchantName.includes(bad))) {
    console.log(`❌ EXCLUDING MISCLASSIFIED: ${merchantName} ($${amount}) tagged as ${categoryTag}`);
    return { type: 'MISCLASSIFIED', adf_eligible: false };
  }
  
  // Check for suspicious patterns
  if (suspiciousPatterns.some(pattern => 
    merchantName.includes(pattern.merchant) && amount >= pattern.amount)) {
    console.log(`⚠️  EXCLUDING SUSPICIOUS: ${merchantName} ($${amount}) - unusually high amount`);
    return { type: 'SUSPICIOUS', adf_eligible: false };
  }
  
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

async function analyzeCorrectedRestaurants() {
  try {
    console.log('🔍 Analyzing restaurant transactions (recent 30 days)...\n');
    
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select(`
        name,
        merchant_name, 
        ai_merchant_name,
        ai_category_tag,
        amount,
        date,
        items!inner(user_id)
      `)
      .eq('items.user_id', userId)
      .gt('amount', 0)
      .gte('date', '2025-07-02')
      .lte('date', '2025-08-01')
      .or('ai_category_tag.ilike.%restaurant%,ai_category_tag.ilike.%dining%')
      .order('amount', { ascending: false });

    if (error) {
      console.error('❌ Database error:', error);
      return;
    }

    console.log(`📊 Found ${transactions.length} restaurant-tagged transactions\n`);
    
    let realRestaurantTotal = 0;
    let excludedTotal = 0;
    const realRestaurants = [];
    
    transactions.forEach(tx => {
      const classification = classifyForADF(tx);
      
      if (classification.type === 'MISCLASSIFIED' || classification.type === 'SUSPICIOUS') {
        excludedTotal += parseFloat(tx.amount);
      } else if (classification.adf_eligible) {
        realRestaurantTotal += parseFloat(tx.amount);
        realRestaurants.push(tx);
      }
    });
    
    console.log('\n📈 CORRECTED RESTAURANT ANALYSIS:');
    console.log('=' .repeat(50));
    console.log(`❌ Excluded (misclassified): $${excludedTotal.toFixed(2)}`);
    console.log(`✅ Real restaurants: $${realRestaurantTotal.toFixed(2)}`);
    console.log(`📅 Daily restaurant ADF: $${(realRestaurantTotal / 30).toFixed(2)}/day`);
    
    console.log('\n🍽️  REAL RESTAURANT TRANSACTIONS (Top 10):');
    console.log('=' .repeat(50));
    realRestaurants.slice(0, 10).forEach(tx => {
      console.log(`${tx.ai_merchant_name || tx.merchant_name || tx.name}: $${tx.amount} (${tx.date})`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

analyzeCorrectedRestaurants();
