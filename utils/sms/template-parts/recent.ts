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
import { generate415pmSpecialMessage } from './daily-415pm';

export async function generateRecentTransactionsMessage(userId: string, force415pmReport: boolean = false): Promise<string> {
  try {
    // Check if this is being called from the 4:15 PM SMS system
    // If so, generate the comprehensive KREZZO REPORT
    if (force415pmReport) {
      // Generate comprehensive KREZZO REPORT for 4:15 PM
      return await generate415pmSpecialMessage(userId);
    }
    
    const stackTrace = new Error().stack || '';
    if (stackTrace.includes('send-415pm-sms') || stackTrace.includes('415pm-special')) {
      // Generate comprehensive KREZZO REPORT for 4:15 PM
      return await generate415pmSpecialMessage(userId);
    }

    // Get user's item IDs
    const { data: userItems } = await supabase
      .from('items')
      .select('plaid_item_id')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (!userItems || userItems.length === 0) {
      return "📱 RECENT ACTIVITY\n\nNo bank accounts connected.";
    }

    const itemIds = userItems.map(item => item.plaid_item_id);

    // Get yesterday's transactions
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    const { data: recentTransactions } = await supabase
      .from('transactions')
      .select('date, merchant_name, name, amount')
      .in('plaid_item_id', itemIds)
      .eq('date', yesterdayStr)
      .gt('amount', 0) // Only spending transactions
      .order('amount', { ascending: false }); // Most expensive first

    if (!recentTransactions || recentTransactions.length === 0) {
      return "📱 YESTERDAY'S ACTIVITY\n\nNo transactions yesterday.";
    }

    let message = "📱 YESTERDAY'S ACTIVITY\n\n";

    recentTransactions.forEach(transaction => {
      // Format date as 'Jul 15' for consistency
      const date = new Date(transaction.date + 'T12:00:00');
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const merchant = (transaction.merchant_name || transaction.name).substring(0, 18);
      const amount = transaction.amount.toFixed(2);
      
      message += `${dateStr}: ${merchant} - $${amount}\n`;
    });

    // Add total
    const total = recentTransactions.reduce((sum, t) => sum + t.amount, 0);
    message += `\n💰 Yesterday's Total: $${total.toFixed(2)}`;

    return message;

  } catch (error) {
    console.error('Error generating recent transactions message:', error);
    return "📱 YESTERDAY'S ACTIVITY\n\nError loading yesterday's transactions.";
  }
}

// ===================================
// 3. PACING ANALYSIS TEMPLATE
// ===================================
