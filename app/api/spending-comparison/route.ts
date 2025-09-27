import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const monthsBack = parseInt(searchParams.get('monthsBack') || '2');

  if (!userId) {
    return NextResponse.json({ error: 'userId parameter required' }, { status: 400 });
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get transactions for the user from active accounts only
    // First get the active item IDs for this user
    const { data: activeItems, error: itemsError } = await supabase
      .from('items')
      .select('id, plaid_item_id')
      .eq('user_id', userId)
      .eq('status', 'good');

    if (itemsError) {
      console.error('Error fetching items:', itemsError);
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    if (!activeItems || activeItems.length === 0) {
      return NextResponse.json({
        message: 'No active accounts found for this user.',
        debug: { userId, activeItems: [] }
      }, { status: 200 });
    }

    // Get transactions for active items
    const activeItemIds = activeItems.map(item => item.plaid_item_id);
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select(`
        id,
        name,
        merchant_name,
        ai_merchant_name,
        ai_category_tag,
        amount,
        date,
        plaid_item_id
      `)
      .in('plaid_item_id', activeItemIds)
      .order('date', { ascending: false });

    if (txError) {
      console.error('Error fetching transactions:', txError);
      return NextResponse.json({ error: txError.message }, { status: 500 });
    }

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({ message: 'No transactions found for this user with active accounts.' }, { status: 200 });
    }

    // Process transactions for ADF classification (only discretionary spending)
    const processedTransactions = transactions.map(tx => {
      const merchantName = (tx.ai_merchant_name || tx.merchant_name || tx.name || '').toLowerCase();
      const categoryTag = (tx.ai_category_tag || '').toLowerCase();
      const searchText = `${merchantName} ${categoryTag}`;

      const fixedKeywords = [
        'rent', 'mortgage', 'duke energy', 'verizon', 'at&t', 'comcast', 'spectrum',
        'utilities', 'insurance', 'car payment', 'loan', 'toyota', 'honda', 'ford',
        'blue cross', 'health insurance', 'life insurance', 'auto insurance',
        'internet', 'cable', 'phone bill', 'wireless', 'transfer', 'payment', 'deposit',
        'withdrawal', 'investment', 'savings', 'retirement', 'venmo', 'zelle', 'paypal',
        'cash app', 'apple cash', 'check paid', 'jpm chase', 'chase credit card epay',
        'fccu a2a acct', 'mercantile solut', 'generations c.c.', 'tuition', 'school fees',
        'childcare', 'daycare', 'gym membership', 'medical bill', 'tax payment', 'irs',
        'state tax', 'property tax', 'social security', 'lakeview loan servicing'
      ];

      const discretionaryKeywords = [
        'groceries', 'restaurant', 'shopping', 'gas', 'entertainment', 'travel', 'coffee',
        'dining', 'bar', 'cafe', 'fast food', 'supermarket', 'convenience store', 'department store',
        'online retail', 'clothing', 'electronics', 'hobbies', 'movies', 'concerts', 'sports',
        'vacation', 'hotel', 'airline', 'ride share', 'taxi', 'bus', 'train', 'car rental',
        'publix', 'walmart', 'target', 'amazon', 'starbucks', 'chick-fil-a', 'circle k', 'racetrac',
        'netflix', 'spotify', 'hulu', 'disney+', 'youtube premium', 'apple music', 'openai', 'cursor',
        'etsy', 'ace hardware', 'dollar tree', 'pinch a penny', 'everydaydose', 'steves produce',
        'last chance thrift store', 'trinity commons cof', 'snappers grill & comed', 'country pizza itali',
        'the local brewing', 'amc theatres', 'uncorked wine bar', 'wendy\'s', 'shogun japanese inc',
        'cantina viajero', 'wild ginger', 'diesel garage grill', 'the cotton exchange', 'fleet landing llc',
        'vpizzaju', 'casa ludovico', 'metamorphosis ink', 'trader joe\'s', 'exxonmobil', 'indigo inn'
      ];

      let expenseType: 'fixed_expense' | 'discretionary' = 'discretionary';
      let adfEligible: boolean = true;

      if (fixedKeywords.some(keyword => searchText.includes(keyword))) {
        expenseType = 'fixed_expense';
        adfEligible = false;
      } else if (discretionaryKeywords.some(keyword => searchText.includes(keyword))) {
        expenseType = 'discretionary';
        adfEligible = true;
      }

      return {
        ...tx,
        expense_type: expenseType,
        adf_eligible: adfEligible,
        ai_merchant_name: tx.ai_merchant_name || tx.merchant_name || tx.name,
        ai_category_tag: tx.ai_category_tag || 'Unknown'
      };
    });

    // Get current month and previous months
    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Calculate baseline period (previous monthsBack months)
    const baselineStart = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
    const baselineEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Filter transactions for current month (only discretionary/Flow spending)
    const currentMonthTx = processedTransactions.filter(tx => {
      const txDate = new Date(tx.date);
      return tx.adf_eligible && txDate >= currentMonth && txDate <= currentMonthEnd;
    });

    // Filter transactions for baseline period
    const baselineTx = processedTransactions.filter(tx => {
      const txDate = new Date(tx.date);
      return tx.adf_eligible && txDate >= baselineStart && txDate <= baselineEnd;
    });

    // Group current month spending by merchant
    const currentMerchantSpending: { [key: string]: { amount: number; transactions: number } } = {};
    currentMonthTx.forEach(tx => {
      const merchant = tx.ai_merchant_name;
      if (!currentMerchantSpending[merchant]) {
        currentMerchantSpending[merchant] = { amount: 0, transactions: 0 };
      }
      currentMerchantSpending[merchant].amount += parseFloat(tx.amount as string);
      currentMerchantSpending[merchant].transactions += 1;
    });

    // Group baseline spending by merchant
    const baselineMerchantSpending: { [key: string]: { amount: number; transactions: number } } = {};
    baselineTx.forEach(tx => {
      const merchant = tx.ai_merchant_name;
      if (!baselineMerchantSpending[merchant]) {
        baselineMerchantSpending[merchant] = { amount: 0, transactions: 0 };
      }
      baselineMerchantSpending[merchant].amount += parseFloat(tx.amount as string);
      baselineMerchantSpending[merchant].transactions += 1;
    });

    // Group current month spending by category
    const currentCategorySpending: { [key: string]: { amount: number; transactions: number } } = {};
    currentMonthTx.forEach(tx => {
      const category = tx.ai_category_tag;
      if (!currentCategorySpending[category]) {
        currentCategorySpending[category] = { amount: 0, transactions: 0 };
      }
      currentCategorySpending[category].amount += parseFloat(tx.amount as string);
      currentCategorySpending[category].transactions += 1;
    });

    // Group baseline spending by category
    const baselineCategorySpending: { [key: string]: { amount: number; transactions: number } } = {};
    baselineTx.forEach(tx => {
      const category = tx.ai_category_tag;
      if (!baselineCategorySpending[category]) {
        baselineCategorySpending[category] = { amount: 0, transactions: 0 };
      }
      baselineCategorySpending[category].amount += parseFloat(tx.amount as string);
      baselineCategorySpending[category].transactions += 1;
    });

    // Calculate merchant comparisons
    const merchantComparisons = Object.keys(currentMerchantSpending).map(merchant => {
      const current = currentMerchantSpending[merchant];
      const baseline = baselineMerchantSpending[merchant] || { amount: 0, transactions: 0 };
      const baselineAverage = baseline.amount / monthsBack; // Average per month
      const change = current.amount - baselineAverage;
      const changePercent = baselineAverage > 0 ? (change / baselineAverage) * 100 : (current.amount > 0 ? 100 : 0);

      return {
        merchant,
        currentAmount: current.amount,
        baselineAverage: baselineAverage,
        change,
        changePercent,
        transactions: current.transactions
      };
    });

    // Calculate category comparisons
    const categoryComparisons = Object.keys(currentCategorySpending).map(category => {
      const current = currentCategorySpending[category];
      const baseline = baselineCategorySpending[category] || { amount: 0, transactions: 0 };
      const baselineAverage = baseline.amount / monthsBack; // Average per month
      const change = current.amount - baselineAverage;
      const changePercent = baselineAverage > 0 ? (change / baselineAverage) * 100 : (current.amount > 0 ? 100 : 0);

      return {
        category,
        currentAmount: current.amount,
        baselineAverage: baselineAverage,
        change,
        changePercent,
        transactions: current.transactions
      };
    });

    // Sort by current spending (most to least)
    merchantComparisons.sort((a, b) => b.currentAmount - a.currentAmount);
    categoryComparisons.sort((a, b) => b.currentAmount - a.currentAmount);

    // Calculate totals
    const totalCurrent = merchantComparisons.reduce((sum, m) => sum + m.currentAmount, 0);
    const totalBaseline = merchantComparisons.reduce((sum, m) => sum + m.baselineAverage, 0);
    const totalChange = totalCurrent - totalBaseline;
    const totalChangePercent = totalBaseline > 0 ? (totalChange / totalBaseline) * 100 : (totalCurrent > 0 ? 100 : 0);

    const result = {
      summary: {
        currentPeriod: {
          start: currentMonth.toISOString().split('T')[0],
          end: currentMonthEnd.toISOString().split('T')[0]
        },
        baselinePeriod: {
          start: baselineStart.toISOString().split('T')[0],
          end: baselineEnd.toISOString().split('T')[0],
          months: monthsBack
        },
        totals: {
          currentAmount: totalCurrent,
          baselineAverage: totalBaseline,
          change: totalChange,
          changePercent: totalChangePercent
        }
      },
      merchants: merchantComparisons.slice(0, 10), // Top 10 merchants
      categories: categoryComparisons.slice(0, 8), // Top 8 categories
      topSpenders: {
        merchants: merchantComparisons.slice(0, 5),
        categories: categoryComparisons.slice(0, 3)
      }
    };

    return NextResponse.json(result);

  } catch (error) {
    console.error('Spending Comparison API Error:', error);
    return NextResponse.json({ error: 'Failed to analyze spending comparison' }, { status: 500 });
  }
}
