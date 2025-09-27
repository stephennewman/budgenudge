import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/server';

interface TimeSeriesData {
  period: string; // "2025-02-01" or "2025-W06"
  amount: number;
  transactionCount: number;
  merchants: Array<{name: string; amount: number; count: number}>;
  categories: Array<{name: string; amount: number; count: number}>;
}

interface HistoricalTrendsData {
  weeklyData: TimeSeriesData[];
  monthlyData: TimeSeriesData[];
  firstTransactionDate: string;
  lastTransactionDate: string;
}

export async function GET() {
  try {
    const supabase = await createSupabaseClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`📈 Generating historical trends data for user ${user.id}`);

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

    // Fetch ALL transactions for the user (historical data)
    const { data: allTransactions, error: transactionsError } = await supabase
      .from('transactions')
      .select('id, amount, ai_merchant_name, ai_category_tag, merchant_name, name, date')
      .in('plaid_item_id', itemIds)
      .not('ai_merchant_name', 'is', null) // Only analyze tagged transactions
      .gt('amount', 0) // Only expenses (positive amounts in Plaid)
      .order('date', { ascending: true }); // Chronological order

    if (transactionsError) {
      console.error('Error fetching transactions:', transactionsError);
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }

    if (!allTransactions || allTransactions.length === 0) {
      return NextResponse.json({ 
        weeklyData: [],
        monthlyData: [],
        firstTransactionDate: '',
        lastTransactionDate: ''
      });
    }

    console.log(`📊 Processing ${allTransactions.length} historical transactions`);

    // Get date range
    const firstTransactionDate = allTransactions[0].date;
    const lastTransactionDate = allTransactions[allTransactions.length - 1].date;

    console.log(`📅 Date range: ${firstTransactionDate} to ${lastTransactionDate}`);

    // Generate weekly and monthly time series data
    const weeklyData = generateWeeklyTimeSeries(allTransactions, firstTransactionDate, lastTransactionDate);
    const monthlyData = generateMonthlyTimeSeries(allTransactions, firstTransactionDate, lastTransactionDate);

    const trendsData: HistoricalTrendsData = {
      weeklyData,
      monthlyData,
      firstTransactionDate,
      lastTransactionDate
    };

    console.log(`✅ Generated historical trends: ${weeklyData.length} weekly periods, ${monthlyData.length} monthly periods`);

    return NextResponse.json(trendsData);

  } catch (error) {
    console.error('Error generating historical trends:', error);
    return NextResponse.json(
      { error: 'Failed to generate historical trends data' },
      { status: 500 }
    );
  }
}

function generateWeeklyTimeSeries(transactions: Array<{amount: number; ai_merchant_name?: string; merchant_name?: string; name?: string; ai_category_tag?: string; date: string}>, startDate: string, endDate: string): TimeSeriesData[] {
  const weeklyData: TimeSeriesData[] = [];
  
  // Create date range for all weeks from first transaction to last
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Get the Monday of the week containing the start date
  const startOfWeek = new Date(start);
  startOfWeek.setDate(start.getDate() - start.getDay() + 1); // Monday
  startOfWeek.setHours(0, 0, 0, 0);
  
  // Generate all weeks
  const currentWeek = new Date(startOfWeek);
  while (currentWeek <= end) {
    const weekEnd = new Date(currentWeek);
    weekEnd.setDate(currentWeek.getDate() + 6); // Sunday
    
    const weekTransactions = transactions.filter(tx => {
      const txDate = new Date(tx.date);
      return txDate >= currentWeek && txDate <= weekEnd;
    });
    
    // Group by merchants and categories for this week
    const merchants = new Map<string, { amount: number; count: number }>();
    const categories = new Map<string, { amount: number; count: number }>();
    
    weekTransactions.forEach(tx => {
      // Merchant data
      const merchant = tx.ai_merchant_name || tx.merchant_name || tx.name || 'Unknown';
      const merchantData = merchants.get(merchant) || { amount: 0, count: 0 };
      merchants.set(merchant, {
        amount: merchantData.amount + tx.amount,
        count: merchantData.count + 1
      });
      
      // Category data
      const category = tx.ai_category_tag || 'Uncategorized';
      const categoryData = categories.get(category) || { amount: 0, count: 0 };
      categories.set(category, {
        amount: categoryData.amount + tx.amount,
        count: categoryData.count + 1
      });
    });
    
    // Convert to arrays and sort by amount
    const merchantArray = Array.from(merchants.entries())
      .map(([name, data]) => ({ name, amount: data.amount, count: data.count }))
      .sort((a, b) => b.amount - a.amount);
    
    const categoryArray = Array.from(categories.entries())
      .map(([name, data]) => ({ name, amount: data.amount, count: data.count }))
      .sort((a, b) => b.amount - a.amount);
    
    const totalAmount = weekTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    
    weeklyData.push({
      period: formatWeekPeriod(currentWeek),
      amount: totalAmount,
      transactionCount: weekTransactions.length,
      merchants: merchantArray,
      categories: categoryArray
    });
    
    // Move to next week
    currentWeek.setDate(currentWeek.getDate() + 7);
  }
  
  return weeklyData;
}

