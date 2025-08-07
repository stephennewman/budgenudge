import { createClient } from '@supabase/supabase-js';
import { generateSMSMessageForUser } from './paycheck-templates';

// Create Supabase client for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Transaction {
  id: string;
  date: string;
  merchant_name?: string;
  name: string;
  amount: number;
  category?: string[];
}

interface MerchantPacing {
  merchant: string;
  currentMonthSpend: number;
  avgMonthlySpend: number;
  pacingPercentage: number;
  daysIntoMonth: number;
  expectedSpendToDate: number;
}

// ===================================
// 1. RECURRING TRANSACTIONS TEMPLATE (DYNAMIC)
// ===================================
export async function generateRecurringTransactionsMessage(userId: string): Promise<string> {
  try {
    // Get user's item IDs
    const { data: userItems } = await supabase
      .from('items')
      .select('id, plaid_item_id')
      .eq('user_id', userId);

    if (!userItems || userItems.length === 0) {
      return '💳 RECURRING BILLS\n\nNo bank accounts connected.';
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
    
    // Debug logging to see what accounts are being included
    console.log('🔍 Recurring bills - Available balance calculation:');
    console.log('All accounts:', accounts?.map(acc => ({ name: acc.name, type: acc.type, subtype: acc.subtype, balance: acc.available_balance })));
    console.log('Filtered accounts:', checkingSavingsAccounts?.map(acc => ({ name: acc.name, type: acc.type, subtype: acc.subtype, balance: acc.available_balance })));
    
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
      return '💳 RECURRING BILLS\n\nError loading recurring bills.';
    }

    const now = new Date();
    const upcoming = (taggedMerchants || []).filter(tm => {
      if (!tm.next_predicted_date) return false;
      const predictedDate = new Date(tm.next_predicted_date + 'T12:00:00');
      return predictedDate > now;
    });

    if (upcoming.length === 0) {
      return `💰 Available Balance: $${totalAvailableBalance.toFixed(2)}\n\n💳 RECURRING BILLS\n\nNo upcoming recurring bills found.`;
    }

    let message = `⭐ Recurring Bills\n${upcoming.length} upcoming\n\n`;
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
    return '💳 RECURRING BILLS\n\nError loading recurring bills.';
  }
}

