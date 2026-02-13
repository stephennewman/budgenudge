import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/server';

interface CategoryInsight {
  category: string;
  baseline_monthly_avg: number;
  recent_30_day_avg: number;
  recent_14_day_avg: number;
  behavioral_change_30d: 'improving' | 'stable' | 'worsening';
  behavioral_change_14d: 'improving' | 'stable' | 'worsening';
  change_percentage_30d: number;
  change_percentage_14d: number;
  transaction_count_baseline: number;
  transaction_count_recent_30d: number;
  transaction_count_recent_14d: number;
  first_transaction_date: string;
  last_transaction_date: string;
}

interface MerchantInsight {
  merchant: string;
  baseline_monthly_avg: number;
  recent_30_day_avg: number;
  recent_14_day_avg: number;
  behavioral_change_30d: 'improving' | 'stable' | 'worsening';
  behavioral_change_14d: 'improving' | 'stable' | 'worsening';
  change_percentage_30d: number;
  change_percentage_14d: number;
  transaction_count_baseline: number;
  transaction_count_recent_30d: number;
  transaction_count_recent_14d: number;
  frequency_baseline: number; // days between transactions
  frequency_recent: number;
}

interface BehavioralInsightsResponse {
  user_signup_date: string;
  baseline_period_start: string;
  baseline_period_end: string;
  days_since_signup: number;
  total_baseline_days: number;
  categories: CategoryInsight[];
  merchants: MerchantInsight[];
  summary: {
    total_categories_analyzed: number;
    total_merchants_analyzed: number;
    categories_improving: number;
    categories_worsening: number;
    merchants_improving: number;
    merchants_worsening: number;
    overall_trend: 'improving' | 'stable' | 'worsening';
  };
}

function calculateBehavioralChange(baseline: number, recent: number): {
  change: 'improving' | 'stable' | 'worsening';
  percentage: number;
} {
  if (baseline === 0 && recent === 0) {
    return { change: 'stable', percentage: 0 };
  }
  
  if (baseline === 0 && recent > 0) {
    return { change: 'worsening', percentage: 100 }; // New spending where there was none
  }
  
  if (recent === 0 && baseline > 0) {
    return { change: 'improving', percentage: -100 }; // Eliminated spending
  }
  
  const percentage = ((recent - baseline) / baseline) * 100;
  
  // Consider improvements as spending less (negative percentage)
  // Consider worsening as spending more (positive percentage)
  let change: 'improving' | 'stable' | 'worsening' = 'stable';
  
  if (percentage < -15) { // More than 15% reduction in spending
    change = 'improving';
  } else if (percentage > 15) { // More than 15% increase in spending
    change = 'worsening';
  }
  
  return { change, percentage };
}

