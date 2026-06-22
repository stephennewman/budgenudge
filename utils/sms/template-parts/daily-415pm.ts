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

export async function generate415pmSpecialMessage(userId: string): Promise<string> {
  try {
    // Get user's first name for personalization
    const { data: authUser } = await supabase.auth.admin.getUserById(userId);
    const firstName = authUser?.user?.user_metadata?.firstName || authUser?.user?.user_metadata?.first_name || 'there';
    
    // Get user's item IDs
    const { data: userItems } = await supabase
      .from('items')
      .select('id, plaid_item_id')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (!userItems || userItems.length === 0) {
      return `📊 KREZZO 5 O'CLOCK SOMEWHERE REPORT\n\nHey ${firstName}! 👋\n\nNo bank accounts connected yet. Connect your bank to get personalized insights! 🏦`;
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

    let incomeCandidates: any[] = [];
    if (incomeProfile?.profile_data?.income_sources) {
      // Use the structured income data from the income page
      const incomeSources = incomeProfile.profile_data.income_sources;
      
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
      
    } else {
      // Fallback to transaction-based detection if no income profile exists
      const lookbackStart = new Date();
      lookbackStart.setDate(lookbackStart.getDate() - 120);
      const lb = lookbackStart.toISOString().split('T')[0];
      
      const { data: incomeTransactions } = await supabase
        .from('transactions')
        .select('date, merchant_name, name, amount, ai_category_tag')
        .in('plaid_item_id', itemIds)
        .lt('amount', 0) // Income transactions are negative
        .gte('date', lb)
        .order('date', { ascending: false });

      if (incomeTransactions && incomeTransactions.length > 0) {
        // Group by merchant and analyze patterns
        const merchantGroups = incomeTransactions.reduce((groups: any, txn) => {
          const merchant = txn.merchant_name || txn.name || 'Unknown';
          if (!groups[merchant]) {
            groups[merchant] = [];
          }
          groups[merchant].push(txn);
          return groups;
        }, {});

        // Analyze each merchant for patterns
        Object.entries(merchantGroups).forEach(([merchant, txns]: [string, any]) => {
          if (txns.length >= 2) {
            const amounts = txns.map((t: any) => Math.abs(t.amount));
            const dates = txns.map((t: any) => new Date(t.date));
            
            // Calculate average amount and frequency
            const avgAmount = amounts.reduce((sum: number, amt: number) => sum + amt, 0) / amounts.length;
            
            // Simple frequency detection (could be enhanced)
            const dateSpans = [];
            for (let i = 1; i < dates.length; i++) {
              const span = Math.abs(dates[i].getTime() - dates[i-1].getTime()) / (1000 * 60 * 60 * 24);
              dateSpans.push(span);
            }
            
            const avgFrequency = dateSpans.length > 0 ? dateSpans.reduce((sum: number, span: number) => sum + span, 0) / dateSpans.length : 30;
            
            // Predict next income date
            const lastDate = new Date(Math.max(...dates.map((d: Date) => d.getTime())));
            const nextDate = new Date(lastDate.getTime() + avgFrequency * 24 * 60 * 60 * 1000);
            
            incomeCandidates.push({
              source_name: merchant,
              expected_amount: avgAmount,
              frequency: avgFrequency <= 7 ? 'weekly' : avgFrequency <= 31 ? 'monthly' : 'biweekly',
              next_predicted_date: nextDate.toISOString().split('T')[0],
              last_pay_date: lastDate.toISOString().split('T')[0],
              confidence_score: 0.7
            });
          }
        });
      }
    }

    // Find next income
    const nextIncome = findNextIncome(incomeCandidates);
    
    // Get upcoming bills
    const { data: upcomingBills } = await supabase
      .from('recurring_bills')
      .select('merchant_name, expected_amount, next_predicted_date')
      .eq('user_id', userId)
      .gte('next_predicted_date', now.toISOString().split('T')[0])
      .order('next_predicted_date', { ascending: true });

    // Calculate bills before next income
    let billsBeforeIncome: any[] = [];
    let totalBillsBeforeIncome = 0;
    
    if (nextIncome && upcomingBills) {
      billsBeforeIncome = upcomingBills.filter(bill => 
        new Date(bill.next_predicted_date) <= new Date(nextIncome.next_predicted_date)
      );
      totalBillsBeforeIncome = billsBeforeIncome.reduce((sum, bill) => sum + (bill.expected_amount || 0), 0);
    }

    // Calculate expected balance and daily spending limits
    const expectedBalanceBeforeIncome = totalAvailableBalance - totalBillsBeforeIncome + Number(nextIncome?.expected_amount || 0);
    const daysUntilIncomeRaw = nextIncome && nextIncome.next_predicted_date
      ? Math.ceil((new Date(nextIncome.next_predicted_date + 'T12:00:00').getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : 30;
    const daysUntilIncome = Math.max(1, daysUntilIncomeRaw);
    const maxDailySpend = expectedBalanceBeforeIncome / daysUntilIncome;

    // Get category pacing data for display
    let categoryPacingData: any[] = [];
    if (trackedCategories && trackedCategories.length > 0) {
      for (const category of trackedCategories) {
        const { data: pacing } = await supabase
          .from('category_pacing_tracking')
          .select('current_month_spend, expected_by_now, is_active')
          .eq('user_id', userId)
          .eq('ai_category', category.ai_category)
          .eq('is_active', true)
          .single();

        if (pacing && pacing.is_active) {
          const currentSpend = pacing.current_month_spend || 0;
          const expectedByNow = pacing.expected_by_now || 0;
          const pacingPercentage = expectedByNow > 0 ? (currentSpend / expectedByNow) * 100 : 0;
          
          categoryPacingData.push({
            category: category.ai_category,
            currentMonthSpend: currentSpend,
            expectedByNow: expectedByNow,
            pacing: pacingPercentage
          });
        }
      }
    }

    // Get merchant pacing data for display
    let merchantPacingData: any[] = [];
    if (trackedMerchants && trackedMerchants.length > 0) {
      for (const merchant of trackedMerchants) {
        const { data: pacing } = await supabase
          .from('merchant_pacing_tracking')
          .select('current_month_spend, expected_by_now, is_active')
          .eq('user_id', userId)
          .eq('ai_merchant_name', merchant.ai_merchant_name)
          .eq('is_active', true)
          .single();

        if (pacing && pacing.is_active) {
          const currentSpend = pacing.current_month_spend || 0;
          const expectedByNow = pacing.expected_by_now || 0;
          const pacingPercentage = expectedByNow > 0 ? (currentSpend / expectedByNow) * 100 : 0;
          
          merchantPacingData.push({
            merchant: merchant.ai_merchant_name,
            currentMonthSpend: currentSpend,
            expectedByNow: expectedByNow,
            pacing: pacingPercentage
          });
        }
      }
    }

    // Sort by pacing (worst first)
    categoryPacingData.sort((a, b) => b.pacing - a.pacing);
    merchantPacingData.sort((a, b) => b.pacing - a.pacing);

    // Generate the message
    let message = `📊 KREZZO 5 O'CLOCK SOMEWHERE REPORT\n\nHey ${firstName}! Here's your daily financial snapshot:\n\n`;

    // YESTERDAY'S ACTIVITY
    message += `YESTERDAY'S ACTIVITY\n━━━━━━━━━━━━━━━━━━\n`;
    if (yesterdayTransactions && yesterdayTransactions.length > 0) {
      message += `${yesterdayTransactions.length} transactions posted\n`;
      const totalSpent = yesterdayTransactions.reduce((sum, t) => sum + t.amount, 0);
      message += `Total spent: $${(totalSpent || 0).toFixed(2)}\n`;
    } else {
      message += `No transactions posted\n`;
      message += `Total spent: $0.00\n`;
    }
    message += `Balance: $${(yesterdayBalance || 0).toFixed(2)}\n\n`;

    // SPENDING PACE
    message += `📊 SPENDING PACE\n━━━━━━━━━━━━━━━━━━\n`;
    if (categoryPacingData.length > 0) {
      // Separate categories by status
      const overCategories = categoryPacingData.filter(cat => cat.pacing > 100);
      const approachingCategories = categoryPacingData.filter(cat => cat.pacing >= 90 && cat.pacing <= 100);
      const goodCategories = categoryPacingData.filter(cat => cat.pacing < 90);
      
      // Show all reds/over first
      overCategories.forEach(cat => {
        message += `${cat.category.toUpperCase()}\n`;
        message += `Spent: $${(cat.currentMonthSpend || 0).toFixed(0)}\n`;
        message += `Expected: $${(cat.expectedByNow || 0).toFixed(0)}\n`;
        message += `🚨 OVER by ${Math.round((cat.pacing || 0) - 100)}%\n\n`;
      });
      
      // Show all yellows/approaching
      approachingCategories.forEach(cat => {
        message += `${cat.category.toUpperCase()}\n`;
        message += `Spent: $${(cat.currentMonthSpend || 0).toFixed(0)}\n`;
        message += `Expected: $${(cat.expectedByNow || 0).toFixed(0)}\n`;
        message += `⚠️ APPROACHING OVER by ${Math.round(100 - (cat.pacing || 0))}%\n\n`;
      });
      
      // Show one good category
      if (goodCategories.length > 0) {
        const bestCategory = goodCategories[0];
        message += `${bestCategory.category.toUpperCase()}\n`;
        message += `Spent: $${(bestCategory.currentMonthSpend || 0).toFixed(0)}\n`;
        message += `Expected: $${(bestCategory.expectedByNow || 0).toFixed(0)}\n`;
        message += `✅ GOOD by ${Math.round(100 - (bestCategory.pacing || 0))}%\n\n`;
      }
    } else {
      message += `No categories tracked yet\n\n`;
    }

    // MERCHANT WATCH
    message += `🏪 MERCHANT WATCH\n━━━━━━━━━━━━━━━━━━\n`;
    if (merchantPacingData.length > 0) {
      // Separate merchants by status
      const overMerchants = merchantPacingData.filter(merch => merch.pacing > 100);
      const approachingMerchants = merchantPacingData.filter(merch => merch.pacing >= 90 && merch.pacing <= 100);
      const goodMerchants = merchantPacingData.filter(merch => merch.pacing < 90);
      
      // Show all reds/over first
      overMerchants.forEach(merch => {
        message += `${merch.merchant.toUpperCase()}\n`;
        message += `Spent: $${(merch.currentMonthSpend || 0).toFixed(0)}\n`;
        message += `Expected: $${(merch.expectedByNow || 0).toFixed(0)}\n`;
        message += `🚨 OVER by ${Math.round((merch.pacing || 0) - 100)}%\n\n`;
      });
      
      // Show all yellows/approaching
      approachingMerchants.forEach(merch => {
        message += `${merch.merchant.toUpperCase()}\n`;
        message += `Spent: $${(merch.currentMonthSpend || 0).toFixed(0)}\n`;
        message += `Expected: $${(merch.expectedByNow || 0).toFixed(0)}\n`;
        message += `⚠️ APPROACHING OVER by ${Math.round(100 - (merch.pacing || 0))}%\n\n`;
      });
      
      // Show one good merchant
      if (goodMerchants.length > 0) {
        const bestMerchant = goodMerchants[0];
        message += `${bestMerchant.merchant.toUpperCase()}\n`;
        message += `Spent: $${(bestMerchant.currentMonthSpend || 0).toFixed(0)}\n`;
        message += `Expected: $${(bestMerchant.expectedByNow || 0).toFixed(0)}\n`;
        message += `✅ GOOD by ${Math.round(100 - (bestMerchant.pacing || 0))}%\n\n`;
      }
    } else {
      message += `No merchants tracked yet\n\n`;
    }

    // INCOME FORECAST
    message += `💰 INCOME FORECAST\n━━━━━━━━━━━━━━━━━━\n`;
    if (nextIncome && nextIncome.next_predicted_date) {
      const incomeDate = new Date(nextIncome.next_predicted_date + 'T12:00:00');
      const daysUntilIncome = Math.max(0, Math.ceil((incomeDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      message += `$${Number(nextIncome.expected_amount || 0).toFixed(0)} expected income in ${daysUntilIncome} days\n\n`;
    } else {
      message += `No income patterns detected\n\n`;
    }

    // UPCOMING EXPENSES
    message += `💸 UPCOMING EXPENSES\n━━━━━━━━━━━━━━━━━━\n`;
    if (billsBeforeIncome && billsBeforeIncome.length > 0 && nextIncome && nextIncome.next_predicted_date) {
      const incomeDate = new Date(nextIncome.next_predicted_date + 'T12:00:00');
      const daysUntilIncome = Math.max(0, Math.ceil((incomeDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      message += `(${billsBeforeIncome.length}) expenses for $${(totalBillsBeforeIncome || 0).toFixed(0)} expected next ${daysUntilIncome} days\n\n`;
      
      // Show individual bills with dates
      billsBeforeIncome.forEach(bill => {
        const billDate = new Date(bill.next_predicted_date + 'T12:00:00');
        const daysUntilBill = Math.ceil((billDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const billName = bill.merchant_name || 'Unknown Bill';
        const billAmount = Number(bill.expected_amount || 0).toFixed(0);
        
        if (daysUntilBill === 0) {
          message += `TODAY: ${billName} - $${billAmount}\n`;
        } else if (daysUntilBill === 1) {
          message += `TOMORROW: ${billName} - $${billAmount}\n`;
        } else {
          message += `Day ${daysUntilBill}: ${billName} - $${billAmount}\n`;
        }
      });
      message += `\n`;
      
      // Add micro-budget calculation
      message += `Your micro-budget: $${(maxDailySpend || 0).toFixed(0)} per day × ${daysUntilIncome} days = $${((maxDailySpend || 0) * daysUntilIncome).toFixed(0)} total available\n\n`;
    } else {
      message += `No bills before next income\n\n`;
    }



    // Status
    if (maxDailySpend < 50) {
      message += `🔴 STATUS: Tight daily budget - prioritize essentials\n`;
    } else if (maxDailySpend < 100) {
      message += `🟡 STATUS: Moderate daily spending flexibility\n`;
    } else {
      message += `🟢 STATUS: Good daily spending flexibility\n`;
    }
    message += `\n`;

    // DAILY INSIGHT
    message += `🎯 DAILY INSIGHT\n━━━━━━━━━━━━━━━━━━\n`;
    message += generateEnhancedAIVibeMessage(expectedBalanceBeforeIncome, yesterdayTransactions, billsBeforeIncome, firstName);
    message += `\n\n`;

    // ACTION ITEM
    message += `🚀 ACTION ITEM\n━━━━━━━━━━━━━━━━━━\n`;
    const actionItems = generateActionItems(categoryPacingData, merchantPacingData, billsBeforeIncome || [], expectedBalanceBeforeIncome);
    if (actionItems.length > 0) {
      message += actionItems[0]; // Show first action item
    } else {
      message += `Keep up the great financial management!`;
    }

    return message;

  } catch (error) {
    console.error('❌ Error generating 5:30 PM special SMS:', error);
    return `📊 KREZZO REPORT\n\nHey there! 👋\n\nSorry, I encountered an error while generating your financial report. Please try again later or contact support if the issue persists.`;
  }
}

// ===================================
// 9b. DAILY SNAPSHOT (V2) - from scratch, concise
// ===================================
