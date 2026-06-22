import { supabase, type Transaction, type MerchantPacing } from './shared';
import {
  getUserFirstName,
  runEnhancedBillDetectionInTemplate,
  analyzeMerchantPatternForTemplate,
  isNonBillMerchant,
  calculateEnhancedBillScoreForTemplate,
  isBillMerchant,
  normalizeMerchantNameForTemplate,
  calculateVarianceForTemplate,
  findNextIncome,
  normalizeIncomeSourceName,
  generateAIVibeMessage,
  generateEnhancedAIVibeMessage,
  generateActionItems,
} from './helpers';

export async function generateOnboardingImmediateMessage(userId: string): Promise<string> {
  const firstName = await getUserFirstName(userId);
  
  return `🎉 Bank connected successfully${firstName ? `, ${firstName}` : ''}!

We're analyzing your last 30 days of transactions with AI. This takes about 60 seconds.

While that runs, here's what you can expect:
📱 Daily money insights at 8 AM
💳 Bill reminders before they're due  
📊 Spending pattern alerts
🤖 Smart merchant categorization

Reply "status" to check analysis progress.`;
}

/**
 * Analysis complete message with personalized insights
 */
export async function generateOnboardingAnalysisCompleteMessage(userId: string): Promise<string> {
  try {
    // Get user's item IDs for transactions
    const { data: userItems } = await supabase
      .from('items')
      .select('id, plaid_item_id')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (!userItems || userItems.length === 0) {
      return generateOnboardingAnalysisCompleteMessageFallback(userId);
    }

    // Get ALL transactions (no date filter for comprehensive analysis)
    const { data: transactions } = await supabase
      .from('transactions')
      .select('amount, date, ai_category_tag, ai_merchant_name, name, merchant_name, category')
      .in('plaid_item_id', userItems.map(item => item.plaid_item_id))
      .order('date', { ascending: false });

    // Get recurring bills detected
    const { data: bills } = await supabase
      .from('tagged_merchants')
      .select('merchant_name, expected_amount')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('expected_amount', { ascending: false })
      .limit(3);

    if (!transactions || transactions.length === 0) {
      return generateOnboardingAnalysisCompleteMessageFallback(userId);
    }

    // Run enhanced bill detection on the full transaction set
    const enhancedBills = runEnhancedBillDetectionInTemplate(transactions);

    // Analyze the COMPLETE transaction history
    const expenses = transactions.filter(t => (t.amount || 0) > 0); // Positive amounts are expenses in Plaid
    
    // Calculate date range for comprehensive analysis
    const dates = transactions.map(t => new Date(t.date)).sort((a, b) => a.getTime() - b.getTime());
    const earliestDate = dates[0];
    const latestDate = dates[dates.length - 1];
    const daysCovered = Math.ceil((latestDate.getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Total spending analysis
    const transactionCount = expenses.length;
    const totalSpending = expenses.reduce((sum, t) => sum + (t.amount || 0), 0);
    
    // Monthly average for context
    const monthsOfData = Math.max(1, daysCovered / 30.44);
    const averageMonthlySpending = totalSpending / monthsOfData;
    
    // Find top category
    const categorySpending: Record<string, number> = {};
    expenses.forEach(t => {
      const category = t.ai_category_tag || t.category || 'Other';
      categorySpending[category] = (categorySpending[category] || 0) + (t.amount || 0);
    });
    
    const topCategory = Object.entries(categorySpending)
      .sort(([,a], [,b]) => b - a)[0];

    // Find most frequent merchants with counts and totals
    const merchantData: Record<string, { count: number; total: number }> = {};
    expenses.forEach(t => {
      const merchant = t.ai_merchant_name || t.merchant_name || t.name || 'Unknown';
      if (!merchantData[merchant]) {
        merchantData[merchant] = { count: 0, total: 0 };
      }
      merchantData[merchant].count++;
      merchantData[merchant].total += (t.amount || 0);
    });
    
    const topMerchants = Object.entries(merchantData)
      .sort(([,a], [,b]) => b.count - a.count)
      .slice(0, 2);

    // Build comprehensive bills list from both sources
    const allDetectedBills: any[] = [];
    
    // Add existing tagged bills
    if (bills && bills.length > 0) {
      bills.forEach(bill => {
        allDetectedBills.push({
          name: bill.merchant_name,
          amount: Math.abs(bill.expected_amount),
          source: 'existing'
        });
      });
    }
    
    // Add enhanced detection bills (avoiding duplicates)
    enhancedBills.slice(0, 15).forEach(bill => { // Limit to top 15 for SMS length
      const normalizedName = bill.merchant.toLowerCase().trim();
      const isDuplicate = allDetectedBills.some(existing => 
        existing.name.toLowerCase().trim().includes(normalizedName) || 
        normalizedName.includes(existing.name.toLowerCase().trim())
      );
      
      if (!isDuplicate) {
        allDetectedBills.push({
          name: bill.merchant,
          amount: bill.averageAmount,
          source: 'enhanced'
        });
      }
    });
    
    // Sort by amount (highest first) and create display list
    const sortedBills = allDetectedBills
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 12); // Limit total display for SMS
    
    let billsText = '';
    if (sortedBills.length > 0) {
      billsText = sortedBills.map(bill => 
        `• ${bill.name}: $${Math.round(bill.amount)}`
      ).join('\n');
      
      if (allDetectedBills.length > sortedBills.length) {
        billsText += `\n• +${allDetectedBills.length - sortedBills.length} more...`;
      }
    } else {
      billsText = '• None detected yet (more data needed)';
    }

    // Create timeframe description
    function getTimeframeDescription(days: number): string {
      if (days <= 35) return `${days} days`;
      if (days <= 70) return `${Math.round(days / 7)} weeks`;
      if (days <= 120) return `${Math.round(days / 30.44)} months`;
      return `${Math.round(days / 365.25 * 10) / 10} years`;
    }
    
    const timeframeDesc = getTimeframeDescription(daysCovered);

    return `🔍 COMPREHENSIVE Analysis Complete!

Your ${timeframeDesc} history: ${transactionCount} transactions, $${totalSpending.toLocaleString()} total

📊 Top Category: ${topCategory?.[0] || 'Various'} ($${Math.round(topCategory?.[1] || 0).toLocaleString()})
🏪 Most Frequent: ${topMerchants[0]?.[0] || 'Various'} (${topMerchants[0]?.[1]?.count || 0}), ${topMerchants[1]?.[0] || 'Others'} (${topMerchants[1]?.[1]?.count || 0})

📋 DETECTED BILLS (${enhancedBills.length + (bills?.length || 0)} total):
${billsText}

🔧 Manage bills: https://get.krezzo.com/protected/recurring-bills

✅ Profile optimized with ${timeframeDesc} of data!`;

  } catch (error) {
    console.error('Error generating onboarding analysis message:', error);
    return generateOnboardingAnalysisCompleteMessageFallback(userId);
  }
}

/**
 * Fallback message when data isn't available
 */
export function generateOnboardingAnalysisCompleteMessageFallback(userId: string): string {
  return `✅ Analysis complete!

We've set up your account and are ready to start tracking your spending patterns.

Starting tomorrow at 8 AM, you'll get:
📊 Daily spending insights
💳 Bill reminders
🎯 Budget tracking
🤖 Smart categorization

Reply "help" for commands or visit your dashboard to explore!`;
}

/**
 * Day-before preparation message
 */
export async function generateOnboardingDayBeforeMessage(userId: string): Promise<string> {
  const firstName = await getUserFirstName(userId);
  
  return `🌅 Good evening${firstName ? `, ${firstName}` : ''}! Tomorrow at 8 AM you'll get your first daily money insight.

It will include:
• Yesterday's spending breakdown
• Upcoming bills this week
• Budget pacing for your top categories

You can change the time in your SMS preferences. Ready to take control of your finances? 💪

Reply STOP anytime to pause messages.`;
}

/**
 * Helper function to get user's first name
 */
