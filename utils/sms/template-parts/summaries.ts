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

export async function generateWeeklySpendingSummaryMessage(userId: string): Promise<string> {
  try {
    // Get user's item IDs
    const { data: userItems } = await supabase
      .from('items')
      .select('id, plaid_item_id')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (!userItems || userItems.length === 0) {
      return '📊 WEEKLY SPENDING SUMMARY\n\nNo bank accounts connected.';
    }

    const itemDbIds = userItems.map(item => item.id);
    const itemIds = userItems.map(item => item.plaid_item_id);

    // Get user's account balances
    const { data: accounts } = await supabase
      .from('accounts')
      .select('name, type, current_balance, available_balance')
      .in('item_id', itemDbIds);

    // Calculate total available balance from depository accounts
    const depositoryAccounts = accounts?.filter(acc => acc.type === 'depository') || [];
    const totalAvailableBalance = depositoryAccounts.reduce(
      (sum, acc) => sum + (acc.available_balance || 0), 
      0
    );

    // Calculate calendar week boundaries (Sunday-Saturday)
    const now = new Date();
    const currentSunday = new Date(now);
    currentSunday.setDate(now.getDate() - now.getDay()); // Go back to Sunday
    currentSunday.setHours(0, 0, 0, 0);
    
    const lastSaturday = new Date(currentSunday);
    lastSaturday.setDate(currentSunday.getDate() - 1); // Previous Saturday
    lastSaturday.setHours(23, 59, 59, 999);
    
    const lastSunday = new Date(lastSaturday);
    lastSunday.setDate(lastSaturday.getDate() - 6); // Previous Sunday
    lastSunday.setHours(0, 0, 0, 0);

    // Get last week's transactions (Sunday-Saturday)
    const lastWeekStart = lastSunday.toISOString().split('T')[0];
    const lastWeekEnd = lastSaturday.toISOString().split('T')[0];

    const { data: lastWeekTransactions } = await supabase
      .from('transactions')
      .select('date, merchant_name, name, amount, ai_category_tag, ai_merchant_name')
      .in('plaid_item_id', itemIds)
      .gte('date', lastWeekStart)
      .lte('date', lastWeekEnd)
      .gt('amount', 0) // Only spending transactions
      .order('amount', { ascending: false });

    // Get previous week for comparison (2 weeks ago)
    const twoWeeksAgoSunday = new Date(lastSunday);
    twoWeeksAgoSunday.setDate(lastSunday.getDate() - 7);
    const twoWeeksAgoSaturday = new Date(lastSaturday);
    twoWeeksAgoSaturday.setDate(lastSaturday.getDate() - 7);

    const { data: prevWeekTransactions } = await supabase
      .from('transactions')
      .select('amount')
      .in('plaid_item_id', itemIds)
      .gte('date', twoWeeksAgoSunday.toISOString().split('T')[0])
      .lte('date', twoWeeksAgoSaturday.toISOString().split('T')[0])
      .gt('amount', 0);

    const lastWeekTotal = lastWeekTransactions?.reduce((sum, t) => sum + t.amount, 0) || 0;
    const prevWeekTotal = prevWeekTransactions?.reduce((sum, t) => sum + t.amount, 0) || 0;
    const weekOverWeekChange = lastWeekTotal - prevWeekTotal;
    const weekOverWeekPercent = prevWeekTotal > 0 ? ((weekOverWeekChange / prevWeekTotal) * 100) : 0;

    // Format week dates for display
    const weekDateRange = `${lastSunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${lastSaturday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

    let message = `📊 WEEKLY SPENDING SUMMARY\n${weekDateRange}\n\n`;
    message += `💰 Available Balance: $${totalAvailableBalance.toFixed(2)}\n\n`;

    if (!lastWeekTransactions || lastWeekTransactions.length === 0) {
      message += `🎉 Zero spending last week!\n\nNo transactions found for the week of ${weekDateRange}.`;
      return message;
    }

    // Week overview
    message += `💳 Total Spent: $${lastWeekTotal.toFixed(2)}\n`;
    message += `📈 Transactions: ${lastWeekTransactions.length}\n`;
    
    // Week-over-week comparison
    if (prevWeekTotal > 0) {
      const changeIcon = weekOverWeekChange > 0 ? '📈' : weekOverWeekChange < 0 ? '📉' : '➡️';
      const changeText = weekOverWeekChange > 0 ? 'more' : 'less';
      message += `${changeIcon} ${Math.abs(weekOverWeekPercent).toFixed(0)}% ${changeText} than prev week\n\n`;
    } else {
      message += '\n';
    }

    // Top spending categories
    const categoryTotals = new Map<string, number>();
    lastWeekTransactions.forEach(t => {
      const category = t.ai_category_tag || 'Uncategorized';
      categoryTotals.set(category, (categoryTotals.get(category) || 0) + t.amount);
    });

    const topCategories = Array.from(categoryTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    if (topCategories.length > 0) {
      message += `🏷️ Top Categories:\n`;
      topCategories.forEach(([category, amount], index) => {
        const percentage = ((amount / lastWeekTotal) * 100).toFixed(0);
        message += `${index + 1}. ${category}: $${amount.toFixed(2)} (${percentage}%)\n`;
      });
      message += '\n';
    }

    // Top merchants
    const merchantTotals = new Map<string, number>();
    lastWeekTransactions.forEach(t => {
      const merchant = t.ai_merchant_name || t.merchant_name || t.name || 'Unknown';
      merchantTotals.set(merchant, (merchantTotals.get(merchant) || 0) + t.amount);
    });

    const topMerchants = Array.from(merchantTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);

    if (topMerchants.length > 0) {
      message += `🏪 Top Merchants:\n`;
      topMerchants.forEach(([merchant, amount], index) => {
        const shortMerchant = merchant.length > 16 ? merchant.substring(0, 13) + '...' : merchant;
        message += `${index + 1}. ${shortMerchant}: $${amount.toFixed(2)}\n`;
      });
      message += '\n';
    }

    // Daily breakdown
    const dailyTotals = new Map<string, number>();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    lastWeekTransactions.forEach(t => {
      const date = new Date(t.date + 'T12:00:00');
      const dayName = dayNames[date.getDay()];
      dailyTotals.set(dayName, (dailyTotals.get(dayName) || 0) + t.amount);
    });

    message += `📅 Daily Breakdown:\n`;
    dayNames.forEach(day => {
      const amount = dailyTotals.get(day) || 0;
      if (amount > 0) {
        message += `${day}: $${amount.toFixed(2)}  `;
      }
    });

    return message.trim();

  } catch (error) {
    console.error('Error generating weekly spending summary:', error);
    return '📊 WEEKLY SPENDING SUMMARY\n\nError loading weekly spending data.';
  }
}

// ===================================
// 7. MONTHLY SPENDING SUMMARY TEMPLATE (NEW)
// ===================================
export async function generateMonthlySpendingSummaryMessage(userId: string): Promise<string> {
  try {
    // Get user's item IDs
    const { data: userItems } = await supabase
      .from('items')
      .select('id, plaid_item_id')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (!userItems || userItems.length === 0) {
      return '📊 MONTHLY SPENDING SUMMARY\n\nNo bank accounts connected.';
    }

    const itemDbIds = userItems.map(item => item.id);
    const itemIds = userItems.map(item => item.plaid_item_id);

    // Get user's account balances
    const { data: accounts } = await supabase
      .from('accounts')
      .select('name, type, current_balance, available_balance')
      .in('item_id', itemDbIds);

    // Calculate total available balance from depository accounts
    const depositoryAccounts = accounts?.filter(acc => acc.type === 'depository') || [];
    const totalAvailableBalance = depositoryAccounts.reduce(
      (sum, acc) => sum + (acc.available_balance || 0), 
      0
    );

    // Calculate month boundaries using local dates and exclusive upper bounds to avoid timezone issues
    const now = new Date();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1); // start of last month (local)
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1); // start of current month (local)
    // For comparison window: month before last (two months ago)
    const twoMonthsAgoStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const lastMonthStartForComparison = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Local YYYY-MM-DD formatter to avoid UTC date shifting
    const formatLocalDate = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    // Get previous month's transactions (inclusive start, exclusive next-month start)
    const lastMonthStartStr = formatLocalDate(lastMonthStart);
    const thisMonthStartStr = formatLocalDate(thisMonthStart);

    const { data: lastMonthTransactions } = await supabase
      .from('transactions')
      .select('date, merchant_name, name, amount, ai_category_tag, ai_merchant_name')
      .in('plaid_item_id', itemIds)
      .gte('date', lastMonthStartStr)
      .lt('date', thisMonthStartStr)
      .eq('pending', false) // Only posted transactions
      .gt('amount', 0) // Only spending transactions
      .order('amount', { ascending: false });

    // Get month before last for comparison (inclusive start, exclusive end at lastMonthStart)
    const twoMonthsAgoStartStr = formatLocalDate(twoMonthsAgoStart);
    const lastMonthStartStrForComparison = formatLocalDate(lastMonthStartForComparison);

    const { data: twoMonthsAgoTransactions } = await supabase
      .from('transactions')
      .select('amount')
      .in('plaid_item_id', itemIds)
      .gte('date', twoMonthsAgoStartStr)
      .lt('date', lastMonthStartStrForComparison)
      .eq('pending', false)
      .gt('amount', 0);

    const lastMonthTotal = lastMonthTransactions?.reduce((sum, t) => sum + t.amount, 0) || 0;
    const twoMonthsAgoTotal = twoMonthsAgoTransactions?.reduce((sum, t) => sum + t.amount, 0) || 0;
    const monthOverMonthChange = lastMonthTotal - twoMonthsAgoTotal;
    const monthOverMonthPercent = twoMonthsAgoTotal > 0 ? ((monthOverMonthChange / twoMonthsAgoTotal) * 100) : 0;

    // Format month name for display
    const monthName = lastMonthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    let message = `📊 MONTHLY SPENDING SUMMARY\n${monthName}\n\n`;
    message += `💰 Current Balance: $${totalAvailableBalance.toFixed(2)}\n\n`;

    if (!lastMonthTransactions || lastMonthTransactions.length === 0) {
      message += `🎉 Zero spending in ${monthName}!\n\nNo transactions found for the month.`;
      return message;
    }

    // Month overview
    message += `💳 Total Spent: $${lastMonthTotal.toFixed(2)}\n`;
    message += `📈 Transactions: ${lastMonthTransactions.length}\n`;
    
    // Month-over-month comparison
    if (twoMonthsAgoTotal > 0) {
      const changeIcon = monthOverMonthChange > 0 ? '📈' : monthOverMonthChange < 0 ? '📉' : '➡️';
      const changeText = monthOverMonthChange > 0 ? 'more' : 'less';
      message += `${changeIcon} ${Math.abs(monthOverMonthPercent).toFixed(0)}% ${changeText} than prev month\n\n`;
    } else {
      message += '\n';
    }

    // Top spending categories
    const categoryTotals = new Map<string, number>();
    lastMonthTransactions.forEach(t => {
      const category = t.ai_category_tag || 'Uncategorized';
      categoryTotals.set(category, (categoryTotals.get(category) || 0) + t.amount);
    });

    const topCategories = Array.from(categoryTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);

    if (topCategories.length > 0) {
      message += `🏷️ Top Categories:\n`;
      topCategories.forEach(([category, amount], index) => {
        const percentage = ((amount / lastMonthTotal) * 100).toFixed(0);
        message += `${index + 1}. ${category}: $${amount.toFixed(0)} (${percentage}%)\n`;
      });
      message += '\n';
    }

    // Top merchants
    const merchantTotals = new Map<string, number>();
    lastMonthTransactions.forEach(t => {
      const merchant = t.ai_merchant_name || t.merchant_name || t.name || 'Unknown';
      merchantTotals.set(merchant, (merchantTotals.get(merchant) || 0) + t.amount);
    });

    const topMerchants = Array.from(merchantTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);

    if (topMerchants.length > 0) {
      message += `🏪 Top Merchants:\n`;
      topMerchants.forEach(([merchant, amount], index) => {
        const shortMerchant = merchant.length > 14 ? merchant.substring(0, 11) + '...' : merchant;
        message += `${index + 1}. ${shortMerchant}: $${amount.toFixed(0)}\n`;
      });
      message += '\n';
    }

    // Weekly breakdown within the month
    const weeklyTotals = new Map<number, number>();
    lastMonthTransactions.forEach(t => {
      const date = new Date(t.date + 'T12:00:00');
      const weekOfMonth = Math.ceil(date.getDate() / 7);
      weeklyTotals.set(weekOfMonth, (weeklyTotals.get(weekOfMonth) || 0) + t.amount);
    });

    message += `📅 Weekly Breakdown:\n`;
    for (let week = 1; week <= 5; week++) {
      const amount = weeklyTotals.get(week) || 0;
      if (amount > 0) {
        message += `Week ${week}: $${amount.toFixed(0)}  `;
      }
    }

    // Daily average (use days in the last month via Date arithmetic without relying on UTC conversion)
    const daysInMonth = new Date(lastMonthStart.getFullYear(), lastMonthStart.getMonth() + 1, 0).getDate();
    const dailyAverage = lastMonthTotal / daysInMonth;
    message += `\n\n📊 Daily Average: $${dailyAverage.toFixed(0)}`;

    return message.trim();

  } catch (error) {
    console.error('Error generating monthly spending summary:', error);
    return '📊 MONTHLY SPENDING SUMMARY\n\nError loading monthly spending data.';
  }
}

// ===================================
// 8. CASH FLOW RUNWAY (NEW DAILY 5PM)
// ===================================
