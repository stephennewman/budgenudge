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