// ===================================
// 2. RECENT TRANSACTIONS TEMPLATE
// ===================================
export async function generateRecentTransactionsMessage(userId: string): Promise<string> {
  try {
    // Get user's item IDs
    const { data: userItems } = await supabase
      .from('items')
      .select('plaid_item_id')
      .eq('user_id', userId);

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
export async function generatePacingAnalysisMessage(userId: string): Promise<string> {
  try {
    // Get user's item IDs
    const { data: userItems } = await supabase
      .from('items')
      .select('plaid_item_id')
      .eq('user_id', userId);

    if (!userItems || userItems.length === 0) {
      return "📊 SPENDING PACING\n\nNo bank accounts connected.";
    }

    const itemIds = userItems.map(item => item.plaid_item_id);
    const targetMerchants = ['Amazon', 'Publix', 'Walmart'];
    
    // ✅ FIX: Use yesterday's date for pacing calculations to account for transaction lag
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const currentMonth = yesterday.getMonth() + 1;
    const currentYear = yesterday.getFullYear();
    const dayOfMonth = yesterday.getDate();
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const monthProgress = (dayOfMonth / daysInMonth) * 100;

    let pacingResults: MerchantPacing[] = [];

    for (const targetMerchant of targetMerchants) {
      // Get all historical transactions for this merchant
      const { data: allTxns } = await supabase
        .from('transactions')
        .select('amount, date')
        .in('plaid_item_id', itemIds)
        .or(`merchant_name.ilike.%${targetMerchant}%,name.ilike.%${targetMerchant}%`)
        .gt('amount', 0);

      if (allTxns && allTxns.length > 0) {
        // Calculate total spend and total days of data
        const totalSpend = allTxns.reduce((sum, t) => sum + t.amount, 0);
        const dates = allTxns.map(t => new Date(t.date));
        const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
        const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
        // Add 1 to include both endpoints
        const totalDays = Math.max(1, Math.floor((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
        const avgDailySpend = totalSpend / totalDays;
        const avgMonthlySpend = avgDailySpend * 30;

        // Get this month's spending (through yesterday)
        const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        const { data: currentMonthTxns } = await supabase
          .from('transactions')
          .select('amount')
          .in('plaid_item_id', itemIds)
          .or(`merchant_name.ilike.%${targetMerchant}%,name.ilike.%${targetMerchant}%`)
          .gte('date', firstDayOfMonth.toISOString().split('T')[0])
          .lte('date', yesterdayStr)
          .gt('amount', 0);
        const currentMonthSpend = currentMonthTxns?.reduce((sum, t) => sum + t.amount, 0) || 0;

        // Calculate expected spend to date
        const expectedSpendToDate = avgMonthlySpend * (dayOfMonth / 30);
        const pacingPercentage = expectedSpendToDate > 0 ? (currentMonthSpend / expectedSpendToDate) * 100 : 0;

        pacingResults.push({
          merchant: targetMerchant,
          currentMonthSpend,
          avgMonthlySpend,
          pacingPercentage,
          daysIntoMonth: dayOfMonth,
          expectedSpendToDate
        });
      }
    }

    if (pacingResults.length === 0) {
      const monthName = yesterday.toLocaleDateString('en-US', { month: 'long' });
      return `📊 SPENDING PACING\n${monthName} ${currentYear}\n\nNo spending data found for Amazon, Publix, or Walmart.`;
    }

    const monthName = yesterday.toLocaleDateString('en-US', { month: 'long' });
    let message = `📊 SPENDING PACING\n${monthName} ${currentYear}\nMonth Progress: ${monthProgress.toFixed(0)}% (Day ${dayOfMonth})\n\n`;

    pacingResults.forEach(pacing => {
      let status = '';
      let icon = '';
      if (pacing.pacingPercentage < 90) {
        status = 'Ahead of pace';
        icon = '🟢';
      } else if (pacing.pacingPercentage <= 110) {
        status = 'On track';
        icon = '🟡';
      } else {
        status = 'Overspending';
        icon = '🔴';
      }
      message += `${icon} ${pacing.merchant}:\n`;
      message += `   Month to date: $${pacing.currentMonthSpend.toFixed(2)}\n`;
      message += `   Expected by now: $${pacing.expectedSpendToDate.toFixed(2)}\n`;
      message += `   Avg monthly: $${pacing.avgMonthlySpend.toFixed(2)}\n`;
      message += `   Pacing: ${pacing.pacingPercentage.toFixed(0)}%\n`;
      message += `   Status: ${status}\n\n`;
    });

    return message.trim();

  } catch (error) {
    console.error('Error generating pacing analysis message:', error);
    return "📊 SPENDING PACING\n\nError analyzing spending patterns.";
  }
}

// ===================================
// 4. MERCHANT PACING TEMPLATE (NEW)
// ===================================
export async function generateMerchantPacingMessage(userId: string): Promise<string> {
  try {
    // Get user's tracked merchants
    const { data: trackedMerchants, error: trackingError } = await supabase
      .from('merchant_pacing_tracking')
      .select('ai_merchant_name')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (trackingError) {
      console.error('Error fetching tracked merchants for SMS:', trackingError);
      return '📊 MERCHANT PACING\n\nError loading tracked merchants.';
    }

    if (!trackedMerchants || trackedMerchants.length === 0) {
      return '📊 MERCHANT PACING\n\nNo merchants are being tracked for pacing analysis.';
    }

    // Get user's item IDs
    const { data: userItems } = await supabase
      .from('items')
      .select('plaid_item_id')
      .eq('user_id', userId);

    if (!userItems || userItems.length === 0) {
      return '📊 MERCHANT PACING\n\nNo bank accounts connected.';
    }

    const itemIds = userItems.map(item => item.plaid_item_id);
    
    // ✅ FIX: Use yesterday's date for pacing calculations to account for transaction lag
    // DEBUG: Merchant pacing - Aug 1st should show July 2025, not August 2025
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const currentMonth = yesterday.getMonth() + 1;
    const currentYear = yesterday.getFullYear();
    const dayOfMonth = yesterday.getDate();
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const monthProgress = (dayOfMonth / daysInMonth) * 100;

    let message = `📊 MERCHANT PACING\n${yesterday.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}\nMonth Progress: ${monthProgress.toFixed(0)}% (Day ${dayOfMonth})\n\n`;

    const merchantNames = trackedMerchants.map(t => t.ai_merchant_name);
    let processedCount = 0;

    for (const merchantName of merchantNames) {
      // Check message length limit (918 chars) - allow ~120 chars per merchant
      if (message.length > 780) break; // Leave room for current merchant

      // Get all historical transactions for this merchant
      const { data: allTxns } = await supabase
        .from('transactions')
        .select('amount, date')
        .in('plaid_item_id', itemIds)
        .eq('ai_merchant_name', merchantName)
        .gt('amount', 0);

      if (allTxns && allTxns.length > 0) {
        // Calculate total spend and average monthly spending
        const totalSpend = allTxns.reduce((sum, t) => sum + t.amount, 0);
        const dates = allTxns.map(t => new Date(t.date));
        const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
        const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
        const totalDays = Math.max(1, Math.floor((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
        const avgDailySpend = totalSpend / totalDays;
        const avgMonthlySpend = avgDailySpend * 30;

        // Get this month's spending (through yesterday)
        const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        const { data: currentMonthTxns } = await supabase
          .from('transactions')
          .select('amount')
          .in('plaid_item_id', itemIds)
          .eq('ai_merchant_name', merchantName)
          .gte('date', firstDayOfMonth.toISOString().split('T')[0])
          .lte('date', yesterdayStr)
          .gt('amount', 0);
        
        const currentMonthSpend = currentMonthTxns?.reduce((sum, t) => sum + t.amount, 0) || 0;

        // Calculate pacing
        const expectedSpendToDate = avgMonthlySpend * (dayOfMonth / 30);
        const pacingPercentage = expectedSpendToDate > 0 ? (currentMonthSpend / expectedSpendToDate) * 100 : 0;

        // Determine status and icon
        let status = '';
        let icon = '';
        if (pacingPercentage < 90) {
          status = 'Under pace';
          icon = '🟢';
        } else if (pacingPercentage <= 110) {
          status = 'On track';
          icon = '🟡';
        } else {
          status = 'Over pace';
          icon = '🔴';
        }

        message += `${icon} ${merchantName}:\n`;
        message += `   Month to date: $${currentMonthSpend.toFixed(2)}\n`;
        message += `   Expected by now: $${expectedSpendToDate.toFixed(2)}\n`;
        message += `   Avg monthly: $${avgMonthlySpend.toFixed(2)}\n`;
        message += `   Pacing: ${pacingPercentage.toFixed(0)}%\n`;
        message += `   Status: ${status}\n\n`;

        processedCount++;
      }
    }

    if (processedCount === 0) {
      return `📊 MERCHANT PACING\n${yesterday.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}\n\nNo spending data found for tracked merchants.`;
    }

    message += `\n\n⚠️ Predictions based on historical spending patterns`;
    
    return message.trim();

  } catch (error) {
    console.error('Error generating merchant pacing message:', error);
    return '📊 MERCHANT PACING\n\nError analyzing merchant spending patterns.';
  }
}

// ===================================
// 5. CATEGORY PACING TEMPLATE (NEW)
// ===================================
export async function generateCategoryPacingMessage(userId: string): Promise<string> {
  try {
    // Get user's tracked categories
    const { data: trackedCategories, error: trackingError } = await supabase
      .from('category_pacing_tracking')
      .select('ai_category')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (trackingError) {
      console.error('Error fetching tracked categories:', trackingError);
      return "📱 Krezzo\n\nError loading category pacing data.";
    }

    if (!trackedCategories || trackedCategories.length === 0) {
      return "📱 Krezzo\n\n📊 CATEGORY PACING\n\nNo categories selected for tracking.\nConfigure on AI Category Analysis page.";
    }

    // Get user's Plaid items
    const { data: items } = await supabase
      .from('items')
      .select('plaid_item_id')
      .eq('user_id', userId);

    const itemIds = items?.map(item => item.plaid_item_id) || [];
    if (itemIds.length === 0) {
      return "📱 Krezzo\n\n📊 CATEGORY PACING\n\nNo accounts connected.";
    }

    // ✅ FIX: Use yesterday's date for pacing calculations to account for transaction lag
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const currentYear = yesterday.getFullYear();
    const currentMonth = yesterday.getMonth() + 1;
    const dayOfMonth = yesterday.getDate();
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const monthProgress = Math.round((dayOfMonth / daysInMonth) * 100);

    // Get transactions for tracked categories (last 3 months for analysis)
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const analysisStartDate = `${threeMonthsAgo.getFullYear()}-${String(threeMonthsAgo.getMonth() + 1).padStart(2, '0')}-01`;
    const currentMonthStart = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const trackedCategoryNames = trackedCategories.map(t => t.ai_category);

    const { data: transactions } = await supabase
      .from('transactions')
      .select('amount, ai_category_tag, date')
      .in('plaid_item_id', itemIds)
      .gte('amount', 0)
      .gte('date', analysisStartDate)
      .in('ai_category_tag', trackedCategoryNames);

    if (!transactions || transactions.length === 0) {
      return "📱 Krezzo\n\n📊 CATEGORY PACING\n\nNo transaction data found for tracked categories.";
    }

    // Analyze each tracked category
    const categoryAnalysis = new Map<string, {
      totalSpending: number;
      currentMonthSpending: number;
      transactionCount: number;
    }>();

    transactions.forEach(transaction => {
      const category = transaction.ai_category_tag;
      const isCurrentMonth = transaction.date >= currentMonthStart && transaction.date <= yesterdayStr;

      if (!categoryAnalysis.has(category)) {
        categoryAnalysis.set(category, {
          totalSpending: 0,
          currentMonthSpending: 0,
          transactionCount: 0
        });
      }

      const analysis = categoryAnalysis.get(category)!;
      analysis.totalSpending += transaction.amount;
      analysis.transactionCount += 1;

      if (isCurrentMonth) {
        analysis.currentMonthSpending += transaction.amount;
      }
    });

    // Build SMS content
    const monthName = yesterday.toLocaleDateString('en-US', { month: 'long' });
    let smsContent = `📊 CATEGORY PACING\n${monthName} ${currentYear}\nMonth Progress: ${monthProgress}% (Day ${dayOfMonth})\n\n`;

    // Process categories and sort by spending
    const categoryResults: Array<{
      category: string;
      currentMonthSpending: number;
      avgMonthlySpending: number;
      expectedByNow: number;
      pacing: number;
      status: string;
      statusEmoji: string;
    }> = [];

    trackedCategoryNames.forEach(categoryName => {
      const analysis = categoryAnalysis.get(categoryName);
      if (!analysis) return;

      const avgMonthlySpending = analysis.totalSpending / 3; // 3 months of data
      const expectedByNow = avgMonthlySpending * (monthProgress / 100);
      const pacing = expectedByNow > 0 ? Math.round((analysis.currentMonthSpending / expectedByNow) * 100) : 0;

      let status: string;
      let statusEmoji: string;
      if (pacing < 90) {
        status = "Under pace";
        statusEmoji = "🟢";
      } else if (pacing > 110) {
        status = "Over pace";
        statusEmoji = "🔴";
      } else {
        status = "On pace";
        statusEmoji = "🟡";
      }

      categoryResults.push({
        category: categoryName,
        currentMonthSpending: analysis.currentMonthSpending,
        avgMonthlySpending,
        expectedByNow,
        pacing,
        status,
        statusEmoji
      });
    });

    // Sort by current month spending (highest first) and limit to fit character limit
    categoryResults.sort((a, b) => b.currentMonthSpending - a.currentMonthSpending);

    // Add categories to SMS (limit to fit 918 character limit)
    categoryResults.forEach((result, index) => {
      if (smsContent.length > 750) return; // Reserve space for closing

      smsContent += `${result.statusEmoji} ${result.category}:\n`;
      smsContent += `   Month to date: $${Math.round(result.currentMonthSpending)}\n`;
      smsContent += `   Expected by now: $${Math.round(result.expectedByNow)}\n`;
      smsContent += `   Avg monthly: $${Math.round(result.avgMonthlySpending)}\n`;
      smsContent += `   Pacing: ${result.pacing}%\n`;
      smsContent += `   Status: ${result.status}`;
      
      if (index < categoryResults.length - 1 && smsContent.length < 700) {
        smsContent += "\n\n";
      }
    });

    // Add prediction disclaimer
    smsContent += `\n\n⚠️ Predictions based on historical spending patterns`;

    // Ensure message fits within character limit (adjusted for disclaimer)
    if (smsContent.length > 918) {
      smsContent = smsContent.substring(0, 875) + "...\n\n⚠️ Predictions based on historical spending patterns";
    }

    return smsContent;

  } catch (error) {
    console.error('Error generating category pacing message:', error);
    return "📱 Krezzo\n\nError generating category pacing analysis.";
  }
}

// ===================================
// 6. WEEKLY SPENDING SUMMARY TEMPLATE (NEW)
// ===================================
export async function generateWeeklySpendingSummaryMessage(userId: string): Promise<string> {
  try {
    // Get user's item IDs
    const { data: userItems } = await supabase
      .from('items')
      .select('id, plaid_item_id')
      .eq('user_id', userId);

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
      .eq('user_id', userId);

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

    // Calculate previous month boundaries
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthStart = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
    const lastMonthEnd = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0, 23, 59, 59, 999);
    
    // Calculate month before last for comparison
    const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const twoMonthsAgoStart = new Date(twoMonthsAgo.getFullYear(), twoMonthsAgo.getMonth(), 1);
    const twoMonthsAgoEnd = new Date(twoMonthsAgo.getFullYear(), twoMonthsAgo.getMonth() + 1, 0, 23, 59, 59, 999);

    // Get previous month's transactions
    const lastMonthStartStr = lastMonthStart.toISOString().split('T')[0];
    const lastMonthEndStr = lastMonthEnd.toISOString().split('T')[0];

    const { data: lastMonthTransactions } = await supabase
      .from('transactions')
      .select('date, merchant_name, name, amount, ai_category_tag, ai_merchant_name')
      .in('plaid_item_id', itemIds)
      .gte('date', lastMonthStartStr)
      .lte('date', lastMonthEndStr)
      .gt('amount', 0) // Only spending transactions
      .order('amount', { ascending: false });

    // Get month before last for comparison
    const twoMonthsAgoStartStr = twoMonthsAgoStart.toISOString().split('T')[0];
    const twoMonthsAgoEndStr = twoMonthsAgoEnd.toISOString().split('T')[0];

    const { data: twoMonthsAgoTransactions } = await supabase
      .from('transactions')
      .select('amount')
      .in('plaid_item_id', itemIds)
      .gte('date', twoMonthsAgoStartStr)
      .lte('date', twoMonthsAgoEndStr)
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

    // Daily average
    const daysInMonth = lastMonthEnd.getDate();
    const dailyAverage = lastMonthTotal / daysInMonth;
    message += `\n\n📊 Daily Average: $${dailyAverage.toFixed(0)}`;

    return message.trim();

  } catch (error) {
    console.error('Error generating monthly spending summary:', error);
    return '📊 MONTHLY SPENDING SUMMARY\n\nError loading monthly spending data.';
  }
}

// ===================================
// UNIFIED TEMPLATE SELECTOR (UPDATED)
// ===================================
export async function generateSMSMessage(userId: string, templateType: 'recurring' | 'recent' | 'merchant-pacing' | 'category-pacing' | 'weekly-summary' | 'monthly-summary'): Promise<string> {
  switch (templateType) {
    case 'recurring':
      return await generateRecurringTransactionsMessage(userId);
    case 'recent':
      return await generateRecentTransactionsMessage(userId);
    case 'merchant-pacing':
      return await generateMerchantPacingMessage(userId);
    case 'category-pacing':
      return await generateCategoryPacingMessage(userId);
    case 'weekly-summary':
      return await generateWeeklySpendingSummaryMessage(userId);
    case 'monthly-summary':
      return await generateMonthlySpendingSummaryMessage(userId);
    // TEMPORARILY DISABLED - Paycheck templates
    // case 'paycheck-efficiency':
    //   return await generateSMSMessageForUser(userId, 'paycheck-efficiency');
    // case 'cash-flow-runway':
    //   return await generateSMSMessageForUser(userId, 'cash-flow-runway');
    default:
      return "📱 Krezzo\n\nInvalid template type.";
  }
} 