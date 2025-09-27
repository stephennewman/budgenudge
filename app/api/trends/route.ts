import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/server';

interface MerchantTimeSeries {
  name: string;
  weeklyData: Array<{period: string; amount: number; count: number}>;
  monthlyData: Array<{period: string; amount: number; count: number}>;
  totalAmount: number;
  totalTransactions: number;
}

interface CategoryTimeSeries {
  name: string;
  weeklyData: Array<{period: string; amount: number; count: number}>;
  monthlyData: Array<{period: string; amount: number; count: number}>;
  totalAmount: number;
  totalTransactions: number;
}

interface HistoricalTrendsData {
  merchants: MerchantTimeSeries[];
  categories: CategoryTimeSeries[];
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
    // Include both tagged and untagged transactions to ensure latest data is included
    const { data: allTransactions, error: transactionsError } = await supabase
      .from('transactions')
      .select('id, amount, ai_merchant_name, ai_category_tag, merchant_name, name, date')
      .in('plaid_item_id', itemIds)
      .gt('amount', 0) // Only expenses (positive amounts in Plaid)
      .order('date', { ascending: true }) // Chronological order
      .limit(10000); // Explicitly set a high limit to ensure we get all data

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
    
    // Log recent transactions to verify latest data is included
    const recentTransactions = allTransactions.slice(-5);
    console.log(`📅 Most recent transactions:`, recentTransactions.map(t => ({
      date: t.date,
      merchant: t.ai_merchant_name || t.merchant_name || t.name,
      amount: t.amount
    })));

    // Get date range
    const firstTransactionDate = allTransactions[0].date;
    const lastTransactionDate = allTransactions[allTransactions.length - 1].date;

    console.log(`📅 Date range: ${firstTransactionDate} to ${lastTransactionDate}`);

    // Generate weekly and monthly time series data
    // Generate individual merchant and category time series
    const merchants = generateMerchantTimeSeries(allTransactions, firstTransactionDate);
    const categories = generateCategoryTimeSeries(allTransactions, firstTransactionDate);

    const trendsData: HistoricalTrendsData = {
      merchants,
      categories,
      firstTransactionDate,
      lastTransactionDate
    };

    console.log(`✅ Generated historical trends: ${merchants.length} merchants, ${categories.length} categories`);

    return NextResponse.json(trendsData);

  } catch (error) {
    console.error('Error generating historical trends:', error);
    return NextResponse.json(
      { error: 'Failed to generate historical trends data' },
      { status: 500 }
    );
  }
}

function generateMerchantTimeSeries(transactions: Array<{amount: number; ai_merchant_name?: string; merchant_name?: string; name?: string; ai_category_tag?: string; date: string}>, firstDate: string): MerchantTimeSeries[] {
  // Group transactions by merchant
  const merchantMap = new Map<string, Array<{amount: number; ai_merchant_name?: string; merchant_name?: string; name?: string; ai_category_tag?: string; date: string}>>();
  
  transactions.forEach(transaction => {
    // Use AI-tagged merchant name if available, otherwise fall back to original merchant name
    const merchant = transaction.ai_merchant_name || transaction.merchant_name || transaction.name || 'Unknown';
    if (!merchantMap.has(merchant)) {
      merchantMap.set(merchant, []);
    }
    merchantMap.get(merchant)!.push(transaction);
  });
  
  // Filter out low-volume merchants (less than $50 total or 3 transactions)
  const filteredMerchants = Array.from(merchantMap.entries()).filter(([, txs]) => {
    const totalAmount = txs.reduce((sum, t) => sum + t.amount, 0);
    return totalAmount >= 50 && txs.length >= 3;
  });
  
  // Generate time series for each merchant
  return filteredMerchants.map(([merchantName, merchantTransactions]) => {
    const weeklyData = generateMerchantWeeklyData(merchantTransactions, firstDate);
    const monthlyData = generateMerchantMonthlyData(merchantTransactions, firstDate);
    const totalAmount = merchantTransactions.reduce((sum, t) => sum + t.amount, 0);
    
    return {
      name: merchantName,
      weeklyData,
      monthlyData,
      totalAmount,
      totalTransactions: merchantTransactions.length
    };
  }).sort((a, b) => b.totalAmount - a.totalAmount); // Sort by total amount descending
}

