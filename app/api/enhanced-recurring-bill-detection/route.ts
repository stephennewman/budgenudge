import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function POST(request: NextRequest) {
  try {
    const { userId, preview = false } = await request.json();
    
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Get user's transaction data
    const { data: userItems } = await supabase
      .from('items')
      .select('plaid_item_id')
      .eq('user_id', userId)
      .is('deleted_at', null);
    
    if (!userItems || userItems.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No connected accounts found'
      });
    }
    
    // Get all expense transactions
    const { data: allTransactions, error: txError } = await supabase
      .from('transactions')
      .select('id, amount, date, name, merchant_name, ai_merchant_name, ai_category_tag, category')
      .in('plaid_item_id', userItems.map(item => item.plaid_item_id))
      .gt('amount', 0) // Only expenses
      .order('date', { ascending: false });
    
    if (txError || !allTransactions) {
      return NextResponse.json({
        success: false,
        error: `Transaction query failed: ${txError?.message || 'No transactions'}`
      });
    }
    
    // Run enhanced detection algorithm
    const detectedBills = runEnhancedBillDetection(allTransactions);
    
    // Get existing manually tagged bills for comparison
    const { data: existingBills } = await supabase
      .from('tagged_merchants')
      .select('merchant_name, expected_amount')
      .eq('user_id', userId);
    
    // Filter out bills that are already manually tagged
    const newBills = detectedBills.filter(detected => {
      return !existingBills?.some(existing => 
        normalizeString(existing.merchant_name) === normalizeString(detected.merchant)
      );
    });
    
    const alreadyTagged = detectedBills.filter(detected => {
      return existingBills?.some(existing => 
        normalizeString(existing.merchant_name) === normalizeString(detected.merchant)
      );
    });
    
    if (!preview && newBills.length > 0) {
      // Insert new bills into database
      const billsToInsert = newBills.map(bill => ({
        user_id: userId,
        merchant_name: bill.merchant,
        expected_amount: bill.averageAmount,
        frequency: bill.frequency,
        confidence_score: bill.confidenceScore,
        transaction_count: bill.transactionCount,
        last_amount: bill.lastAmount,
        last_transaction_date: bill.lastDate,
        amount_variance: bill.amountVariance,
        interval_variance: bill.intervalVariance,
        is_active: true,
        detection_method: 'enhanced_algorithm',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));
      
      const { error: insertError } = await supabase
        .from('tagged_merchants')
        .insert(billsToInsert);
      
      if (insertError) {
        console.error('❌ Failed to insert bills:', insertError);
      }
    }
    
    return NextResponse.json({
      success: true,
      userId: userId,
      preview: preview,
      results: {
        totalDetected: detectedBills.length,
        newBills: newBills.length,
        alreadyTagged: alreadyTagged.length,
        improvementRate: `${Math.round((detectedBills.length / (existingBills?.length || 1)) * 100)}%`
      },
      detectedBills: detectedBills.slice(0, 10), // Top 10 for preview
      newBills: newBills.slice(0, 10),
      alreadyTagged: alreadyTagged.slice(0, 5),
      algorithm: {
        version: '2.0',
        improvements: [
          'Lowered minimum transaction threshold from 5 to 2',
          'Added category-based scoring (Utilities, Subscription, etc.)',
          'Improved amount variance tolerance',
          'Enhanced merchant name matching',
          'Added interval pattern recognition'
        ]
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Enhanced bill detection error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Detection failed',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

function runEnhancedBillDetection(transactions: any[]): any[] {
  // Group transactions by merchant
  const merchantGroups: Record<string, any[]> = {};
  
  transactions.forEach(tx => {
    const merchant = normalizeMerchantName(tx.ai_merchant_name || tx.merchant_name || tx.name || 'Unknown');
    
    if (!merchantGroups[merchant]) {
      merchantGroups[merchant] = [];
    }
    merchantGroups[merchant].push(tx);
  });
  
  const detectedBills = [];
  
  for (const [merchant, txs] of Object.entries(merchantGroups)) {
    // Skip merchants with too few transactions (lowered threshold)
    if (txs.length < 2) continue;
    
    // 🆕 SMART FILTERING: Skip non-bill merchants
    if (isNonBillMerchant(merchant)) continue;
    
    // Sort by date
    const sortedTxs = txs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Analyze patterns
    const analysis = analyzeMerchantPattern(sortedTxs);
    
    // 🆕 ENHANCED SCORING: Bill-specific scoring
    const score = calculateEnhancedBillScore(analysis, txs.length, merchant);
    
    // 🆕 HIGHER THRESHOLD: Better quality detection (60+ instead of 50+)
    if (score >= 60) {
      detectedBills.push({
        merchant: merchant,
        transactionCount: txs.length,
        averageAmount: analysis.averageAmount,
        lastAmount: analysis.lastAmount,
        lastDate: analysis.lastDate,
        amountVariance: analysis.amountVariance,
        intervalVariance: analysis.intervalVariance,
        frequency: analysis.frequency,
        confidenceScore: score,
        category: txs[0]?.ai_category_tag || txs[0]?.category,
        recentTransactions: sortedTxs.slice(-3).map(tx => ({
          date: tx.date,
          amount: tx.amount,
          name: tx.name
        }))
      });
    }
  }
  
  // Sort by confidence score
  return detectedBills.sort((a, b) => b.confidenceScore - a.confidenceScore);
}

function analyzeMerchantPattern(transactions: any[]): any {
  const amounts = transactions.map(tx => tx.amount);
  const dates = transactions.map(tx => new Date(tx.date));
  
  // Calculate intervals
  const intervals = [];
  for (let i = 1; i < dates.length; i++) {
    const daysBetween = Math.round((dates[i].getTime() - dates[i-1].getTime()) / (1000 * 60 * 60 * 24));
    intervals.push(daysBetween);
  }
  
  const averageAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  const amountVariance = calculateVariance(amounts);
  const averageInterval = intervals.length > 0 ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 0;
  const intervalVariance = intervals.length > 1 ? calculateVariance(intervals) : 0;
  
  // Determine frequency
  let frequency = 'unknown';
  if (averageInterval >= 25 && averageInterval <= 35) frequency = 'monthly';
  else if (averageInterval >= 12 && averageInterval <= 16) frequency = 'biweekly';
  else if (averageInterval >= 6 && averageInterval <= 8) frequency = 'weekly';
  else if (averageInterval >= 85 && averageInterval <= 95) frequency = 'quarterly';
  
  return {
    averageAmount,
    lastAmount: amounts[amounts.length - 1],
    lastDate: dates[dates.length - 1].toISOString().split('T')[0],
    amountVariance,
    intervalVariance,
    averageInterval,
    frequency
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function calculateEnhancedScore(analysis: any): number {
  let score = 0;
  
  // Base transaction frequency score (0-25 points)
  const txCount = analysis.transactionCount || 0;
  if (txCount >= 6) score += 25;
  else if (txCount >= 4) score += 20;
  else if (txCount >= 3) score += 15;
  else if (txCount >= 2) score += 10; // NEW: Accept 2 transactions
  
  // Regularity score (0-30 points) - Enhanced patterns
  if (analysis.frequency === 'monthly') score += 30;
  else if (analysis.frequency === 'biweekly') score += 25;
  else if (analysis.frequency === 'weekly') score += 20;
  else if (analysis.frequency === 'quarterly') score += 25;
  else if (analysis.averageInterval > 15 && analysis.averageInterval < 45) score += 15; // Somewhat regular
  
  // Amount consistency score (0-25 points) - More lenient
  const varianceRatio = analysis.averageAmount > 0 ? analysis.amountVariance / analysis.averageAmount : 1;
  if (varianceRatio < 0.05) score += 25; // Very consistent
  else if (varianceRatio < 0.15) score += 20; // Somewhat consistent  
  else if (varianceRatio < 0.30) score += 15; // Variable but acceptable
  else if (varianceRatio < 0.50) score += 10; // HIGH: More lenient for utilities
  
  // Interval consistency score (0-20 points)
  if (analysis.intervalVariance < 5) score += 20; // Very regular timing
  else if (analysis.intervalVariance < 10) score += 15; // Somewhat regular
  else if (analysis.intervalVariance < 20) score += 10; // Variable timing
  
  return Math.round(score);
}

// 🆕 SMART MERCHANT FILTERING FUNCTIONS

function isNonBillMerchant(merchant: string): boolean {
  const nonBillKeywords = [
    // Travel & Vacation
    'vrbo', 'airbnb', 'booking', 'expedia', 'hotel', 'motel', 'inn', 'resort', 'travelocity',
    'kayak', 'priceline', 'orbitz', 'trip', 'vacation', 'cruise', 'airline', 'flights',
    
    // Retail & Shopping
    'amazon', 'target', 'walmart', 'costco', 'sams club', 'best buy', 'home depot', 'lowes',
    'macys', 'nordstrom', 'kohls', 'tj maxx', 'marshalls', 'ross', 'old navy', 'gap',
    
    // Groceries & Food
    'publix', 'kroger', 'safeway', 'whole foods', 'trader joe', 'aldi', 'wegmans', 'harris teeter',
    'food lion', 'giant', 'stop shop', 'wegmans', 'meijer', 'hy vee', 'winn dixie',
    'mcdonald', 'burger king', 'wendy', 'taco bell', 'kfc', 'subway', 'chipotle', 'panera',
    'starbucks', 'dunkin', 'coffee', 'restaurant', 'cafe', 'diner', 'pizza', 'domino',
    
    // Gas Stations
    'shell', 'exxon', 'bp', 'chevron', 'mobil', 'citgo', 'sunoco', 'marathon', 'speedway',
    'wawa', 'sheetz', 'race trac', 'circle k', '7-eleven', 'casey', 'quick trip',
    
    // Entertainment
    'movie', 'theater', 'cinema', 'amc', 'regal', 'dave buster', 'top golf', 'bowling',
    'theme park', 'six flags', 'disney', 'universal', 'zoo', 'museum', 'aquarium',
    
    // One-time Services
    'uber', 'lyft', 'taxi', 'parking', 'toll', 'venmo', 'paypal', 'zelle', 'cash app',
    'apple pay', 'google pay', 'atm withdrawal', 'check deposit', 'transfer',
    
    // Variable Shopping
    'etsy', 'ebay', 'facebook', 'instagram', 'social', 'marketplace', 'craigslist'
  ];
  
  const merchantLower = merchant.toLowerCase();
  return nonBillKeywords.some(keyword => merchantLower.includes(keyword));
}

function calculateEnhancedBillScore(analysis: any, txCount: number, merchant: string): number {
  let score = 0;
  
  // Bill-specific merchant bonus (0-20 points)
  if (isBillMerchant(merchant)) score += 20;
  
  // Transaction frequency score (0-25 points) - More strict for bills
  if (txCount >= 6) score += 25;
  else if (txCount >= 4) score += 20;
  else if (txCount >= 3) score += 15;
  else if (txCount >= 2) score += 8; // Lower for just 2 transactions
  
  // Regularity score (0-35 points) - Higher weight for bills
  if (analysis.frequency === 'monthly') score += 35;
  else if (analysis.frequency === 'quarterly') score += 30;
  else if (analysis.frequency === 'biweekly') score += 25;
  else if (analysis.frequency === 'weekly') score += 15; // Lower for weekly (less common for bills)
  else if (analysis.averageInterval > 25 && analysis.averageInterval < 40) score += 20; // Monthly-ish
  
  // Amount consistency score (0-25 points) - Strict for bills
  const varianceRatio = analysis.averageAmount > 0 ? analysis.amountVariance / analysis.averageAmount : 1;
  if (varianceRatio < 0.05) score += 25; // Very consistent
  else if (varianceRatio < 0.15) score += 20; // Mostly consistent
  else if (varianceRatio < 0.30) score += 15; // Somewhat variable (utilities)
  else if (varianceRatio < 0.50) score += 8;  // Variable (subscriptions with changes)
  
  // Amount range bonus (0-10 points) - Bills tend to be in certain ranges
  if (analysis.averageAmount >= 50) score += 10; // Substantial bills
  else if (analysis.averageAmount >= 20) score += 5; // Medium bills
  
  return Math.round(score);
}

function isBillMerchant(merchant: string): boolean {
  const billKeywords = [
    // Utilities
    'electric', 'energy', 'power', 'gas', 'water', 'sewer', 'utility', 'duke energy', 
    'pge', 'con ed', 'national grid', 'xcel energy', 'dte energy', 'commonwealth edison',
    
    // Internet/Cable/Phone
    'internet', 'cable', 'verizon', 'att', 'tmobile', 't-mobile', 'sprint', 'comcast', 
    'spectrum', 'cox', 'charter', 'dish', 'directv', 'xfinity', 'fios', 'optimum',
    
    // Insurance
    'insurance', 'geico', 'state farm', 'allstate', 'progressive', 'farmers', 'usaa',
    'liberty mutual', 'nationwide', 'aetna', 'blue cross', 'humana', 'kaiser', 'cigna',
    
    // Financial Services
    'loan', 'mortgage', 'credit', 'bank', 'chase', 'wells fargo', 'citi', 'capital one',
    'discover', 'american express', 'servicing', 'lending', 'finance', 'payment',
    
    // Subscriptions
    'netflix', 'hulu', 'disney', 'spotify', 'apple music', 'amazon prime', 'gym',
    'fitness', 'membership', 'subscription', 'monthly', 'annual', 'recurring',
    
    // Healthcare
    'medical', 'health', 'doctor', 'dental', 'vision', 'pharmacy', 'hospital', 'clinic',
    'urgent care', 'therapy', 'prescription', 'medicare', 'medicaid',
    
    // Education
    'tuition', 'school', 'university', 'college', 'student loan', 'education', 'learning',
    
    // Government/Taxes
    'tax', 'irs', 'dmv', 'license', 'registration', 'permit', 'fine', 'court', 'government',
    
    // Charity/Donations
    'donation', 'charity', 'church', 'temple', 'mosque', 'tithe', 'offering', 'compassion',
    'red cross', 'salvation army', 'goodwill', 'united way'
  ];
  
  const merchantLower = merchant.toLowerCase();
  return billKeywords.some(keyword => merchantLower.includes(keyword));
}

function normalizeMerchantName(name: string): string {
  return name.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ') // Remove special characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

function normalizeString(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function calculateVariance(numbers: number[]): number {
  if (numbers.length <= 1) return 0;
  const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
  const squaredDiffs = numbers.map(num => Math.pow(num - mean, 2));
  return squaredDiffs.reduce((a, b) => a + b, 0) / numbers.length;
}
