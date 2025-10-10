import { createSupabaseClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

interface WeeklyData {
  week_start: string;
  total_spent: number;
  transaction_count: number;
  avg_transaction: number;
}

interface MerchantSummary {
  merchant: string;
  totalTransactions: number;
  totalSpent: number;
}

// Calculate week start (Sunday) for a given date
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Generate all weeks between start and end dates
function generateWeeks(startDate: Date, endDate: Date): string[] {
  const weeks: string[] = [];
  let current = getWeekStart(startDate);
  const end = getWeekStart(endDate);
  
  while (current <= end) {
    weeks.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 7);
  }
  return weeks;
}

export async function GET() {
  try {
    const supabase = await createSupabaseClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Step 1: Get user's plaid_item_ids
    const { data: userItems, error: itemsError } = await supabase
      .from('items')
      .select('plaid_item_id')
      .eq('user_id', user.id);

    if (itemsError || !userItems || userItems.length === 0) {
      return NextResponse.json({
        dateRange: { start: null, end: null, weekCount: 0 },
        topMerchants: [],
        weeklyData: {}
      });
    }

    const itemIds = userItems.map(item => item.plaid_item_id);

    // Date filtering: March 24, 2025 to today
    const startDate = '2025-03-24';
    const endDate = new Date().toISOString().split('T')[0];

    // Step 2: Get transaction date range
    const { data: dateRange, error: dateError } = await supabase
      .from('transactions')
      .select('date')
      .in('plaid_item_id', itemIds)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (dateError || !dateRange || dateRange.length === 0) {
      return NextResponse.json({
        dateRange: { start: null, end: null, weekCount: 0 },
        topMerchants: [],
        weeklyData: {}
      });
    }

    const firstDate = new Date(dateRange[0].date);
    const lastDate = new Date(endDate); // Use today's date, not last transaction
    
    const weekStart = getWeekStart(firstDate);
    const weekEnd = getWeekStart(lastDate);
    
    // Generate all weeks
    const allWeeks = generateWeeks(weekStart, weekEnd);

    // Step 3: Get all transactions (merchants + categories)
    // Note: Supabase has 1000 row default limit, so we need to paginate
    let allTransactions: any[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error: txError } = await supabase
        .from('transactions')
        .select('ai_merchant_name, merchant_name, ai_category_tag, amount')
        .in('plaid_item_id', itemIds)
        .gte('date', startDate)
        .lte('date', endDate)
        .range(from, from + pageSize - 1);

      if (txError) {
        throw txError;
      }

      if (data && data.length > 0) {
        allTransactions = allTransactions.concat(data);
        from += pageSize;
        hasMore = data.length === pageSize;
      } else {
        hasMore = false;
      }
    }

    // Process in JavaScript to get top 10
    const merchantCounts = new Map<string, { count: number; total: number }>();
    
    allTransactions?.forEach((tx) => {
      const merchant = tx.ai_merchant_name || tx.merchant_name;
      const amount = parseFloat(tx.amount);
      
      // Only count positive amounts (spending), skip negative (deposits/income)
      if (merchant && amount > 0) {
        const existing = merchantCounts.get(merchant) || { count: 0, total: 0 };
        merchantCounts.set(merchant, {
          count: existing.count + 1,
          total: existing.total + amount
        });
      }
    });

    const sortedMerchants = Array.from(merchantCounts.entries())
      .map(([merchant, data]) => ({
        merchant,
        total_transactions: data.count,
        total_spent: data.total
      }))
      .sort((a, b) => b.total_transactions - a.total_transactions)
      .slice(0, 10);

    // Process categories
    const categoryCounts = new Map<string, { count: number; total: number }>();
    
    allTransactions?.forEach((tx) => {
      const category = tx.ai_category_tag;
      const amount = parseFloat(tx.amount);
      
      // Only count positive amounts (spending), skip negative (deposits/income)
      if (category && amount > 0) {
        const existing = categoryCounts.get(category) || { count: 0, total: 0 };
        categoryCounts.set(category, {
          count: existing.count + 1,
          total: existing.total + amount
        });
      }
    });

    const sortedCategories = Array.from(categoryCounts.entries())
      .map(([category, data]) => ({
        category,
        total_transactions: data.count,
        total_spent: data.total
      }))
      .sort((a, b) => b.total_spent - a.total_spent)
      .slice(0, 10);

    // Step 4: Get weekly data (with pagination)
    let weeklyTransactions: any[] = [];
    from = 0;
    hasMore = true;

    while (hasMore) {
      const { data, error: weeklyError } = await supabase
        .from('transactions')
        .select('ai_merchant_name, merchant_name, ai_category_tag, date, amount')
        .in('plaid_item_id', itemIds)
        .gte('date', startDate)
        .lte('date', endDate)
        .range(from, from + pageSize - 1);

      if (weeklyError) {
        throw weeklyError;
      }

      if (data && data.length > 0) {
        weeklyTransactions = weeklyTransactions.concat(data);
        from += pageSize;
        hasMore = data.length === pageSize;
      } else {
        hasMore = false;
      }
    }

    // Group by merchant and week
    const weeklyData: { [merchant: string]: WeeklyData[] } = {};
    
    sortedMerchants.forEach(({ merchant }) => {
      const merchantTxs = weeklyTransactions?.filter(tx => 
        (tx.ai_merchant_name || tx.merchant_name) === merchant
      ) || [];

      // Group by week
      const weeklyMap = new Map<string, { total: number; count: number }>();
      
      merchantTxs.forEach(tx => {
        const amount = parseFloat(tx.amount);
        
        // Only include positive amounts (spending), skip negative (deposits/income)
        if (amount > 0) {
          const txDate = new Date(tx.date);
          const weekStartDate = getWeekStart(txDate);
          const weekKey = weekStartDate.toISOString().split('T')[0];
          
          const existing = weeklyMap.get(weekKey) || { total: 0, count: 0 };
          
          weeklyMap.set(weekKey, {
            total: existing.total + amount,
            count: existing.count + 1
          });
        }
      });

      // Fill all weeks (including zeros)
      const filledWeeks = allWeeks.map(week => {
        const data = weeklyMap.get(week);
        return {
          week_start: week,
          total_spent: data ? data.total : 0,
          transaction_count: data ? data.count : 0,
          avg_transaction: data && data.count > 0 
            ? data.total / data.count 
            : 0
        };
      });

      weeklyData[merchant] = filledWeeks;
    });

    // Group by category and week
    const categoryWeeklyData: { [category: string]: WeeklyData[] } = {};
    
    sortedCategories.forEach(({ category }) => {
      const categoryTxs = weeklyTransactions?.filter(tx => 
        tx.ai_category_tag === category
      ) || [];

      // Group by week
      const weeklyMap = new Map<string, { total: number; count: number }>();
      
      categoryTxs.forEach(tx => {
        const amount = parseFloat(tx.amount);
        
        // Only include positive amounts (spending), skip negative (deposits/income)
        if (amount > 0) {
          const txDate = new Date(tx.date);
          const weekStartDate = getWeekStart(txDate);
          const weekKey = weekStartDate.toISOString().split('T')[0];
          
          const existing = weeklyMap.get(weekKey) || { total: 0, count: 0 };
          
          weeklyMap.set(weekKey, {
            total: existing.total + amount,
            count: existing.count + 1
          });
        }
      });

      // Fill all weeks (including zeros)
      const filledWeeks = allWeeks.map(week => {
        const data = weeklyMap.get(week);
        return {
          week_start: week,
          total_spent: data ? data.total : 0,
          transaction_count: data ? data.count : 0,
          avg_transaction: data && data.count > 0 
            ? data.total / data.count 
            : 0
        };
      });

      categoryWeeklyData[category] = filledWeeks;
    });

    return NextResponse.json({
      dateRange: {
        start: weekStart.toISOString().split('T')[0],
        end: weekEnd.toISOString().split('T')[0],
        weekCount: allWeeks.length
      },
      topMerchants: sortedMerchants.map(m => ({
        merchant: m.merchant,
        totalTransactions: m.total_transactions,
        totalSpent: m.total_spent
      })),
      weeklyData,
      topCategories: sortedCategories.map(c => ({
        category: c.category,
        totalTransactions: c.total_transactions,
        totalSpent: c.total_spent
      })),
      categoryWeeklyData
    });

  } catch (error) {
    console.error('Error in merchant-weekly-analysis:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

