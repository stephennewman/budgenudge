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
      return '💳 RECURRING BILLS\n\nNo upcoming recurring bills found.';
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
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const dayOfMonth = now.getDate();
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

        // Get this month's spending
        const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1);
        const { data: currentMonthTxns } = await supabase
          .from('transactions')
          .select('amount')
          .in('plaid_item_id', itemIds)
          .or(`merchant_name.ilike.%${targetMerchant}%,name.ilike.%${targetMerchant}%`)
          .gte('date', firstDayOfMonth.toISOString().split('T')[0])
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
      return "📊 SPENDING PACING\nJuly " + currentYear + "\n\nNo spending data found for Amazon, Publix, or Walmart.";
    }

    let message = `📊 SPENDING PACING\nJuly ${currentYear}\nMonth Progress: ${monthProgress.toFixed(0)}% (Day ${dayOfMonth})\n\n`;

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
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const monthProgress = (dayOfMonth / daysInMonth) * 100;

    let message = `📊 MERCHANT PACING\n${now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}\nMonth Progress: ${monthProgress.toFixed(0)}% (Day ${dayOfMonth})\n\n`;

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

        // Get this month's spending
        const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1);
        const { data: currentMonthTxns } = await supabase
          .from('transactions')
          .select('amount')
          .in('plaid_item_id', itemIds)
          .eq('ai_merchant_name', merchantName)
          .gte('date', firstDayOfMonth.toISOString().split('T')[0])
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
      return `📊 MERCHANT PACING\n${now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}\n\nNo spending data found for tracked merchants.`;
    }

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

    // Get current date info
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const monthProgress = Math.round((dayOfMonth / daysInMonth) * 100);

    // Get transactions for tracked categories (last 3 months for analysis)
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const analysisStartDate = `${threeMonthsAgo.getFullYear()}-${String(threeMonthsAgo.getMonth() + 1).padStart(2, '0')}-01`;
    const currentMonthStart = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;

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
      const isCurrentMonth = transaction.date >= currentMonthStart;

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
    const monthName = new Date(currentYear, currentMonth - 1).toLocaleDateString('en-US', { month: 'long' });
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

    // Ensure message fits within 918 character limit
    if (smsContent.length > 918) {
      smsContent = smsContent.substring(0, 915) + "...";
    }

    return smsContent;

  } catch (error) {
    console.error('Error generating category pacing message:', error);
    return "📱 Krezzo\n\nError generating category pacing analysis.";
  }
}

// ===================================
// UNIFIED TEMPLATE SELECTOR
// ===================================
export async function generateSMSMessage(userId: string, templateType: 'recurring' | 'recent' | 'merchant-pacing' | 'category-pacing'): Promise<string> {
  switch (templateType) {
    case 'recurring':
      return await generateRecurringTransactionsMessage(userId);
    case 'recent':
      return await generateRecentTransactionsMessage(userId);
    case 'merchant-pacing':
      return await generateMerchantPacingMessage(userId);
    case 'category-pacing':
      return await generateCategoryPacingMessage(userId);
    default:
      return "📱 Krezzo\n\nInvalid template type.";
  }
} 