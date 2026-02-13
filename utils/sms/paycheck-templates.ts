import { createClient } from '@supabase/supabase-js';
import { DateTime } from 'luxon';

interface IncomeSource {
  id: number;
  income_source_name: string;
  expected_amount: number;
  frequency: string;
  last_income_date: string;
  next_predicted_date: string;
  confidence_score: number;
  account_identifier: string;
}

interface PaycheckPeriodData {
  period_start: string;
  period_end: string;
  days_in_period: number;
  days_remaining: number;
  income_amount: number;
  income_source: string;
  next_paycheck_date: string;
}

/**
 * Generate paycheck efficiency analysis SMS for any user
 */
export async function generatePaycheckEfficiencyMessage(userId: string): Promise<string> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // Get enhanced income data (conversational or auto-detected)
    const incomeData = await getEnhancedIncomeData(userId, supabase);
    
    if (incomeData.income_sources.length === 0) {
      return `💰 PAYCHECK EFFICIENCY
No income sources detected yet

💡 Tip: Set up your income profile in Settings → Income Setup for personalized insights based on your specific paycheck schedule.

📊 Available Balance: Loading...
💸 Recent Spending: Analyzing...`;
    }

    // Get the primary income source (highest amount or first one)
    const primaryIncome = incomeData.income_sources.reduce((max: any, source: any) => 
      source.amount > max.amount ? source : max
    );

    const { data: userItems } = await supabase
      .from('items')
      .select('plaid_item_id')
      .eq('user_id', userId);

    if (!userItems || userItems.length === 0) {
      return `💰 PAYCHECK EFFICIENCY
${primaryIncome.source_name} - ${primaryIncome.pattern_type}

❌ No bank accounts connected
Connect your bank account to see spending analysis`;
    }

    // Calculate next paycheck date using conversational schedule if available
    let nextPaycheckDate: Date;
    if (incomeData.source === 'conversational' && primaryIncome.schedule) {
      nextPaycheckDate = calculateNextPaycheckFromSchedule(primaryIncome.schedule, primaryIncome.pattern_type);
    } else {
      // Fallback to simple calculation
      nextPaycheckDate = new Date();
      nextPaycheckDate.setDate(nextPaycheckDate.getDate() + 14);
    }

    const daysUntilPaycheck = Math.ceil((nextPaycheckDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    // Calculate current paycheck period spending
    const paycheckPeriodStart = new Date(nextPaycheckDate);
    paycheckPeriodStart.setDate(paycheckPeriodStart.getDate() - (primaryIncome.pattern_type === 'bi-weekly' ? 14 : 
                                                                 primaryIncome.pattern_type === 'weekly' ? 7 :
                                                                 primaryIncome.pattern_type === 'monthly' ? 30 : 15));

    const { data: periodTransactions } = await supabase
      .from('transactions')
      .select('amount, merchant_name, ai_category_tag')
      .in('plaid_item_id', userItems.map(item => item.plaid_item_id))
      .gte('date', paycheckPeriodStart.toISOString().split('T')[0])
      .lt('date', new Date().toISOString().split('T')[0])
      .gt('amount', 0) // Only expenses
      .eq('pending', false);

    const totalSpent = periodTransactions?.reduce((sum, t) => sum + t.amount, 0) || 0;
    const spendingPercentage = Math.round((totalSpent / primaryIncome.amount) * 100);
    const remainingBudget = primaryIncome.amount - totalSpent;
    const dailyBudgetRemaining = daysUntilPaycheck > 0 ? Math.round(remainingBudget / daysUntilPaycheck) : 0;

    // Get top spending category
    const categorySpending: { [key: string]: number } = {};
    periodTransactions?.forEach(t => {
      const category = t.ai_category_tag || 'Other';
      categorySpending[category] = (categorySpending[category] || 0) + t.amount;
    });

    const topCategory = Object.entries(categorySpending)
      .sort(([,a], [,b]) => b - a)[0];

    const spendingPace = spendingPercentage > 100 ? 'over budget' : 
                         spendingPercentage > 75 ? 'ahead' : 
                         spendingPercentage > 50 ? 'on track' : 'under budget';

    const statusEmoji = incomeData.source === 'conversational' ? '🤖' : '🔍';
    const sourceNote = incomeData.source === 'conversational' ? 'AI-configured schedule' : 'Auto-detected pattern';

    return `💰 PAYCHECK EFFICIENCY
${primaryIncome.source_name} - ${primaryIncome.pattern_type}
${statusEmoji} ${sourceNote}

💳 Income: $${primaryIncome.amount.toLocaleString()} (${primaryIncome.pattern_type})
💸 Spent: $${totalSpent.toLocaleString()} (${spendingPercentage}% of paycheck)
💰 Remaining: $${remainingBudget.toLocaleString()}
📅 Days left: ${daysUntilPaycheck} until next paycheck

🎯 Daily budget remaining: $${dailyBudgetRemaining}/day
📈 Spending pace: ${spendingPace}

🏷️ Top spending this period:
1. ${topCategory?.[0] || 'Other'}: $${Math.round(topCategory?.[1] || 0).toLocaleString()}`;

  } catch (error) {
    console.error('Error generating paycheck efficiency message:', error);
    return `💰 PAYCHECK EFFICIENCY

❌ Error analyzing your paycheck efficiency. Please try again later.`;
  }
}

