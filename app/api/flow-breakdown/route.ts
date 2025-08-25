import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/server';

// ADF Classification Logic (simplified for direct use in API)
function classifyForADF(tx: { ai_merchant_name?: string; merchant_name?: string; name?: string; ai_category_tag?: string; amount: number; category?: string[] }) {
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

  if (categoryTag.includes('subscription')) {
    if (tx.amount > 50 && !fixedKeywords.some(keyword => searchText.includes(keyword))) {
      expenseType = 'fixed_expense';
      adfEligible = false;
    } else {
      expenseType = 'discretionary';
      adfEligible = true;
    }
  }

  return { expense_type: expenseType, adf_eligible: adfEligible };
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'userId parameter required' }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseClient();

    // Fetch transactions for the user from active accounts only
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
        items!inner(user_id, status)
      `)
      .eq('items.user_id', userId)
      .eq('items.status', 'good')
      .order('date', { ascending: false });

    if (txError) {
      console.error('Error fetching transactions:', txError);
      return NextResponse.json({ error: txError.message }, { status: 500 });
    }

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({ message: 'No transactions found for this user with active accounts.' }, { status: 200 });
    }

    // Process transactions for ADF classification
    const processedTransactions = transactions.map(tx => {
      const { expense_type, adf_eligible } = classifyForADF(tx);
      return { 
        ...tx, 
        expense_type, 
        adf_eligible,
        ai_merchant_name: tx.ai_merchant_name || tx.merchant_name || tx.name,
        ai_category_tag: tx.ai_category_tag || 'Unknown'
      };
    });

    // Get current 30-day window (most recent)
    const sortedTx = processedTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const currentWindowEnd = new Date(sortedTx[0].date);
    const currentWindowStart = addDays(currentWindowEnd, -30);

    // Filter to current 30-day window
    const currentWindowTx = processedTransactions.filter(tx => {
      const txDate = new Date(tx.date);
      return txDate >= currentWindowStart && txDate <= currentWindowEnd;
    });

    // Separate Flow transactions from others
    const flowTransactions = currentWindowTx.filter(tx => tx.adf_eligible);
    const fixedTransactions = currentWindowTx.filter(tx => tx.expense_type === 'fixed_expense');
    const transferTransactions = currentWindowTx.filter(tx => !tx.adf_eligible && tx.expense_type === 'discretionary');

    // Calculate totals
    const totalFlow = flowTransactions.reduce((sum, tx) => sum + parseFloat(tx.amount as string), 0);
    const totalFixed = fixedTransactions.reduce((sum, tx) => sum + parseFloat(tx.amount as string), 0);
    const totalTransfers = transferTransactions.reduce((sum, tx) => sum + parseFloat(tx.amount as string), 0);
    const dailyFlow = totalFlow / 30;

    // Group by merchant
    const merchantBreakdown: { [key: string]: { amount: number; transactions: typeof flowTransactions } } = {};
    flowTransactions.forEach(tx => {
      const merchant = tx.ai_merchant_name;
      if (!merchantBreakdown[merchant]) {
        merchantBreakdown[merchant] = { amount: 0, transactions: [] };
      }
      merchantBreakdown[merchant].amount += parseFloat(tx.amount as string);
      merchantBreakdown[merchant].transactions.push(tx);
    });

    // Group by category
    const categoryBreakdown: { [key: string]: { amount: number; transactions: typeof flowTransactions } } = {};
    flowTransactions.forEach(tx => {
      const category = tx.ai_category_tag;
      if (!categoryBreakdown[category]) {
        categoryBreakdown[category] = { amount: 0, transactions: [] };
      }
      categoryBreakdown[category].amount += parseFloat(tx.amount as string);
      categoryBreakdown[category].transactions.push(tx);
    });

    // Sort and format merchant breakdown
    const topMerchants = Object.entries(merchantBreakdown)
      .sort(([, a], [, b]) => b.amount - a.amount)
      .map(([merchant, data]) => ({
        merchant,
        amount: data.amount,
        dailyAmount: data.amount / 30,
        transactionCount: data.transactions.length,
        transactions: data.transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      }));

    // Sort and format category breakdown
    const topCategories = Object.entries(categoryBreakdown)
      .sort(([, a], [, b]) => b.amount - a.amount)
      .map(([category, data]) => ({
        category,
        amount: data.amount,
        dailyAmount: data.amount / 30,
        transactionCount: data.transactions.length,
        transactions: data.transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      }));

    return NextResponse.json({
      userId,
      windowStart: currentWindowStart.toISOString().split('T')[0],
      windowEnd: currentWindowEnd.toISOString().split('T')[0],
      calculation: {
        totalFlow,
        dailyFlow,
        totalFixed,
        totalTransfers,
        totalSpending: totalFlow + totalFixed + totalTransfers,
        flowPercentage: (totalFlow / (totalFlow + totalFixed + totalTransfers)) * 100
      },
      breakdown: {
        merchants: topMerchants,
        categories: topCategories
      },
      summary: {
        totalFlowTransactions: flowTransactions.length,
        totalFixedTransactions: fixedTransactions.length,
        totalTransferTransactions: transferTransactions.length,
        averageFlowTransaction: flowTransactions.length > 0 ? totalFlow / flowTransactions.length : 0
      }
    });

  } catch (error) {
    console.error('Flow Breakdown API Error:', error);
    return NextResponse.json({ error: 'Failed to analyze flow breakdown' }, { status: 500 });
  }
}
