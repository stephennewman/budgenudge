import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/server';

interface TrendData {
  name: string;
  amount: number;
  change?: number;
  transactionCount: number;
}

interface TrendsData {
  weeklyMerchants: TrendData[];
  monthlyMerchants: TrendData[];
  weeklyCategories: TrendData[];
  monthlyCategories: TrendData[];
}

export async function GET() {
  try {
    const supabase = await createSupabaseClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`📈 Generating trends data for user ${user.id}`);

    // Get user's item IDs to filter transactions
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('plaid_item_id')
      .eq('user_id', user.id)
      .is('deleted_at', null);

    if (itemsError || !items?.length) {
      return NextResponse.json({ error: 'No connected accounts found' }, { status: 400 });
    }

    const itemIds = items.map(item => item.plaid_item_id);

    // Calculate date ranges
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Start of current week (Sunday)
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Previous periods for comparison
    const startOfPreviousWeek = new Date(startOfWeek);
    startOfPreviousWeek.setDate(startOfWeek.getDate() - 7);

    const startOfPreviousMonth = new Date(startOfMonth);
    startOfPreviousMonth.setMonth(startOfMonth.getMonth() - 1);

    console.log(`📅 Date ranges: Week ${startOfWeek.toISOString().split('T')[0]} to ${now.toISOString().split('T')[0]}`);
    console.log(`📅 Month range: ${startOfMonth.toISOString().split('T')[0]} to ${now.toISOString().split('T')[0]}`);

    // Fetch all transactions for the current periods
    const { data: currentTransactions, error: currentError } = await supabase
      .from('transactions')
      .select('id, amount, ai_merchant_name, ai_category_tag, merchant_name, name, date')
      .in('plaid_item_id', itemIds)
      .not('ai_merchant_name', 'is', null) // Only analyze tagged transactions
      .gte('date', startOfMonth.toISOString().split('T')[0]) // Get data from start of month
      .gt('amount', 0) // Only expenses (positive amounts in Plaid)
      .order('date', { ascending: false });

    if (currentError) {
      console.error('Error fetching current transactions:', currentError);
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }

    // Fetch previous period transactions for comparison
    const { data: previousTransactions, error: previousError } = await supabase
      .from('transactions')
      .select('id, amount, ai_merchant_name, ai_category_tag, merchant_name, name, date')
      .in('plaid_item_id', itemIds)
      .not('ai_merchant_name', 'is', null)
      .gte('date', startOfPreviousMonth.toISOString().split('T')[0])
      .lt('date', startOfMonth.toISOString().split('T')[0])
      .gt('amount', 0)
      .order('date', { ascending: false });

    if (previousError) {
      console.error('Error fetching previous transactions:', previousError);
      return NextResponse.json({ error: 'Failed to fetch previous transactions' }, { status: 500 });
    }

    console.log(`📊 Current transactions: ${currentTransactions?.length || 0}`);
    console.log(`📊 Previous transactions: ${previousTransactions?.length || 0}`);

    // Filter transactions by time periods
    const currentWeekTransactions = currentTransactions?.filter(tx => 
      new Date(tx.date) >= startOfWeek
    ) || [];

    const currentMonthTransactions = currentTransactions?.filter(tx => 
      new Date(tx.date) >= startOfMonth
    ) || [];

    const previousWeekTransactions = previousTransactions?.filter(tx => 
      new Date(tx.date) >= startOfPreviousWeek && new Date(tx.date) < startOfWeek
    ) || [];

    const previousMonthTransactions = previousTransactions?.filter(tx => 
      new Date(tx.date) >= startOfPreviousMonth && new Date(tx.date) < startOfMonth
    ) || [];

    console.log(`📊 Week transactions: Current ${currentWeekTransactions.length}, Previous ${previousWeekTransactions.length}`);
    console.log(`📊 Month transactions: Current ${currentMonthTransactions.length}, Previous ${previousMonthTransactions.length}`);

    // Process trends data
    const trendsData: TrendsData = {
      weeklyMerchants: processMerchantTrends(currentWeekTransactions, previousWeekTransactions),
      monthlyMerchants: processMerchantTrends(currentMonthTransactions, previousMonthTransactions),
      weeklyCategories: processCategoryTrends(currentWeekTransactions, previousWeekTransactions),
      monthlyCategories: processCategoryTrends(currentMonthTransactions, previousMonthTransactions),
    };

    console.log(`✅ Generated trends: ${trendsData.weeklyMerchants.length} weekly merchants, ${trendsData.monthlyMerchants.length} monthly merchants`);

    return NextResponse.json(trendsData);

  } catch (error) {
    console.error('Error generating trends:', error);
    return NextResponse.json(
      { error: 'Failed to generate trends data' },
      { status: 500 }
    );
  }
}