function generateMonthlyTimeSeries(transactions: Array<{amount: number; ai_merchant_name?: string; merchant_name?: string; name?: string; ai_category_tag?: string; date: string}>, startDate: string, endDate: string): TimeSeriesData[] {
  const monthlyData: TimeSeriesData[] = [];
  
  // Create date range for all months from first transaction to last
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Get the first day of the month containing the start date
  const startOfMonth = new Date(start.getFullYear(), start.getMonth(), 1);
  
  // Generate all months
  const currentMonth = new Date(startOfMonth);
  while (currentMonth <= end) {
    const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0); // Last day of month
    
    const monthTransactions = transactions.filter(tx => {
      const txDate = new Date(tx.date);
      return txDate >= currentMonth && txDate <= monthEnd;
    });
    
    // Group by merchants and categories for this month
    const merchants = new Map<string, { amount: number; count: number }>();
    const categories = new Map<string, { amount: number; count: number }>();
    
    monthTransactions.forEach(tx => {
      // Merchant data
      const merchant = tx.ai_merchant_name || tx.merchant_name || tx.name || 'Unknown';
      const merchantData = merchants.get(merchant) || { amount: 0, count: 0 };
      merchants.set(merchant, {
        amount: merchantData.amount + tx.amount,
        count: merchantData.count + 1
      });
      
      // Category data
      const category = tx.ai_category_tag || 'Uncategorized';
      const categoryData = categories.get(category) || { amount: 0, count: 0 };
      categories.set(category, {
        amount: categoryData.amount + tx.amount,
        count: categoryData.count + 1
      });
    });
    
    // Convert to arrays and sort by amount
    const merchantArray = Array.from(merchants.entries())
      .map(([name, data]) => ({ name, amount: data.amount, count: data.count }))
      .sort((a, b) => b.amount - a.amount);
    
    const categoryArray = Array.from(categories.entries())
      .map(([name, data]) => ({ name, amount: data.amount, count: data.count }))
      .sort((a, b) => b.amount - a.amount);
    
    const totalAmount = monthTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    
    monthlyData.push({
      period: formatMonthPeriod(currentMonth),
      amount: totalAmount,
      transactionCount: monthTransactions.length,
      merchants: merchantArray,
      categories: categoryArray
    });
    
    // Move to next month
    currentMonth.setMonth(currentMonth.getMonth() + 1);
  }
  
  return monthlyData;
}

function formatWeekPeriod(date: Date): string {
  const year = date.getFullYear();
  const weekNumber = getWeekNumber(date);
  return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
}

function formatMonthPeriod(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${year}-${month}`;
}

function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}
