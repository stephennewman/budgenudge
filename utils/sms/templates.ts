import { createClient } from '@supabase/supabase-js';

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
export async function generateRecentTransactionsMessage(userId: string): Promise<string> {
  try {
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
export async function generatePacingAnalysisMessage(userId: string): Promise<string> {
  try {
    // Get user's item IDs
    const { data: userItems } = await supabase
      .from('items')
      .select('plaid_item_id')
      .eq('user_id', userId)
      .is('deleted_at', null);

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
      .eq('user_id', userId)
      .is('deleted_at', null);

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

    // ✅ FIX: Collect ALL merchant data first, then sort by activity and show only top 3-4
    const merchantData = [];
    const merchantNames = trackedMerchants.map(t => t.ai_merchant_name);

    // Collect data for all merchants
    for (const merchantName of merchantNames) {

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

        // ✅ FIX: Special handling for monthly bills (rent, insurance, utilities)
        const monthlyBillKeywords = ['sentinel', 'rent', 'insurance', 'prog select', 'usaa', 'duke energy', 'electric', 'geico', 'allstate', 'state farm', 'mortgage', 'car payment', 'loan'];
        const isMonthlyBill = monthlyBillKeywords.some(keyword => 
          merchantName.toLowerCase().includes(keyword)
        );

        let expectedSpendToDate, pacingPercentage, status, icon;

        if (isMonthlyBill) {
          // For monthly bills: compare current month spend to average monthly spend
          expectedSpendToDate = avgMonthlySpend;
          pacingPercentage = avgMonthlySpend > 0 ? (currentMonthSpend / avgMonthlySpend) * 100 : 0;
          
          if (currentMonthSpend === 0) {
            status = 'Not paid yet';
            icon = '🟡';
          } else if (pacingPercentage >= 90 && pacingPercentage <= 110) {
            status = 'Paid (on track)';
            icon = '🟢';
          } else if (pacingPercentage > 110) {
            status = 'Paid (over avg)';
            icon = '🔴';
          } else {
            status = 'Paid (under avg)';
            icon = '🟢';
          }
        } else {
          // For regular spending: use daily pacing logic
          expectedSpendToDate = avgMonthlySpend * (dayOfMonth / 30);
          pacingPercentage = expectedSpendToDate > 0 ? (currentMonthSpend / expectedSpendToDate) * 100 : 0;

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
        }

        // Store merchant data for sorting
        merchantData.push({
          merchantName,
          avgMonthlySpend,
          currentMonthSpend,
          expectedSpendToDate,
          pacingPercentage,
          status,
          icon,
          transactionCount: allTxns.length
        });
      }
    }

    // ✅ FIX: Sort by highest activity (transaction frequency) and limit to top 3-4
    const topMerchants = merchantData
      .sort((a, b) => b.transactionCount - a.transactionCount) // Most transactions first (real activity)
      .slice(0, 4); // Limit to top 4 merchants

    if (topMerchants.length === 0) {
      return `📊 MERCHANT PACING\n${yesterday.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}\n\nNo spending data found for tracked merchants.`;
    }

    // Build message with only top merchants
    for (const merchant of topMerchants) {
      message += `${merchant.icon} ${merchant.merchantName}:\n`;
      message += `   Month to date: $${merchant.currentMonthSpend.toFixed(2)}\n`;
      message += `   Expected by now: $${merchant.expectedSpendToDate.toFixed(2)}\n`;
      message += `   Avg monthly: $${merchant.avgMonthlySpend.toFixed(2)}\n`;
      message += `   Pacing: ${merchant.pacingPercentage.toFixed(0)}%\n`;
      message += `   Status: ${merchant.status}\n\n`;
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
      .eq('user_id', userId)
      .is('deleted_at', null);

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
// 8. CASH FLOW RUNWAY (NEW DAILY 5PM)
// ===================================
export async function generateCashFlowRunwayMessage(userId: string): Promise<string> {
  try {
    // Fetch user's Plaid items and depository accounts for balance
    const { data: userItems } = await supabase
      .from('items')
      .select('id, plaid_item_id')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (!userItems || userItems.length === 0) {
      return '🛤️ CASH FLOW RUNWAY\n\nNo bank accounts connected.';
    }

    const itemDbIds = userItems.map(i => i.id);
    const itemIds = userItems.map(i => i.plaid_item_id);

    // Current available balance from depository accounts only
    const { data: accounts } = await supabase
      .from('accounts')
      .select('type, subtype, available_balance')
      .in('item_id', itemDbIds);

    const checkingSavings = (accounts || []).filter(
      a => a.type === 'depository' && (a.subtype === 'checking' || a.subtype === 'savings')
    );
    const availableBalance = checkingSavings.reduce((sum, a) => sum + (a.available_balance || 0), 0);

    // Detect paycheck streams from deposits (negative amounts)
    const now = new Date();
    const lookbackStart = new Date();
    lookbackStart.setDate(lookbackStart.getDate() - 120);
    const lb = lookbackStart.toISOString().split('T')[0];

    type IncomeTxn = { date: string; name: string | null; merchant_name: string | null; amount: number };
    const { data: incomeCandidates } = await supabase
      .from('transactions')
      .select('date, name, merchant_name, amount')
      .in('plaid_item_id', itemIds)
      .gte('date', lb)
      .lt('amount', 0) // deposits as negative
      .order('date', { ascending: true });

    function normalizeIncomeSourceName(name: string): string {
      return name
        .replace(/\d{4}-\d{2}-\d{2}/g, '')
        .replace(/\b(payroll|deposit|direct|payment|transfer|ach|tran)\b/gi, '')
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
    }

    function variance(arr: number[]): number {
      if (arr.length === 0) return 0;
      const mean = arr.reduce((s, n) => s + n, 0) / arr.length;
      return arr.reduce((s, n) => s + Math.pow(n - mean, 2), 0) / arr.length;
    }

    function detectStreams(txns: IncomeTxn[]) {
      const groups = new Map<string, IncomeTxn[]>();
      for (const t of txns) {
        const label = `${t.merchant_name || ''} ${t.name || ''}`.trim();
        const key = normalizeIncomeSourceName(label);
        if (!key) continue;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(t);
      }
      const streams: Array<{
        source: string;
        expectedAmount: number;
        expectedInterval: number; // in days
        confidence: number;
        lastDate: Date;
        nextDate: Date;
      }> = [];

      for (const [key, arr] of groups.entries()) {
        if (arr.length < 3) continue;
        // Sort and compute intervals
        const sorted = [...arr].sort((a, b) => (a.date < b.date ? -1 : 1));
        const dates = sorted.map(t => new Date(t.date + 'T12:00:00'));
        const intervals: number[] = [];
        for (let i = 1; i < dates.length; i++) {
          intervals.push(Math.max(1, Math.round((dates[i].getTime() - dates[i - 1].getTime()) / (1000 * 60 * 60 * 24))));
        }
        const avgInterval = intervals.reduce((s, n) => s + n, 0) / intervals.length;
        const ivar = variance(intervals);

        // Choose expected interval bucket
        let expectedInterval = 14;
        if (Math.abs(avgInterval - 7) <= 2 && ivar < 4) expectedInterval = 7;
        else if (Math.abs(avgInterval - 15) <= 3 && ivar < 10) expectedInterval = 15;
        else if (Math.abs(avgInterval - 30) <= 5 && ivar < 25) expectedInterval = 30;

        // Amounts as absolute values
        const amounts = sorted.map(t => Math.abs(t.amount));
        const avgAmt = amounts.reduce((s, n) => s + n, 0) / amounts.length;
        const aVar = variance(amounts);
        const amountConsistency = avgAmt > 0 ? Math.max(0, 100 - (aVar / avgAmt) * 100) : 0;
        const frequencyConsistency = Math.max(0, 100 - (ivar / expectedInterval) * 10);
        const countBonus = Math.min(100, (sorted.length - 3) * 10 + 60);
        const confidence = Math.round(frequencyConsistency * 0.4 + amountConsistency * 0.3 + countBonus * 0.2 + 10); // +10 regularity bonus

        // Next date: advance last by expected interval until future
        let nextDate = new Date(dates[dates.length - 1].getTime());
        while (nextDate <= now) {
          nextDate = new Date(nextDate.getTime() + expectedInterval * 24 * 60 * 60 * 1000);
        }

        // Display source label: title case of key
        const source = key
          .split(' ')
          .filter(Boolean)
          .map(w => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');

        streams.push({
          source,
          expectedAmount: Math.round(avgAmt * 100) / 100,
          expectedInterval,
          confidence,
          lastDate: dates[dates.length - 1],
          nextDate,
        });
      }

      // Sort by next date soonest, then by expected amount desc
      return streams.sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime() || b.expectedAmount - a.expectedAmount);
    }

    const streamsAll = detectStreams((incomeCandidates || []) as IncomeTxn[]);

    function isTransferOrInvestmentSource(label: string): boolean {
      const l = (label || '').toLowerCase();
      const badKeywords = [
        'brokerage',
        'transfer',
        'venmo',
        'paypal',
        'zelle',
        'cash app',
        'apple cash',
        'external account',
        'internal transfer',
        'from savings',
        'to checking',
        'funds from',
        'sweep'
      ];
      return badKeywords.some(k => l.includes(k));
    }

    // Filter out likely non-paycheck sources for display and for primary next date
    const streams = (streamsAll || []).filter(s => !isTransferOrInvestmentSource(s.source));
    const primaryNext = streams.length > 0
      ? streams[0].nextDate
      : (streamsAll.length > 0 ? streamsAll[0].nextDate : new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000));
    const nextPaycheckDate = primaryNext;
    const daysUntilPay = Math.max(1, Math.ceil((nextPaycheckDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    // Sum predicted bills before next paycheck from tagged_merchants
    const { data: taggedMerchants } = await supabase
      .from('tagged_merchants')
      .select('merchant_name, expected_amount, next_predicted_date')
      .eq('user_id', userId)
      .eq('is_active', true);

    const billsInWindow = (taggedMerchants || []).filter(tm => {
      if (!tm.next_predicted_date) return false;
      const d = new Date(tm.next_predicted_date + 'T12:00:00');
      return d > now && d <= nextPaycheckDate;
    }).sort((a, b) => new Date(a.next_predicted_date + 'T12:00:00').getTime() - new Date(b.next_predicted_date + 'T12:00:00').getTime());

    const billsBeforePay = billsInWindow.reduce((sum, tm) => sum + Number(tm.expected_amount || 0), 0);

    // Estimate discretionary spend using pattern-based baseline
    // 1) Use up to 180d (or since first tx) to detect patterned discretionary sources
    // 2) Build baseline from up to last 90d (or since first tx) using only patterned discretionary
    // Determine first known transaction date to avoid skewing with fixed windows
    const { data: firstTxRows } = await supabase
      .from('transactions')
      .select('date')
      .in('plaid_item_id', itemIds)
      .order('date', { ascending: true })
      .limit(1);

    const firstTxDate = firstTxRows && firstTxRows.length > 0
      ? new Date(firstTxRows[0].date + 'T12:00:00')
      : null;
    const msPerDay = 24 * 60 * 60 * 1000;
    const availableDays = firstTxDate ? Math.max(1, Math.ceil((now.getTime() - firstTxDate.getTime()) / msPerDay)) : 180;
    const historyDays = Math.min(180, availableDays);
    const baselineDays = Math.min(90, availableDays);
    const historyStart = new Date(now.getTime() - historyDays * msPerDay);
    const baselineStart = new Date(now.getTime() - baselineDays * msPerDay);

    // Pull active recurring merchants to exclude from baseline
    const { data: activeRecurring } = await supabase
      .from('tagged_merchants')
      .select('merchant_name')
      .eq('user_id', userId)
      .eq('is_active', true);

    const recurringMerchantSet = new Set((activeRecurring || []).map(m => (m.merchant_name || '').toLowerCase()));
    const excludedBillCategories = new Set([
      'Mortgage', 'Rent', 'Utilities', 'Electric', 'Gas & Electric', 'Water', 'Trash', 'Internet', 'Phone', 'Cable',
      'Insurance', 'Student Loans', 'Credit Card Bill', 'Payment', 'Transfer', 'Taxes', 'Subscription', 'Subscriptions'
    ].map(s => s.toLowerCase()));

    // 180d history for pattern detection
    const { data: history180 } = await supabase
      .from('transactions')
      .select('amount, date, ai_category_tag, ai_merchant_name, merchant_name, name')
      .in('plaid_item_id', itemIds)
      .gte('date', historyStart.toISOString().split('T')[0])
      .gt('amount', 0);

    type Tx = { amount: number; date: string; ai_category_tag?: string | null; ai_merchant_name?: string | null; merchant_name?: string | null; name?: string | null };
    const filtered180 = (history180 || []).filter((t: any) => {
      const cat = (t.ai_category_tag || '').toLowerCase();
      const merch = (t.ai_merchant_name || t.merchant_name || t.name || '').toLowerCase();
      const isRecurringMerchant = merch && recurringMerchantSet.has(merch);
      const isBillCategory = cat && excludedBillCategories.has(cat);
      const isVenmo = merch.includes('venmo');
      return !isRecurringMerchant && !isBillCategory && !isVenmo;
    }) as Tx[];

    // Pattern detection: occurrences across months/weeks
    const merchantStats = new Map<string, { count: number; months: Set<string>; weeks: Set<string> }>();
    const categoryStats = new Map<string, { count: number; months: Set<string>; weeks: Set<string> }>();
    for (const t of filtered180) {
      const d = new Date(t.date + 'T12:00:00');
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const weekKey = `${d.getFullYear()}-W${Math.ceil((d.getDate()) / 7)}`;
      const merch = (t.ai_merchant_name || t.merchant_name || t.name || '').toLowerCase();
      const cat = (t.ai_category_tag || '').toLowerCase();
      if (merch) {
        if (!merchantStats.has(merch)) merchantStats.set(merch, { count: 0, months: new Set(), weeks: new Set() });
        const s = merchantStats.get(merch)!;
        s.count += 1; s.months.add(monthKey); s.weeks.add(weekKey);
      }
      if (cat) {
        if (!categoryStats.has(cat)) categoryStats.set(cat, { count: 0, months: new Set(), weeks: new Set() });
        const s = categoryStats.get(cat)!;
        s.count += 1; s.months.add(monthKey); s.weeks.add(weekKey);
      }
    }

    const allowedMerchants = new Set<string>();
    const allowedCategories = new Set<string>();
    for (const [merch, s] of merchantStats.entries()) {
      if (s.count >= 6 && s.months.size >= 3) allowedMerchants.add(merch); // at least 6 tx over 3+ months
      else if (s.weeks.size >= 6) allowedMerchants.add(merch); // or appears in 6+ distinct weeks
    }
    for (const [cat, s] of categoryStats.entries()) {
      if (s.count >= 10 && s.months.size >= 3) allowedCategories.add(cat);
      else if (s.weeks.size >= 8) allowedCategories.add(cat);
    }

    // Build baseline from last 90 days, filtered to patterned discretionary only
    const { data: last90 } = await supabase
      .from('transactions')
      .select('amount, date, ai_category_tag, ai_merchant_name, merchant_name, name')
      .in('plaid_item_id', itemIds)
      .gte('date', baselineStart.toISOString().split('T')[0])
      .gt('amount', 0);

    const totalPatterned90 = (last90 || []).reduce((sum, t: any) => {
      const cat = (t.ai_category_tag || '').toLowerCase();
      const merch = (t.ai_merchant_name || t.merchant_name || t.name || '').toLowerCase();
      const isRecurringMerchant = merch && recurringMerchantSet.has(merch);
      const isBillCategory = cat && excludedBillCategories.has(cat);
      const isVenmo = merch.includes('venmo');
      const isPatterned = (merch && allowedMerchants.has(merch)) || (cat && allowedCategories.has(cat));
      if (isRecurringMerchant || isBillCategory || isVenmo || !isPatterned) return sum;
      return sum + (t.amount || 0);
    }, 0);

    const avgDailyDiscretionary = baselineDays > 0 ? (totalPatterned90 / baselineDays) : 0;
    const projectedDiscretionary = avgDailyDiscretionary * daysUntilPay;

    // Compute runway days until paycheck
    const projectedOutflows = billsBeforePay + projectedDiscretionary;
    const runwayBalanceAfter = availableBalance - projectedOutflows;
    const onTrack = runwayBalanceAfter >= 0;

    // Per-day cap to stay solvent until payday
    const perDayCap = Math.max(0, (availableBalance - billsBeforePay) / daysUntilPay);

    const payDateStr = nextPaycheckDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const riskText = onTrack ? 'On track' : 'At risk';
    const tip = onTrack
      ? 'Nice work. Keep daily spend near your 30-day average.'
      : `Reduce discretionary by ~$${Math.ceil(Math.abs(runwayBalanceAfter) / daysUntilPay)} per day to stay on track.`;

    const discretionaryRemaining = availableBalance - billsBeforePay;
    const primaryIncomeAmount = streams.length > 0 ? Math.round(streams[0].expectedAmount) : null;
    let msg = `🛤️ CASH FLOW RUNWAY\n`;
    msg += `Available balance: $${Math.round(availableBalance)}\n`;
    msg += `Next income in ${daysUntilPay} days (${payDateStr})\n`;
    msg += `Bills before income: $${Math.round(billsBeforePay)}\n`;
    if (billsInWindow.length > 0) {
      const billLines = billsInWindow.slice(0, 6).map(tm => {
        const d = new Date(tm.next_predicted_date + 'T12:00:00');
        const ds = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const name = (tm.merchant_name || 'Bill').slice(0, 20);
        const amt = Math.round(Number(tm.expected_amount || 0));
        return `• ${ds}: ${name} $${amt}`;
      }).join('\n');
      msg += billLines ? `${billLines}\n` : '';
    }
    msg += `Predicted money remaining: $${Math.round(discretionaryRemaining)}\n`;
    msg += `Max spend per day: $${Math.round(perDayCap)}\n`;
    msg += `Tip: ${tip}`;

    // Append detected income streams summary (top 2 for clarity)
    if (streams.length > 0) {
      msg += `\n\nNext income:`;
      const top2 = streams.slice(0, 2);
      for (const s of top2) {
        const d = s.nextDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        msg += `\n• ${d}: ~$${Math.round(s.expectedAmount)} (${s.source || 'Income'})`;
      }
    }
    // Add a light, encouraging closer (varies per user/day but deterministic-ish)
    const encouragements = [
      "You're doing great—your wallet just winked. 😎💸",
      "Small steps, big wins. Future-you says thanks. 🌟",
      "Budget boss mode: engaged. Keep rolling. 🛼",
      "Your money has main-character energy today. 🎬✨",
      "Even the bills are impressed with your planning. 📅👏",
      "Stay smooth—like a tap to pay on Friday. 💳✨",
    ];
    const uidScore = Array.from(userId).reduce((s, c) => s + c.charCodeAt(0), 0);
    const pick = (uidScore + now.getDate()) % encouragements.length;
    msg += `\n\n${encouragements[pick]}`;

    // Final disclaimer
    msg += `\n\n*Predictions based on historical data.`;

    return msg;
  } catch (error) {
    console.error('Error generating cash flow runway message:', error);
    return '🛤️ CASH FLOW RUNWAY\n\nError generating runway analysis.';
  }
}

// ===================================
// ONBOARDING SMS TEMPLATES
// ===================================

/**
 * Immediate onboarding message sent right after bank connection
 */
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
function generateOnboardingAnalysisCompleteMessageFallback(userId: string): string {
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
async function getUserFirstName(userId: string): Promise<string | null> {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name')
      .eq('id', userId)
      .single();

    if (profile?.first_name) {
      return profile.first_name;
    }

    // Fallback to user metadata
    const { data: user } = await supabase.auth.admin.getUserById(userId);
    if (user.user?.user_metadata?.firstName) {
      return user.user.user_metadata.firstName;
    }

    return null;
  } catch (error) {
    console.error('Error getting user first name:', error);
    return null;
  }
}

// ===================================
// ENHANCED BILL DETECTION FOR TEMPLATES
// ===================================

function runEnhancedBillDetectionInTemplate(transactions: any[]) {
  // Group transactions by merchant
  const merchantGroups: Record<string, any[]> = {};
  
  transactions.forEach(tx => {
    if ((tx.amount || 0) <= 0) return; // Only expenses
    
    const merchant = normalizeMerchantNameForTemplate(tx.ai_merchant_name || tx.merchant_name || tx.name || 'Unknown');
    
    if (!merchantGroups[merchant]) {
      merchantGroups[merchant] = [];
    }
    merchantGroups[merchant].push(tx);
  });
  
  const detectedBills = [];
  
  for (const [merchant, txs] of Object.entries(merchantGroups)) {
    // Enhanced: Accept 2+ transactions (was 5+ in old system)
    if (txs.length < 2) continue;
    
    // Filter out non-bill merchants
    if (isNonBillMerchant(merchant)) continue;
    
    // Sort by date
    const sortedTxs = txs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Analyze patterns
    const analysis = analyzeMerchantPatternForTemplate(sortedTxs);
    
    // Enhanced scoring with bill-specific criteria
    const score = calculateEnhancedBillScoreForTemplate(analysis, txs.length, merchant);
    
    // Higher threshold for better quality (60+ instead of 50+)
    if (score >= 60) {
      detectedBills.push({
        merchant: merchant,
        transactionCount: txs.length,
        averageAmount: analysis.averageAmount,
        frequency: analysis.frequency,
        confidenceScore: score
      });
    }
  }
  
  return detectedBills.sort((a, b) => b.confidenceScore - a.confidenceScore);
}

function analyzeMerchantPatternForTemplate(transactions: any[]) {
  const amounts = transactions.map(tx => tx.amount);
  const dates = transactions.map(tx => new Date(tx.date));
  
  // Calculate intervals
  const intervals = [];
  for (let i = 1; i < dates.length; i++) {
    const daysBetween = Math.round((dates[i].getTime() - dates[i-1].getTime()) / (1000 * 60 * 60 * 24));
    intervals.push(daysBetween);
  }
  
  const averageAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  const amountVariance = calculateVarianceForTemplate(amounts);
  const averageInterval = intervals.length > 0 ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 0;
  
  // Determine frequency
  let frequency = 'unknown';
  if (averageInterval >= 25 && averageInterval <= 35) frequency = 'monthly';
  else if (averageInterval >= 12 && averageInterval <= 16) frequency = 'biweekly';
  else if (averageInterval >= 6 && averageInterval <= 8) frequency = 'weekly';
  else if (averageInterval >= 85 && averageInterval <= 95) frequency = 'quarterly';
  
  return {
    averageAmount,
    amountVariance,
    averageInterval,
    frequency
  };
}

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

function calculateEnhancedBillScoreForTemplate(analysis: any, txCount: number, merchant: string): number {
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

function normalizeMerchantNameForTemplate(name: string): string {
  return name.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function calculateVarianceForTemplate(numbers: number[]): number {
  if (numbers.length <= 1) return 0;
  const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
  const squaredDiffs = numbers.map(num => Math.pow(num - mean, 2));
  return squaredDiffs.reduce((a, b) => a + b, 0) / numbers.length;
}

// ===================================
// UNIFIED TEMPLATE SELECTOR (UPDATED)
// ===================================
export async function generateSMSMessage(userId: string, templateType: 'recurring' | 'recent' | 'merchant-pacing' | 'category-pacing' | 'weekly-summary' | 'monthly-summary' | 'cash-flow-runway' | 'onboarding-immediate' | 'onboarding-analysis-complete' | 'onboarding-day-before' | '415pm-special'): Promise<string> {
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
    case 'cash-flow-runway':
      return await generateCashFlowRunwayMessage(userId);
    case 'onboarding-immediate':
      return await generateOnboardingImmediateMessage(userId);
    case 'onboarding-analysis-complete':
      return await generateOnboardingAnalysisCompleteMessage(userId);
    case 'onboarding-day-before':
      return await generateOnboardingDayBeforeMessage(userId);
    case '415pm-special':
      return await generate415pmSpecialMessage(userId);
    // TEMPORARILY DISABLED - Paycheck templates
    // case 'paycheck-efficiency':
    //   return await generateSMSMessageForUser(userId, 'paycheck-efficiency');
    default:
      return "📱 Krezzo\n\nInvalid template type.";
  }
} 

// ===================================
// 9. 5:30 PM KREZZO REPORT TEMPLATE (NEW)
// ===================================
// 5:30 PM KREZZO REPORT - Clean format without URLs
export async function generate415pmSpecialMessage(userId: string): Promise<string> {
  try {
    console.log('🔍 generate415pmSpecialMessage called for user:', userId);
    // Get user's item IDs
    const { data: userItems } = await supabase
      .from('items')
      .select('id, plaid_item_id')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (!userItems || userItems.length === 0) {
      return '📊 KREZZO REPORT\n\nNo bank accounts connected.';
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

    // Get yesterday's transactions
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    const { data: yesterdayTransactions } = await supabase
      .from('transactions')
      .select('date, merchant_name, name, amount, ai_category_tag')
      .in('plaid_item_id', itemIds)
      .eq('date', yesterdayStr)
      .gt('amount', 0) // Only spending transactions
      .order('amount', { ascending: false });

    // Get yesterday's balance (approximate)
    const yesterdayBalance = totalAvailableBalance + (yesterdayTransactions?.reduce((sum, t) => sum + t.amount, 0) || 0);

    // Get category pacing data
    const { data: trackedCategories } = await supabase
      .from('category_pacing_tracking')
      .select('ai_category')
      .eq('user_id', userId)
      .eq('is_active', true);

    // Get merchant pacing data
    const { data: trackedMerchants } = await supabase
      .from('merchant_pacing_tracking')
      .select('ai_merchant_name')
      .eq('user_id', userId)
      .eq('is_active', true);

    // Get income streams from user_income_profiles table
    const now = new Date();
    const { data: incomeProfile } = await supabase
      .from('user_income_profiles')
      .select('profile_data')
      .eq('user_id', userId)
      .single();

    console.log('🔍 Income Profile Data:', JSON.stringify(incomeProfile, null, 2));

    let incomeCandidates: any[] = [];
    if (incomeProfile?.profile_data?.income_sources) {
      // Use the structured income data from the income page
      const incomeSources = incomeProfile.profile_data.income_sources;
      console.log('🔍 Income Sources Found:', JSON.stringify(incomeSources, null, 2));
      
      incomeCandidates = incomeSources
        .filter((source: any) => source.frequency !== 'irregular' && source.expected_amount > 0)
        .map((source: any) => ({
          source_name: source.source_name,
          expected_amount: source.expected_amount,
          frequency: source.frequency,
          next_predicted_date: source.next_predicted_date,
          last_pay_date: source.last_pay_date,
          confidence_score: source.confidence_score
        }));
      
      console.log('🔍 Filtered Income Candidates:', JSON.stringify(incomeCandidates, null, 2));
    } else {
      console.log('🔍 No income profile found, using fallback detection');
      // Fallback to transaction-based detection if no income profile exists
      const lookbackStart = new Date();
      lookbackStart.setDate(lookbackStart.getDate() - 120);
      const lb = lookbackStart.toISOString().split('T')[0];

      const { data: fallbackIncome } = await supabase
        .from('transactions')
        .select('date, name, merchant_name, amount')
        .in('plaid_item_id', itemIds)
        .gte('date', lb)
        .lt('amount', 0) // deposits as negative
        .order('date', { ascending: true });
      
      incomeCandidates = fallbackIncome || [];
      console.log('🔍 Fallback Income Data:', JSON.stringify(incomeCandidates, null, 2));
    }

    // Get upcoming bills
    const { data: upcomingBills } = await supabase
      .from('tagged_merchants')
      .select('merchant_name, expected_amount, next_predicted_date')
      .eq('user_id', userId)
      .eq('is_active', true)
      .gte('next_predicted_date', now.toISOString().split('T')[0])
      .order('next_predicted_date', { ascending: true });

    let message = `📊 KREZZO REPORT\n\n`;

    // 1. TRANSACTIONS SECTION
    message += `💳 Transactions\n`;
    if (yesterdayTransactions && yesterdayTransactions.length > 0) {
      const yesterdayTotal = yesterdayTransactions.reduce((sum, t) => sum + t.amount, 0);
      message += `Posted yesterday: ${yesterdayTransactions.length} transactions for $${yesterdayTotal.toFixed(2)} total\n`;
    } else {
      message += `Posted yesterday: 0 transactions for $0.00 total\n`;
    }
    message += `Balance as of yesterday: $${yesterdayBalance.toFixed(2)}\n\n`;

    // 2. CATEGORY PACING SECTION
    message += `📊 Category Pacing\n`;
    if (trackedCategories && trackedCategories.length > 0) {
      // Get current month data for categories
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      const dayOfMonth = now.getDate();
      const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      const categoryPacingData = [];
      
      for (const category of trackedCategories) {
        const { data: allTxns } = await supabase
          .from('transactions')
          .select('amount, date')
          .in('plaid_item_id', itemIds)
          .eq('ai_category_tag', category.ai_category)
          .gte('amount', 0);

        if (allTxns && allTxns.length > 0) {
          // Calculate historical average
          const totalSpend = allTxns.reduce((sum, t) => sum + t.amount, 0);
          const dates = allTxns.map(t => new Date(t.date));
          const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
          const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
          const totalDays = Math.max(1, Math.floor((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
          const avgDailySpend = totalSpend / totalDays;
          const avgMonthlySpend = avgDailySpend * 30;

          // Get current month spending
          const { data: currentMonthTxns } = await supabase
            .from('transactions')
            .select('amount')
            .in('plaid_item_id', itemIds)
            .eq('ai_category_tag', category.ai_category)
            .gte('date', firstDayOfMonth.toISOString().split('T')[0])
            .lte('date', yesterdayStr)
            .gte('amount', 0);

          const currentMonthSpend = currentMonthTxns?.reduce((sum, t) => sum + t.amount, 0) || 0;
          const expectedByNow = avgMonthlySpend * (dayOfMonth / 30);
          const pacing = expectedByNow > 0 ? (currentMonthSpend / expectedByNow) * 100 : 0;

          if (pacing > 110 || pacing < 90) { // Only red and yellow
            categoryPacingData.push({
              category: category.ai_category,
              currentMonthSpend,
              expectedByNow,
              pacing
            });
          }
        }
      }

      if (categoryPacingData.length > 0) {
        // Sort by highest pacing (worst first)
        categoryPacingData.sort((a, b) => b.pacing - a.pacing);
        
        categoryPacingData.slice(0, 3).forEach(cat => {
          const status = cat.pacing > 110 ? 'Over' : 'Under';
          const diff = Math.abs(cat.pacing - 100);
          message += `${cat.category}\n`;
          message += `Month to date: $${cat.currentMonthSpend.toFixed(0)}\n`;
          message += `Typical by now: $${cat.expectedByNow.toFixed(0)}\n`;
          message += `Pacing: ${status} by ${diff.toFixed(0)}%\n\n`;
        });
      } else {
        message += `✅ All categories on track\n\n`;
      }
    } else {
      message += `✅ No categories tracked\n\n`;
    }

    // 3. MERCHANT PACING SECTION
    message += `🏪 Merchant Pacing\n`;
    if (trackedMerchants && trackedMerchants.length > 0) {
      // Similar logic for merchants
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      const dayOfMonth = now.getDate();
      const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      const merchantPacingData = [];
      
      for (const merchant of trackedMerchants) {
        const { data: allTxns } = await supabase
          .from('transactions')
          .select('amount, date')
          .in('plaid_item_id', itemIds)
          .eq('ai_merchant_name', merchant.ai_merchant_name)
          .gte('amount', 0);

        if (allTxns && allTxns.length > 0) {
          const totalSpend = allTxns.reduce((sum, t) => sum + t.amount, 0);
          const dates = allTxns.map(t => new Date(t.date));
          const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
          const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
          const totalDays = Math.max(1, Math.floor((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
          const avgDailySpend = totalSpend / totalDays;
          const avgMonthlySpend = avgDailySpend * 30;

          const { data: currentMonthTxns } = await supabase
            .from('transactions')
            .select('amount')
            .in('plaid_item_id', itemIds)
            .eq('ai_merchant_name', merchant.ai_merchant_name)
            .gte('date', firstDayOfMonth.toISOString().split('T')[0])
            .lte('date', yesterdayStr)
            .gte('amount', 0);

          const currentMonthSpend = currentMonthTxns?.reduce((sum, t) => sum + t.amount, 0) || 0;
          const expectedByNow = avgMonthlySpend * (dayOfMonth / 30);
          const pacing = expectedByNow > 0 ? (currentMonthSpend / expectedByNow) * 100 : 0;

          if (pacing > 110 || pacing < 90) { // Only red and yellow
            merchantPacingData.push({
              merchant: merchant.ai_merchant_name,
              currentMonthSpend,
              expectedByNow,
              pacing
            });
          }
        }
      }

      if (merchantPacingData.length > 0) {
        // Sort by highest pacing (worst first)
        merchantPacingData.sort((a, b) => b.pacing - a.pacing);
        
        merchantPacingData.slice(0, 3).forEach(merch => {
          const status = merch.pacing > 110 ? 'Over' : 'Under';
          const diff = Math.abs(merch.pacing - 100);
          message += `${merch.merchant}\n`;
          message += `Month to date: $${merch.currentMonthSpend.toFixed(0)}\n`;
          message += `Typical by now: $${merch.expectedByNow.toFixed(0)}\n`;
          message += `Pacing: ${status} by ${diff.toFixed(0)}%\n\n`;
        });
      } else {
        message += `✅ All merchants on track\n\n`;
      }
    } else {
      message += `✅ No merchants tracked\n\n`;
    }

    // 4. INCOME SECTION
    message += `💰 Income\n`;
    if (incomeCandidates && incomeCandidates.length > 0) {
      // Find next income
      const nextIncome = findNextIncome(incomeCandidates);
      if (nextIncome) {
        const daysUntil = Math.ceil((nextIncome.nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        // Show primary income
        message += `In ${daysUntil} days for $${nextIncome.expectedAmount.toFixed(0)}`;
        
        // If we have structured income data, show additional sources
        if (incomeCandidates[0]?.source_name && incomeCandidates[0]?.frequency) {
          // For structured data, show multiple upcoming incomes
          const upcomingIncomes = [];
          const now = new Date();
          
          for (const source of incomeCandidates) {
            if (source.frequency === 'irregular') continue;
            
            let nextDate: Date;
            if (source.next_predicted_date && new Date(source.next_predicted_date) >= now) {
              nextDate = new Date(source.next_predicted_date);
            } else if (source.last_pay_date) {
              nextDate = new Date(source.last_pay_date);
              switch (source.frequency) {
                case 'weekly': while (nextDate <= now) nextDate.setDate(nextDate.getDate() + 7); break;
                case 'bi-weekly': while (nextDate <= now) nextDate.setDate(nextDate.getDate() + 14); break;
                case 'bi-monthly': while (nextDate <= now) { nextDate.setMonth(nextDate.getMonth() + 1); nextDate.setDate(15); } break;
                case 'monthly': while (nextDate <= now) nextDate.setMonth(nextDate.getMonth() + 1); break;
              }
            } else continue;
            
            upcomingIncomes.push({ source: source.source_name, amount: source.expected_amount, date: nextDate });
          }
          
          // Sort by date and show additional sources
          upcomingIncomes.sort((a, b) => a.date.getTime() - b.date.getTime());
          
          if (upcomingIncomes.length > 1) {
            message += ` (${upcomingIncomes[0].source})`;
            const totalExpected = upcomingIncomes.reduce((sum, inc) => sum + inc.amount, 0);
            message += `\nTotal expected: $${totalExpected.toFixed(0)} from ${upcomingIncomes.length} sources\n\n`;
          } else {
            message += `\n\n`;
          }
        } else {
          message += `\n\n`;
        }
      } else {
        message += `No income patterns detected\n\n`;
      }
    } else {
      message += `No income data available\n\n`;
    }

    // 5. EXPENSES SECTION
    message += `💸 Expenses\n`;
    if (upcomingBills && upcomingBills.length > 0) {
      const nextIncome = incomeCandidates && incomeCandidates.length > 0 ? findNextIncome(incomeCandidates) : null;
      if (nextIncome) {
        const daysUntil = Math.ceil((nextIncome.nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        // Get bills before next income
        const billsBeforeIncome = upcomingBills.filter(bill => {
          const billDate = new Date(bill.next_predicted_date + 'T12:00:00');
          return billDate <= nextIncome.nextDate;
        });

        if (billsBeforeIncome.length > 0) {
          const totalBills = billsBeforeIncome.reduce((sum, b) => sum + Number(b.expected_amount), 0);
          message += `Next ${daysUntil} days: ${billsBeforeIncome.length} for $${totalBills.toFixed(0)} total\n\n`;

          // Calculate expected balance and max daily spend
          const expectedBalance = totalAvailableBalance - totalBills;
          const maxDailySpend = expectedBalance > 0 ? expectedBalance / daysUntil : 0;

          message += `Expected balance before next income: $${expectedBalance.toFixed(0)}\n`;
          message += `Max spend per day: $${maxDailySpend.toFixed(0)}\n\n`;
        } else {
          message += `No bills before next income\n\n`;
        }
      } else {
        message += `No income data for expense planning\n\n`;
      }
    } else {
      message += `No upcoming bills\n\n`;
    }

    // 6. AI-INSPIRED VIBE MESSAGE
    const vibeMessage = generateAIVibeMessage(totalAvailableBalance, yesterdayTransactions, upcomingBills);
    message += `🎯 ${vibeMessage}`;

    return message.trim();

  } catch (error) {
    console.error('Error generating 5:30 PM Krezzo Report:', error);
    return '📊 KREZZO REPORT\n\nError generating report.';
  }
}

// Simple and reliable income prediction function
function findNextIncome(incomeCandidates: any[]): any {
  if (!incomeCandidates || incomeCandidates.length === 0) return null;

  console.log('🔍 findNextIncome called with:', JSON.stringify(incomeCandidates, null, 2));

  // Check if we have structured income data from user_income_profiles
  if (incomeCandidates[0]?.source_name && incomeCandidates[0]?.frequency) {
    console.log('🔍 Using structured income data');
    // Use structured income data
    const now = new Date();
    const upcomingIncomes = [];

    for (const source of incomeCandidates) {
      console.log('🔍 Processing income source:', source.source_name);
      let nextDate: Date;
      
      if (source.next_predicted_date && new Date(source.next_predicted_date) >= now) {
        // Use manual override if it's in the future
        nextDate = new Date(source.next_predicted_date);
        console.log('🔍 Using manual override date:', source.next_predicted_date);
      } else if (source.last_pay_date) {
        // Calculate from last payment date
        nextDate = new Date(source.last_pay_date);
        console.log('🔍 Calculating from last pay date:', source.last_pay_date);
        
        // Add frequency-based days
        switch (source.frequency) {
          case 'weekly':
            while (nextDate <= now) {
              nextDate.setDate(nextDate.getDate() + 7);
            }
            break;
          case 'bi-weekly':
            while (nextDate <= now) {
              nextDate.setDate(nextDate.getDate() + 14);
            }
            break;
          case 'bi-monthly':
            while (nextDate <= now) {
              nextDate.setMonth(nextDate.getMonth() + 1);
              nextDate.setDate(15); // Assume 15th of month
            }
            break;
          case 'monthly':
            while (nextDate <= now) {
              nextDate.setMonth(nextDate.getMonth() + 1);
            }
            break;
          default:
            console.log('🔍 Skipping irregular frequency:', source.frequency);
            continue; // Skip irregular sources
        }
      } else {
        console.log('🔍 No date information for source:', source.source_name);
        continue; // Skip if no date information
      }

      console.log('🔍 Calculated next date for', source.source_name, ':', nextDate.toISOString());

      upcomingIncomes.push({
        source: source.source_name,
        expectedAmount: source.expected_amount,
        nextDate: nextDate
      });
    }

    console.log('🔍 All upcoming incomes:', JSON.stringify(upcomingIncomes, null, 2));

    // Return the soonest income
    const result = upcomingIncomes.sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime())[0] || null;
    console.log('🔍 Selected income result:', JSON.stringify(result, null, 2));
    return result;
  }

  // NEW: Simple transaction-based income prediction for multiple sources
  console.log('🔍 Using simple transaction-based income prediction');
  const now = new Date();
  
  // Group transactions by likely income source
  const incomeGroups = new Map<string, any[]>();
  
  for (const transaction of incomeCandidates) {
    // Create a simple key from merchant and transaction name
    const key = `${transaction.merchant_name || ''} ${transaction.name || ''}`.trim();
    if (!key || key.length < 3) continue; // Skip if no meaningful identifier
    
    if (!incomeGroups.has(key)) {
      incomeGroups.set(key, []);
    }
    incomeGroups.get(key)!.push(transaction);
  }

  console.log('🔍 Grouped income sources:', Array.from(incomeGroups.keys()));

  const incomePredictions = [];

  for (const [sourceKey, transactions] of incomeGroups.entries()) {
    if (transactions.length === 0) continue;

    // Sort by date (newest first)
    const sortedTransactions = [...transactions].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const mostRecent = sortedTransactions[0];
    const mostRecentDate = new Date(mostRecent.date);
    const mostRecentAmount = Math.abs(mostRecent.amount);

    // Calculate interval from last 2-3 transactions
    let interval = 14; // Default to bi-weekly
    if (sortedTransactions.length >= 2) {
      const intervals = [];
      for (let i = 0; i < Math.min(sortedTransactions.length - 1, 3); i++) {
        const current = new Date(sortedTransactions[i].date);
        const next = new Date(sortedTransactions[i + 1].date);
        const daysDiff = Math.round((current.getTime() - next.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff > 0) intervals.push(daysDiff);
      }
      
      if (intervals.length > 0) {
        // Use median interval for more stability
        intervals.sort((a, b) => a - b);
        interval = intervals[Math.floor(intervals.length / 2)];
      }
    }

    // Predict next date
    let nextDate = new Date(mostRecentDate);
    while (nextDate <= now) {
      nextDate.setDate(nextDate.getDate() + interval);
    }

    // Calculate expected amount (use most recent, but consider average if stable)
    let expectedAmount = mostRecentAmount;
    if (sortedTransactions.length >= 3) {
      const amounts = sortedTransactions.slice(0, 3).map(t => Math.abs(t.amount));
      const avgAmount = amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length;
      const variance = amounts.reduce((sum, amt) => sum + Math.pow(amt - avgAmount, 2), 0) / amounts.length;
      
      // If amounts are stable (low variance), use average; otherwise use most recent
      if (variance < Math.pow(avgAmount * 0.1, 2)) { // Less than 10% variance
        expectedAmount = Math.round(avgAmount);
      }
    }

    incomePredictions.push({
      source: sourceKey,
      expectedAmount: expectedAmount,
      nextDate: nextDate,
      confidence: Math.min(transactions.length / 3, 1) // Higher confidence with more transactions
    });
  }

  // Sort by next date (soonest first)
  incomePredictions.sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime());

  console.log('🔍 Income predictions:', JSON.stringify(incomePredictions, null, 2));

  // Return the soonest income prediction
  const result = incomePredictions[0] || null;
  console.log('🔍 Selected income result:', JSON.stringify(result, null, 2));
  return result;
}

// Helper function to normalize income source names
function normalizeIncomeSourceName(name: string): string {
  return name
    .replace(/\d{4}-\d{2}-\d{2}/g, '')
    .replace(/\b(payroll|deposit|direct|payment|transfer|ach|tran)\b/gi, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Helper function to generate AI-inspired vibe message
function generateAIVibeMessage(balance: number, transactions: any[] | null, bills: any[] | null): string {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  
  // Analyze spending patterns
  const hasSpending = transactions && transactions.length > 0;
  const totalSpending = hasSpending ? transactions.reduce((sum, t) => sum + t.amount, 0) : 0;
  const hasUpcomingBills = bills && bills.length > 0;
  const totalBills = hasUpcomingBills ? bills.reduce((sum, b) => sum + Number(b.expected_amount), 0) : 0;
  
  // Generate vibe based on financial situation
  if (balance > 5000 && !hasSpending) {
    return "You're crushing it! 💪 Strong balance, no spending today. Keep this momentum going!";
  } else if (balance > 2000 && totalSpending < 100) {
    return "Solid day! 🎯 Good balance, controlled spending. You're in the financial sweet spot.";
  } else if (balance > 1000 && totalBills < balance * 0.3) {
    return "You're on track! 📈 Bills are manageable, balance is healthy. Consider saving the rest.";
  } else if (balance < 500) {
    return "Stay focused! 🔍 Balance is low. Review your spending and prioritize essentials.";
  } else if (isWeekend && hasSpending) {
    return "Weekend vibes! 🌅 Enjoy your weekend spending, but keep it reasonable. Balance looks good.";
  } else if (hasUpcomingBills && totalBills > balance * 0.5) {
    return "Plan ahead! ⚠️ Big bills coming. Consider reducing discretionary spending this week.";
  } else {
    return "You're doing great! 🌟 Keep monitoring your spending and stay within your daily budget.";
  }
}