function processMerchantTrends(currentTransactions: Array<{amount: number; ai_merchant_name?: string; merchant_name?: string; name?: string}>, previousTransactions: Array<{amount: number; ai_merchant_name?: string; merchant_name?: string; name?: string}>): TrendData[] {
  // Group current transactions by merchant
  const currentMerchants = new Map<string, { amount: number; count: number }>();
  const previousMerchants = new Map<string, { amount: number; count: number }>();

  currentTransactions.forEach(tx => {
    const merchant = tx.ai_merchant_name || tx.merchant_name || tx.name || 'Unknown';
    const existing = currentMerchants.get(merchant) || { amount: 0, count: 0 };
    currentMerchants.set(merchant, {
      amount: existing.amount + tx.amount,
      count: existing.count + 1
    });
  });

  previousTransactions.forEach(tx => {
    const merchant = tx.ai_merchant_name || tx.merchant_name || tx.name || 'Unknown';
    const existing = previousMerchants.get(merchant) || { amount: 0, count: 0 };
    previousMerchants.set(merchant, {
      amount: existing.amount + tx.amount,
      count: existing.count + 1
    });
  });

  // Convert to array and calculate changes
  const trends: TrendData[] = Array.from(currentMerchants.entries()).map(([merchant, current]) => {
    const previous = previousMerchants.get(merchant) || { amount: 0, count: 0 };
    const change = previous.amount > 0 ? ((current.amount - previous.amount) / previous.amount) * 100 : undefined;

    return {
      name: merchant,
      amount: current.amount,
      change,
      transactionCount: current.count
    };
  });

  // Sort by amount (highest first)
  return trends.sort((a, b) => b.amount - a.amount);
}

function processCategoryTrends(currentTransactions: Array<{amount: number; ai_category_tag?: string}>, previousTransactions: Array<{amount: number; ai_category_tag?: string}>): TrendData[] {
  // Group current transactions by category
  const currentCategories = new Map<string, { amount: number; count: number }>();
  const previousCategories = new Map<string, { amount: number; count: number }>();

  currentTransactions.forEach(tx => {
    const category = tx.ai_category_tag || 'Uncategorized';
    const existing = currentCategories.get(category) || { amount: 0, count: 0 };
    currentCategories.set(category, {
      amount: existing.amount + tx.amount,
      count: existing.count + 1
    });
  });

  previousTransactions.forEach(tx => {
    const category = tx.ai_category_tag || 'Uncategorized';
    const existing = previousCategories.get(category) || { amount: 0, count: 0 };
    previousCategories.set(category, {
      amount: existing.amount + tx.amount,
      count: existing.count + 1
    });
  });

  // Convert to array and calculate changes
  const trends: TrendData[] = Array.from(currentCategories.entries()).map(([category, current]) => {
    const previous = previousCategories.get(category) || { amount: 0, count: 0 };
    const change = previous.amount > 0 ? ((current.amount - previous.amount) / previous.amount) * 100 : undefined;

    return {
      name: category,
      amount: current.amount,
      change,
      transactionCount: current.count
    };
  });

  // Sort by amount (highest first)
  return trends.sort((a, b) => b.amount - a.amount);
}