function generateCategoryTimeSeries(transactions: Array<{amount: number; ai_merchant_name?: string; merchant_name?: string; name?: string; ai_category_tag?: string; date: string}>, firstDate: string): CategoryTimeSeries[] {
  // Group transactions by category
  const categoryMap = new Map<string, Array<{amount: number; ai_merchant_name?: string; merchant_name?: string; name?: string; ai_category_tag?: string; date: string}>>();
  
  transactions.forEach(transaction => {
    // Use AI-tagged category if available, otherwise fall back to original category or 'Uncategorized'
    const category = transaction.ai_category_tag || 'Uncategorized';
    if (!categoryMap.has(category)) {
      categoryMap.set(category, []);
    }
    categoryMap.get(category)!.push(transaction);
  });
  
  // Filter out low-volume categories (less than $100 total or 5 transactions)
  const filteredCategories = Array.from(categoryMap.entries()).filter(([, txs]) => {
    const totalAmount = txs.reduce((sum, t) => sum + t.amount, 0);
    return totalAmount >= 100 && txs.length >= 5;
  });
  
  // Generate time series for each category
  return filteredCategories.map(([categoryName, categoryTransactions]) => {
    const weeklyData = generateCategoryWeeklyData(categoryTransactions, firstDate);
    const monthlyData = generateCategoryMonthlyData(categoryTransactions, firstDate);
    const totalAmount = categoryTransactions.reduce((sum, t) => sum + t.amount, 0);
    
    return {
      name: categoryName,
      weeklyData,
      monthlyData,
      totalAmount,
      totalTransactions: categoryTransactions.length
    };
  }).sort((a, b) => b.totalAmount - a.totalAmount); // Sort by total amount descending
}

function generateMerchantWeeklyData(transactions: Array<{amount: number; date: string}>, firstDate: string): Array<{period: string; amount: number; count: number}> {
  const weeklyData: Array<{period: string; amount: number; count: number}> = [];
  
  const start = new Date(firstDate);
  
  // Only show data through current month (September 2025)
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  
  // Calculate end date as last day of current month
  const endOfCurrentMonth = new Date(currentYear, currentMonth + 1, 0); // Last day of current month
  
  // Get the Sunday of the week containing the start date
  const startOfWeek = new Date(start);
  startOfWeek.setDate(start.getDate() - start.getDay()); // Sunday
  startOfWeek.setHours(0, 0, 0, 0);
  
  console.log(`📅 Weekly data range: ${startOfWeek.toISOString().split('T')[0]} to ${endOfCurrentMonth.toISOString().split('T')[0]} (through current month)`);
  
  const currentWeek = new Date(startOfWeek);
  while (currentWeek <= endOfCurrentMonth) {
    const weekEnd = new Date(currentWeek);
    weekEnd.setDate(currentWeek.getDate() + 6); // Saturday
    weekEnd.setHours(23, 59, 59, 999);
    
    const weekTransactions = transactions.filter(tx => {
      const txDate = new Date(tx.date);
      return txDate >= currentWeek && txDate <= weekEnd;
    });
    
    const amount = weekTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    
    weeklyData.push({
      period: formatWeekPeriod(currentWeek),
      amount,
      count: weekTransactions.length
    });
    
    // Log each week being processed for debugging
    if (weekTransactions.length > 0) {
      console.log(`📊 Week ${formatWeekPeriod(currentWeek)}: $${amount.toFixed(2)} (${weekTransactions.length} transactions)`);
    }
    
    currentWeek.setDate(currentWeek.getDate() + 7);
  }
  
  // Sort by period to ensure chronological order
  weeklyData.sort((a, b) => a.period.localeCompare(b.period));
  
  console.log(`📈 Generated ${weeklyData.length} weekly periods`);
  return weeklyData;
}

function generateMerchantMonthlyData(transactions: Array<{amount: number; date: string}>, firstDate: string): Array<{period: string; amount: number; count: number}> {
  const monthlyData: Array<{period: string; amount: number; count: number}> = [];
  
  const start = new Date(firstDate);
  
  // Only show data through current month (September 2025)
  const currentDate = new Date();
  const currentMonthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0); // Last day of current month
  
  const startOfMonth = new Date(start.getFullYear(), start.getMonth(), 1);
  const currentMonth = new Date(startOfMonth);
  
  console.log(`📅 Monthly data range: ${startOfMonth.toISOString().split('T')[0]} to ${currentMonthEnd.toISOString().split('T')[0]} (through current month)`);
  
  while (currentMonth <= currentMonthEnd) {
    const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    
    const monthTransactions = transactions.filter(tx => {
      const txDate = new Date(tx.date);
      return txDate >= currentMonth && txDate <= monthEnd;
    });
    
    const amount = monthTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    
    monthlyData.push({
      period: formatMonthPeriod(currentMonth),
      amount,
      count: monthTransactions.length
    });
    
    currentMonth.setMonth(currentMonth.getMonth() + 1);
  }
  
  // Sort by period to ensure chronological order
  monthlyData.sort((a, b) => a.period.localeCompare(b.period));
  
  return monthlyData;
}

function generateCategoryWeeklyData(transactions: Array<{amount: number; date: string}>, firstDate: string): Array<{period: string; amount: number; count: number}> {
  return generateMerchantWeeklyData(transactions, firstDate);
}

function generateCategoryMonthlyData(transactions: Array<{amount: number; date: string}>, firstDate: string): Array<{period: string; amount: number; count: number}> {
  return generateMerchantMonthlyData(transactions, firstDate);
}

function formatWeekPeriod(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatMonthPeriod(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${year}-${month}`;
}

