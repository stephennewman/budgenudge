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

// ===================================
// 1. RECURRING TRANSACTIONS TEMPLATE (DYNAMIC)
// ===================================
export async function generateRecurringTransactionsMessage(userId: string): Promise<string> {
  try {
    // Get user's item IDs
    const { data: userItems } = await supabase
      .from('items')
      .select('id, plaid_item_id')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (!userItems || userItems.length === 0) {
      return '💳 ANTICIPATED UPCOMING BILLS\n\nNo bank accounts connected.';
    }

    const itemDbIds = userItems.map(item => item.id);

    // Get user's account balances
    const { data: accounts } = await supabase
      .from('accounts')
      .select('name, type, subtype, current_balance, available_balance')
      .in('item_id', itemDbIds);

    // Calculate total available balance from checking/savings accounts only
    const checkingSavingsAccounts = accounts?.filter(acc => 
      acc.type === 'depository' && 
      (acc.subtype === 'checking' || acc.subtype === 'savings')
    ) || [];
    
    const totalAvailableBalance = checkingSavingsAccounts.reduce(
      (sum, acc) => sum + (acc.available_balance || 0), 
      0
    );

    // Fetch all active, upcoming recurring bills from tagged_merchants
    const { data: taggedMerchants, error } = await supabase
      .from('tagged_merchants')
      .select('merchant_name, expected_amount, next_predicted_date, confidence_score, prediction_frequency')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('next_predicted_date', { ascending: true });

    if (error) {
      console.error('Error fetching tagged merchants for SMS:', error);
      return '💳 ANTICIPATED UPCOMING BILLS\n\nError loading anticipated bills.';
    }

    const now = new Date();
    const upcoming = (taggedMerchants || []).filter(tm => {
      if (!tm.next_predicted_date) return false;
      const predictedDate = new Date(tm.next_predicted_date + 'T12:00:00');
      return predictedDate > now;
    });

    if (upcoming.length === 0) {
      return `💰 Available Balance: $${totalAvailableBalance.toFixed(2)}\n\n💳 ANTICIPATED UPCOMING BILLS\n\nNo upcoming bills predicted.`;
    }

    let message = `⭐ Anticipated Upcoming Bills\n${upcoming.length} upcoming\n\n`;
    upcoming.slice(0, 20).forEach(tm => {
      const date = new Date(tm.next_predicted_date + 'T12:00:00');
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const merchant = tm.merchant_name.substring(0, 18);
      const amount = `$${Number(tm.expected_amount).toFixed(2)}`;
      message += `${dateStr}: ${merchant} - ${amount}\n`;
    });

    // Calculate totals for next 7, 14, and 30 days
    const sumInDays = (days: number) => upcoming
      .filter(tm => {
        const date = new Date(tm.next_predicted_date + 'T12:00:00');
        return date > now && date <= new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      })
      .reduce((sum, tm) => sum + Number(tm.expected_amount), 0);
    const total7 = sumInDays(7);
    const total14 = sumInDays(14);
    const total30 = sumInDays(30);
    
    message += `\nNEXT 7 DAYS: $${total7.toFixed(2)}`;
    message += `\nNEXT 14 DAYS: $${total14.toFixed(2)}`;
    message += `\nNEXT 30 DAYS: $${total30.toFixed(2)}`;
    message += `\n\n💰 Available Balance: $${totalAvailableBalance.toFixed(2)}`;
    message += `\n\n⚠️ Predictions based on transaction history`;
    
    return message.trim();
  } catch (error) {
    console.error('Error generating recurring transactions message:', error);
    return '💳 ANTICIPATED UPCOMING BILLS\n\nError loading anticipated bills.';
  }
}

// ===================================
// 2. RECENT TRANSACTIONS TEMPLATE
// ===================================