/**
 * Generate cash flow runway analysis for any user
 */
export async function generateCashFlowRunwayMessage(userId: string): Promise<string> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // Get enhanced income data
    const incomeData = await getEnhancedIncomeData(userId, supabase);
    
    if (incomeData.income_sources.length === 0) {
      return `🛤️ CASH FLOW RUNWAY

❌ No income sources detected
Set up your income profile for personalized cash flow analysis`;
    }

    // Get current balance
    const { data: userItems } = await supabase
      .from('items')
      .select('plaid_item_id')
      .eq('user_id', userId);

    if (!userItems || userItems.length === 0) {
      return `🛤️ CASH FLOW RUNWAY

❌ No bank accounts connected`;
    }

    const { data: accounts } = await supabase
      .from('accounts')
      .select('available_balance')
      .in('plaid_item_id', userItems.map(item => item.plaid_item_id))
      .eq('subtype', 'checking');

    const currentBalance = accounts?.reduce((sum, acc) => sum + (acc.available_balance || 0), 0) || 0;

    // Find next income source
    const primaryIncome = incomeData.income_sources[0];
    let nextPaycheckDate: Date;
    
    if (incomeData.source === 'conversational' && primaryIncome.schedule) {
      nextPaycheckDate = calculateNextPaycheckFromSchedule(primaryIncome.schedule, primaryIncome.pattern_type);
    } else {
      nextPaycheckDate = new Date();
      nextPaycheckDate.setDate(nextPaycheckDate.getDate() + 14);
    }

    const daysUntilIncome = Math.ceil((nextPaycheckDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    // Get upcoming bills
    const { data: upcomingBills } = await supabase
      .from('transactions')
      .select('amount, merchant_name')
      .in('plaid_item_id', userItems.map(item => item.plaid_item_id))
      .gte('date', new Date().toISOString().split('T')[0])
      .lte('date', nextPaycheckDate.toISOString().split('T')[0])
      .gt('amount', 0);

    const billsDue = upcomingBills?.reduce((sum, bill) => sum + bill.amount, 0) || 0;

    // Estimate daily spending
    const { data: recentSpending } = await supabase
      .from('transactions')
      .select('amount')
      .in('plaid_item_id', userItems.map(item => item.plaid_item_id))
      .gte('date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .gt('amount', 0)
      .eq('pending', false);

    const weeklySpending = recentSpending?.reduce((sum, t) => sum + t.amount, 0) || 0;
    const dailySpending = Math.round(weeklySpending / 7);
    const projectedSpending = dailySpending * daysUntilIncome;
    const totalProjected = billsDue + projectedSpending;

    const balanceAfterIncome = currentBalance - totalProjected + primaryIncome.amount;
    
    let statusMessage = '';
    if (currentBalance < totalProjected) {
      statusMessage = '⚠️ Cash flow tight but manageable';
    } else if (balanceAfterIncome > primaryIncome.amount) {
      statusMessage = '✅ Strong cash flow position';
    } else {
      statusMessage = '📊 Balanced cash flow';
    }

    const sourceEmoji = incomeData.source === 'conversational' ? '🤖' : '🔍';
    const multiSource = incomeData.income_sources.length > 1;

    return `🛤️ CASH FLOW RUNWAY
${multiSource ? 'Multiple income sources detected' : primaryIncome.source_name}
${sourceEmoji} ${incomeData.source === 'conversational' ? 'AI-configured' : 'Auto-detected'}

💰 Current balance: $${currentBalance.toLocaleString()}
📅 Days until next paycheck: ${daysUntilIncome}

📊 Projected expenses:
• Bills due: $${Math.round(billsDue).toLocaleString()}
• Daily spending: $${dailySpending.toLocaleString()}
• Total projected: $${Math.round(totalProjected).toLocaleString()}

💰 Balance after ${primaryIncome.source_name}: $${Math.round(balanceAfterIncome).toLocaleString()}
${statusMessage}`;

  } catch (error) {
    console.error('Error generating cash flow runway message:', error);
    return `🛤️ CASH FLOW RUNWAY

❌ Error calculating cash flow runway. Please try again later.`;
  }
}

/**
 * Main function to generate paycheck-period SMS based on user's income timing
 */
export async function generateSMSMessageForUser(userId: string, templateType: 'paycheck-efficiency' | 'cash-flow-runway'): Promise<string> {
  switch (templateType) {
    case 'paycheck-efficiency':
      return await generatePaycheckEfficiencyMessage(userId);
    case 'cash-flow-runway':
      return await generateCashFlowRunwayMessage(userId);
    default:
      return '📱 Krezzo\n\nInvalid paycheck template type.';
  }
}

// Helper functions

function calculateCurrentPaycheckPeriod(incomeSource: IncomeSource): PaycheckPeriodData {
  const lastPaycheck = new Date(incomeSource.last_income_date);
  const nextPaycheck = new Date(incomeSource.next_predicted_date);
  const today = new Date();
  
  // If we're past the predicted next paycheck date, assume we're in the next period
  let periodStart = lastPaycheck;
  let periodEnd = nextPaycheck;
  
  if (today > nextPaycheck) {
    // We're likely in a new period that hasn't been updated yet
    const intervalDays = Math.round((nextPaycheck.getTime() - lastPaycheck.getTime()) / (1000 * 60 * 60 * 24));
    periodStart = nextPaycheck;
    periodEnd = new Date(nextPaycheck);
    periodEnd.setDate(periodEnd.getDate() + intervalDays);
  }
  
  const totalDays = Math.round((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
  const daysRemaining = Math.max(0, Math.round((periodEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
  
  return {
    period_start: periodStart.toISOString().split('T')[0],
    period_end: periodEnd.toISOString().split('T')[0],
    days_in_period: totalDays,
    days_remaining: daysRemaining,
    income_amount: incomeSource.expected_amount,
    income_source: incomeSource.income_source_name,
    next_paycheck_date: periodEnd.toISOString().split('T')[0]
  };
}

function getTopSpendingCategories(transactions: any[], limit: number) {
  const categoryTotals = new Map<string, number>();
  
  transactions.forEach(transaction => {
    const category = transaction.category?.[0] || transaction.ai_category_tag || 'Other';
    const amount = Math.abs(transaction.amount);
    categoryTotals.set(category, (categoryTotals.get(category) || 0) + amount);
  });
  
  return Array.from(categoryTotals.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}

function formatFrequency(frequency: string): string {
  switch (frequency) {
    case 'weekly': return 'weekly';
    case 'bi-weekly': return 'bi-weekly';
    case 'bi-monthly': return 'bi-monthly';
    case 'monthly': return 'monthly';
    default: return frequency;
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  });
} 

// NEW: Get income profile from conversational AI system
async function getUserIncomeProfile(userId: string, supabase: any) {
  try {
    const { data: profile, error } = await supabase
      .from('user_income_profiles')
      .select('profile_data, setup_completed')
      .eq('user_id', userId)
      .single();
    
    if (error || !profile?.setup_completed) {
      return null;
    }
    
    return profile.profile_data;
  } catch (error) {
    return null;
  }
}

// NEW: Enhanced income source detection with conversational profiles
async function getEnhancedIncomeData(userId: string, supabase: any) {
  // First try conversational AI profile
  const conversationalProfile = await getUserIncomeProfile(userId, supabase);
  
  if (conversationalProfile && conversationalProfile.income_sources) {
    return {
      source: 'conversational',
      income_sources: conversationalProfile.income_sources,
      shared_account: conversationalProfile.shared_account || false
    };
  }
  
  // Fallback to automatic detection
  const { data: autoDetected } = await supabase
    .from('tagged_income_sources')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('confidence_score', { ascending: false });
  
  if (autoDetected && autoDetected.length > 0) {
    return {
      source: 'auto_detected',
      income_sources: autoDetected.map((source: any) => ({
        source_name: source.merchant_name,
        pattern_type: source.frequency_pattern,
        schedule: source.pattern_details,
        amount: source.average_amount,
        person: 'auto_detected'
      })),
      shared_account: false
    };
  }
  
  return { source: 'none', income_sources: [], shared_account: false };
}

// NEW: Calculate next paycheck date from conversational schedule
function calculateNextPaycheckFromSchedule(schedule: any, pattern_type: string): Date {
  const now = DateTime.now();
  
  switch (pattern_type) {
    case 'bi-monthly':
      // Handle 15th and last day of month
      if (schedule.days && Array.isArray(schedule.days)) {
        const [day1, day2] = schedule.days;
        const currentMonth = now.month;
        const currentYear = now.year;
        
        // Check 15th of current month
        let next15th = DateTime.fromObject({ year: currentYear, month: currentMonth, day: Math.abs(day1) });
        if (schedule.business_day_adjustment && (next15th.weekday === 6 || next15th.weekday === 7)) {
          next15th = next15th.minus({ days: next15th.weekday === 6 ? 1 : 2 });
        }
        
        // Check last day of current month
        let lastDay = DateTime.fromObject({ year: currentYear, month: currentMonth }).endOf('month');
        if (schedule.business_day_adjustment && (lastDay.weekday === 6 || lastDay.weekday === 7)) {
          lastDay = lastDay.minus({ days: lastDay.weekday === 6 ? 1 : 2 });
        }
        
        // Return the next one in the future
        if (now < next15th) return next15th.toJSDate();
        if (now < lastDay) return lastDay.toJSDate();
        
        // Next month's 15th
        const nextMonth15th = next15th.plus({ months: 1 });
        return nextMonth15th.toJSDate();
      }
      break;
      
    case 'bi-weekly':
      // Handle every other Friday or specific bi-weekly pattern
      if (schedule.day_of_week) {
        const targetDay = schedule.day_of_week; // 5 = Friday
        let nextPayday = now.set({ weekday: targetDay });
        
        if (nextPayday <= now) {
          nextPayday = nextPayday.plus({ weeks: 1 });
        }
        
        // For bi-weekly, we'd need to check if this is the right week
        // For simplicity, we'll return the next occurrence
        return nextPayday.toJSDate();
      }
      break;
      
    case 'weekly':
      if (schedule.day_of_week) {
        let nextPayday = now.set({ weekday: schedule.day_of_week });
        if (nextPayday <= now) {
          nextPayday = nextPayday.plus({ weeks: 1 });
        }
        return nextPayday.toJSDate();
      }
      break;
      
    case 'monthly':
      if (schedule.day) {
        let nextPayday = now.set({ day: schedule.day });
        if (schedule.business_day_adjustment && (nextPayday.weekday === 6 || nextPayday.weekday === 7)) {
          nextPayday = nextPayday.minus({ days: nextPayday.weekday === 6 ? 1 : 2 });
        }
        
        if (nextPayday <= now) {
          nextPayday = nextPayday.plus({ months: 1 });
        }
        return nextPayday.toJSDate();
      }
      break;
  }
  
  // Fallback: 14 days from now
  return now.plus({ days: 14 }).toJSDate();
} 