export async function GET() {
  try {
    const supabase = await createSupabaseClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's signup date from auth metadata
    const userSignupDate = new Date(user.created_at);
    const daysSinceSignup = Math.floor((Date.now() - userSignupDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Get user's item IDs to filter transactions
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('plaid_item_id')
      .eq('user_id', user.id);

    if (itemsError || !items?.length) {
      return NextResponse.json({ error: 'No connected accounts found' }, { status: 400 });
    }

    const itemIds = items.map(item => item.plaid_item_id);

    // Get all transactions (we'll filter by date ranges in code)
    const { data: transactions, error: fetchError } = await supabase
      .from('transactions')
      .select('id, amount, ai_merchant_name, ai_category_tag, date, merchant_name, name')
      .in('plaid_item_id', itemIds)
      .lt('amount', 0) // Only expenses (negative amounts in Plaid)
      .order('date', { ascending: true }); // Oldest first for baseline calculation

    if (fetchError) {
      console.error('Error fetching transactions:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({
        user_signup_date: userSignupDate.toISOString().split('T')[0],
        baseline_period_start: userSignupDate.toISOString().split('T')[0],
        baseline_period_end: userSignupDate.toISOString().split('T')[0],
        days_since_signup: daysSinceSignup,
        total_baseline_days: 0,
        categories: [],
        merchants: [],
        summary: {
          total_categories_analyzed: 0,
          total_merchants_analyzed: 0,
          categories_improving: 0,
          categories_worsening: 0,
          merchants_improving: 0,
          merchants_worsening: 0,
          overall_trend: 'stable' as const
        }
      });
    }

    // Calculate date ranges
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    const fourteenDaysAgo = new Date(now.getTime() - (14 * 24 * 60 * 60 * 1000));
    
    // For baseline calculation, we need enough historical data to establish patterns
    // Strategy: Use data from when user had transactions until recent tracking periods
    let baselineStartDate: Date;
    
    // Get the actual first and last transaction dates
    const firstTransactionDate = new Date(transactions[0].date + 'T12:00:00');
    
    // Always use transactions that are older than 30 days as baseline
    // This ensures we have a clear separation between baseline and recent behavior
    const baselineEndDate = new Date(thirtyDaysAgo.getTime() - (1 * 24 * 60 * 60 * 1000)); // End baseline 1 day before 30-day period
    
    // If user signed up more than 120 days ago, use 90 days starting from signup
    // Otherwise, use all available historical data before the 30-day period
    if (daysSinceSignup > 120) {
      baselineStartDate = userSignupDate;
      // But don't go beyond the available transaction history
      baselineStartDate = new Date(Math.max(baselineStartDate.getTime(), firstTransactionDate.getTime()));
    } else {
      // Use all available historical data as baseline
      baselineStartDate = firstTransactionDate;
    }
    
    // Ensure baseline period is meaningful (at least 14 days)
    const minimumBaselinePeriod = 14 * 24 * 60 * 60 * 1000; // 14 days in milliseconds
    if (baselineEndDate.getTime() - baselineStartDate.getTime() < minimumBaselinePeriod) {
      // If we don't have enough historical data, extend the baseline period
      baselineStartDate = new Date(baselineEndDate.getTime() - minimumBaselinePeriod);
    }

    // Filter transactions by periods
    const baselineTransactions = transactions.filter(tx => {
      const txDate = new Date(tx.date + 'T12:00:00');
      return txDate >= baselineStartDate && txDate <= baselineEndDate;
    });

    const thirtyDayTransactions = transactions.filter(tx => {
      const txDate = new Date(tx.date + 'T12:00:00');
      return txDate >= thirtyDaysAgo;
    });

    const fourteenDayTransactions = transactions.filter(tx => {
      const txDate = new Date(tx.date + 'T12:00:00');
      return txDate >= fourteenDaysAgo;
    });

    const baselineDays = Math.max(1, Math.ceil((baselineEndDate.getTime() - baselineStartDate.getTime()) / (1000 * 60 * 60 * 24)));

    // Analyze categories
    const categoryMap = new Map<string, {
      baseline: { total: number; count: number; transactions: { date: string; amount: number }[] };
      thirtyDay: { total: number; count: number };
      fourteenDay: { total: number; count: number };
    }>();

    // Process baseline transactions
    baselineTransactions.forEach(tx => {
      const category = tx.ai_category_tag || 'Uncategorized';
      if (!categoryMap.has(category)) {
        categoryMap.set(category, {
          baseline: { total: 0, count: 0, transactions: [] },
          thirtyDay: { total: 0, count: 0 },
          fourteenDay: { total: 0, count: 0 }
        });
      }
      const catData = categoryMap.get(category)!;
      catData.baseline.total += Math.abs(tx.amount);
      catData.baseline.count += 1;
      catData.baseline.transactions.push(tx);
    });

    // Process 30-day transactions
    thirtyDayTransactions.forEach(tx => {
      const category = tx.ai_category_tag || 'Uncategorized';
      if (!categoryMap.has(category)) {
        categoryMap.set(category, {
          baseline: { total: 0, count: 0, transactions: [] },
          thirtyDay: { total: 0, count: 0 },
          fourteenDay: { total: 0, count: 0 }
        });
      }
      const catData = categoryMap.get(category)!;
      catData.thirtyDay.total += Math.abs(tx.amount);
      catData.thirtyDay.count += 1;
    });

    // Process 14-day transactions
    fourteenDayTransactions.forEach(tx => {
      const category = tx.ai_category_tag || 'Uncategorized';
      if (!categoryMap.has(category)) {
        categoryMap.set(category, {
          baseline: { total: 0, count: 0, transactions: [] },
          thirtyDay: { total: 0, count: 0 },
          fourteenDay: { total: 0, count: 0 }
        });
      }
      const catData = categoryMap.get(category)!;
      catData.fourteenDay.total += Math.abs(tx.amount);
      catData.fourteenDay.count += 1;
    });

    // Convert to insights
    const categories: CategoryInsight[] = Array.from(categoryMap.entries())
      .filter(([, data]) => 
        // Include categories that have meaningful data in baseline or recent periods
        data.baseline.total > 0 || data.thirtyDay.total > 0 || data.fourteenDay.total > 0
      )
      .map(([category, data]) => {
        const baselineMonthlyAvg = (data.baseline.total / baselineDays) * 30;
        const recent30DayAvg = (data.thirtyDay.total / 30) * 30; // Already 30 days
        const recent14DayAvg = (data.fourteenDay.total / 14) * 30; // Convert to 30-day equivalent

        const change30d = calculateBehavioralChange(baselineMonthlyAvg, recent30DayAvg);
        const change14d = calculateBehavioralChange(baselineMonthlyAvg, recent14DayAvg);

        // Get date range from baseline transactions
        const baselineDates = data.baseline.transactions.map(tx => tx.date).sort();
        
        return {
          category,
          baseline_monthly_avg: baselineMonthlyAvg,
          recent_30_day_avg: recent30DayAvg,
          recent_14_day_avg: recent14DayAvg,
          behavioral_change_30d: change30d.change,
          behavioral_change_14d: change14d.change,
          change_percentage_30d: change30d.percentage,
          change_percentage_14d: change14d.percentage,
          transaction_count_baseline: data.baseline.count,
          transaction_count_recent_30d: data.thirtyDay.count,
          transaction_count_recent_14d: data.fourteenDay.count,
          first_transaction_date: baselineDates[0] || '',
          last_transaction_date: baselineDates[baselineDates.length - 1] || ''
        };
      })
      .sort((a, b) => b.baseline_monthly_avg - a.baseline_monthly_avg); // Sort by baseline spending

    // Analyze merchants (similar logic)
    const merchantMap = new Map<string, {
      baseline: { total: number; count: number; transactions: { date: string; amount: number }[] };
      thirtyDay: { total: number; count: number };
      fourteenDay: { total: number; count: number };
    }>();

    // Process baseline transactions for merchants
    baselineTransactions.forEach(tx => {
      const merchant = tx.ai_merchant_name || tx.merchant_name || tx.name || 'Unknown';
      if (!merchantMap.has(merchant)) {
        merchantMap.set(merchant, {
          baseline: { total: 0, count: 0, transactions: [] },
          thirtyDay: { total: 0, count: 0 },
          fourteenDay: { total: 0, count: 0 }
        });
      }
      const merchData = merchantMap.get(merchant)!;
      merchData.baseline.total += Math.abs(tx.amount);
      merchData.baseline.count += 1;
      merchData.baseline.transactions.push(tx);
    });

    // Process 30-day transactions for merchants
    thirtyDayTransactions.forEach(tx => {
      const merchant = tx.ai_merchant_name || tx.merchant_name || tx.name || 'Unknown';
      if (!merchantMap.has(merchant)) {
        merchantMap.set(merchant, {
          baseline: { total: 0, count: 0, transactions: [] },
          thirtyDay: { total: 0, count: 0 },
          fourteenDay: { total: 0, count: 0 }
        });
      }
      const merchData = merchantMap.get(merchant)!;
      merchData.thirtyDay.total += Math.abs(tx.amount);
      merchData.thirtyDay.count += 1;
    });

    // Process 14-day transactions for merchants
    fourteenDayTransactions.forEach(tx => {
      const merchant = tx.ai_merchant_name || tx.merchant_name || tx.name || 'Unknown';
      if (!merchantMap.has(merchant)) {
        merchantMap.set(merchant, {
          baseline: { total: 0, count: 0, transactions: [] },
          thirtyDay: { total: 0, count: 0 },
          fourteenDay: { total: 0, count: 0 }
        });
      }
      const merchData = merchantMap.get(merchant)!;
      merchData.fourteenDay.total += Math.abs(tx.amount);
      merchData.fourteenDay.count += 1;
    });

    const merchants: MerchantInsight[] = Array.from(merchantMap.entries())
      .filter(([, data]) => 
        // Include merchants with meaningful spending
        data.baseline.total > 10 || data.thirtyDay.total > 10 || data.fourteenDay.total > 10
      )
      .map(([merchant, data]) => {
        const baselineMonthlyAvg = (data.baseline.total / baselineDays) * 30;
        const recent30DayAvg = (data.thirtyDay.total / 30) * 30;
        const recent14DayAvg = (data.fourteenDay.total / 14) * 30;

        const change30d = calculateBehavioralChange(baselineMonthlyAvg, recent30DayAvg);
        const change14d = calculateBehavioralChange(baselineMonthlyAvg, recent14DayAvg);

        // Calculate frequency (days between transactions)
        const baselineDates = data.baseline.transactions.map(tx => tx.date).sort();
        let frequencyBaseline = baselineDays; // Default to full period if only one transaction
        if (baselineDates.length > 1) {
          const firstDate = new Date(baselineDates[0] + 'T12:00:00');
          const lastDate = new Date(baselineDates[baselineDates.length - 1] + 'T12:00:00');
          const totalDays = Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
          frequencyBaseline = totalDays / (baselineDates.length - 1);
        }

        // Calculate recent frequency (use 30-day data)
        let frequencyRecent = 30;
        if (data.thirtyDay.count > 1) {
          frequencyRecent = 30 / data.thirtyDay.count;
        }

        return {
          merchant,
          baseline_monthly_avg: baselineMonthlyAvg,
          recent_30_day_avg: recent30DayAvg,
          recent_14_day_avg: recent14DayAvg,
          behavioral_change_30d: change30d.change,
          behavioral_change_14d: change14d.change,
          change_percentage_30d: change30d.percentage,
          change_percentage_14d: change14d.percentage,
          transaction_count_baseline: data.baseline.count,
          transaction_count_recent_30d: data.thirtyDay.count,
          transaction_count_recent_14d: data.fourteenDay.count,
          frequency_baseline: frequencyBaseline,
          frequency_recent: frequencyRecent
        };
      })
      .sort((a, b) => b.baseline_monthly_avg - a.baseline_monthly_avg); // Sort by baseline spending

    // Calculate summary statistics
    const categoriesImproving = categories.filter(c => c.behavioral_change_30d === 'improving').length;
    const categoriesWorsening = categories.filter(c => c.behavioral_change_30d === 'worsening').length;
    const merchantsImproving = merchants.filter(m => m.behavioral_change_30d === 'improving').length;
    const merchantsWorsening = merchants.filter(m => m.behavioral_change_30d === 'worsening').length;

    // Determine overall trend based on majority
    let overallTrend: 'improving' | 'stable' | 'worsening' = 'stable';
    const totalImprovements = categoriesImproving + merchantsImproving;
    const totalWorsening = categoriesWorsening + merchantsWorsening;
    const totalAnalyzed = categories.length + merchants.length;

    if (totalAnalyzed > 0) {
      const improvementRatio = totalImprovements / totalAnalyzed;
      const worseningRatio = totalWorsening / totalAnalyzed;
      
      if (improvementRatio > 0.6) {
        overallTrend = 'improving';
      } else if (worseningRatio > 0.6) {
        overallTrend = 'worsening';
      }
    }

    const response: BehavioralInsightsResponse = {
      user_signup_date: userSignupDate.toISOString().split('T')[0],
      baseline_period_start: baselineStartDate.toISOString().split('T')[0],
      baseline_period_end: baselineEndDate.toISOString().split('T')[0],
      days_since_signup: daysSinceSignup,
      total_baseline_days: baselineDays,
      categories,
      merchants,
      summary: {
        total_categories_analyzed: categories.length,
        total_merchants_analyzed: merchants.length,
        categories_improving: categoriesImproving,
        categories_worsening: categoriesWorsening,
        merchants_improving: merchantsImproving,
        merchants_worsening: merchantsWorsening,
        overall_trend: overallTrend
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Error in behavioral insights API:', error);
    return NextResponse.json(
      { error: 'Failed to generate behavioral insights' }, 
      { status: 500 }
    );
  }
}
