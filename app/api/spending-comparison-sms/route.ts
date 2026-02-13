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

    // Get user's active items
    const { data: activeItems, error: itemsError } = await supabase
      .from('items')
      .select('id, plaid_item_id')
      .eq('user_id', userId)
      .eq('status', 'good');

    if (itemsError || !activeItems || activeItems.length === 0) {
      return NextResponse.json({
        error: 'No active accounts found',
        debug: { userId, activeItems: activeItems?.length || 0 }
      }, { status: 404 });
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

    if (txError || !transactions) {
      return NextResponse.json({ error: txError?.message || 'No transactions found' }, { status: 500 });
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

    // Calculate date ranges
    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const baselineStart = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
    const baselineEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Filter transactions
    const currentMonthTx = processedTransactions.filter(tx => {
      const txDate = new Date(tx.date);
      return tx.adf_eligible && txDate >= currentMonth && txDate <= currentMonthEnd;
    });

    const baselineTx = processedTransactions.filter(tx => {
      const txDate = new Date(tx.date);
      return tx.adf_eligible && txDate >= baselineStart && txDate <= baselineEnd;
    });

    // Group by merchant
    const currentMerchantSpending: { [key: string]: { amount: number; transactions: number } } = {};
    const baselineMerchantSpending: { [key: string]: { amount: number; transactions: number } } = {};

    currentMonthTx.forEach(tx => {
      const merchant = tx.ai_merchant_name;
      if (!currentMerchantSpending[merchant]) {
        currentMerchantSpending[merchant] = { amount: 0, transactions: 0 };
      }
      currentMerchantSpending[merchant].amount += parseFloat(tx.amount as string);
      currentMerchantSpending[merchant].transactions += 1;
    });

    baselineTx.forEach(tx => {
      const merchant = tx.ai_merchant_name;
      if (!baselineMerchantSpending[merchant]) {
        baselineMerchantSpending[merchant] = { amount: 0, transactions: 0 };
      }
      baselineMerchantSpending[merchant].amount += parseFloat(tx.amount as string);
      baselineMerchantSpending[merchant].transactions += 1;
    });

    // Group by category
    const currentCategorySpending: { [key: string]: { amount: number; transactions: number } } = {};
    const baselineCategorySpending: { [key: string]: { amount: number; transactions: number } } = {};

    currentMonthTx.forEach(tx => {
      const category = tx.ai_category_tag;
      if (!currentCategorySpending[category]) {
        currentCategorySpending[category] = { amount: 0, transactions: 0 };
      }
      currentCategorySpending[category].amount += parseFloat(tx.amount as string);
      currentCategorySpending[category].transactions += 1;
    });

    baselineTx.forEach(tx => {
      const category = tx.ai_category_tag;
      if (!baselineCategorySpending[category]) {
        baselineCategorySpending[category] = { amount: 0, transactions: 0 };
      }
      baselineCategorySpending[category].amount += parseFloat(tx.amount as string);
      baselineCategorySpending[category].transactions += 1;
    });

    // Calculate comparisons
    const merchantComparisons = Object.keys(currentMerchantSpending).map(merchant => {
      const current = currentMerchantSpending[merchant];
      const baseline = baselineMerchantSpending[merchant] || { amount: 0, transactions: 0 };
      const baselineAverage = baseline.amount / monthsBack;
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

    const categoryComparisons = Object.keys(currentCategorySpending).map(category => {
      const current = currentCategorySpending[category];
      const baseline = baselineCategorySpending[category] || { amount: 0, transactions: 0 };
      const baselineAverage = baseline.amount / monthsBack;
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

    // Sort by current spending
    merchantComparisons.sort((a, b) => b.currentAmount - a.currentAmount);
    categoryComparisons.sort((a, b) => b.currentAmount - a.currentAmount);

    // Calculate totals
    const totalCurrent = merchantComparisons.reduce((sum, m) => sum + m.currentAmount, 0);
    const totalBaseline = merchantComparisons.reduce((sum, m) => sum + m.baselineAverage, 0);
    const totalChange = totalCurrent - totalBaseline;
    const totalChangePercent = totalBaseline > 0 ? (totalChange / totalBaseline) * 100 : (totalCurrent > 0 ? 100 : 0);

    // Generate unified SMS template
    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(amount);
    };

    const formatPercent = (percent: number) => {
      const sign = percent > 0 ? '+' : '';
      return `${sign}${percent.toFixed(0)}%`;
    };

    // Get top changes
    const topIncreases = merchantComparisons
      .filter(m => m.changePercent > 10)
      .sort((a, b) => b.changePercent - a.changePercent)
      .slice(0, 5);

    const topDecreases = merchantComparisons
      .filter(m => m.changePercent < -10)
      .sort((a, b) => a.changePercent - b.changePercent)
      .slice(0, 3);

    const topCategories = categoryComparisons.slice(0, 4);

    // Create comprehensive SMS message
    const monthName = now.toLocaleDateString('en-US', { month: 'short' });
    let smsMessage = `💰 ${monthName} Spending Report\n`;
    smsMessage += `Total: ${formatCurrency(totalCurrent)} (${formatPercent(totalChangePercent)} vs ${monthsBack}mo avg)\n`;
    smsMessage += `Period: ${currentMonth.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}-${currentMonthEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}\n\n`;

    if (topIncreases.length > 0) {
      smsMessage += `🔥 TOP SPENDING INCREASES:\n`;
      topIncreases.slice(0, 4).forEach(increase => {
        smsMessage += `• ${increase.merchant}: ${formatCurrency(increase.currentAmount)} (${formatPercent(increase.changePercent)}, ${increase.transactions}tx)\n`;
      });
      if (topIncreases.length > 4) {
        smsMessage += `• +${topIncreases.length - 4} more increases\n`;
      }
      smsMessage += `\n`;
    }

    if (topDecreases.length > 0) {
      smsMessage += `✅ SPENDING REDUCTIONS:\n`;
      topDecreases.forEach(decrease => {
        smsMessage += `• ${decrease.merchant}: ${formatCurrency(decrease.currentAmount)} (${formatPercent(decrease.changePercent)})\n`;
      });
      smsMessage += `\n`;
    }

    smsMessage += `📂 CATEGORY BREAKDOWN:\n`;
    topCategories.forEach(cat => {
      smsMessage += `• ${cat.category}: ${formatCurrency(cat.currentAmount)} (${formatPercent(cat.changePercent)}, ${cat.transactions}tx)\n`;
    });

    // Calculate spending velocity
    const avgTransactionSize = totalCurrent / currentMonthTx.length;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const spendingVelocity = totalChangePercent > 50 ? "High spending velocity" :
                            totalChangePercent < -30 ? "Great spending control" :
                            "Moderate spending pace";

    // Add detailed insights
    const insights = [];
    if (totalChangePercent > 30) {
      insights.push("⚠️ Significantly above baseline - review expenses");
    } else if (totalChangePercent > 15) {
      insights.push("📈 Above average spending this month");
    } else if (totalChangePercent < -15) {
      insights.push("💪 Excellent spending discipline!");
    } else if (totalChangePercent < 0) {
      insights.push("👍 Good spending control");
    }

    if (topIncreases.length > topDecreases.length + 2) {
      insights.push("🎯 Focus on reducing high-growth areas");
    }

    if (avgTransactionSize > 100) {
      insights.push(`💵 Large avg transaction: ${formatCurrency(avgTransactionSize)}`);
    }

    // Add top merchants by absolute spending
    const topAbsoluteMerchants = merchantComparisons.slice(0, 3);
    smsMessage += `\n🏆 TOP MERCHANTS BY SPENDING:\n`;
    topAbsoluteMerchants.forEach(merchant => {
      smsMessage += `• ${merchant.merchant}: ${formatCurrency(merchant.currentAmount)} (${merchant.transactions}tx)\n`;
    });

    if (insights.length > 0) {
      smsMessage += `\n💡 INSIGHTS:\n`;
      insights.forEach(insight => {
        smsMessage += `• ${insight}\n`;
      });
    }

    // Add spending prediction for next month
    const predictedNextMonth = totalCurrent * (1 + (totalChangePercent / 100) * 0.5);
    smsMessage += `\n🔮 NEXT MONTH PREDICTION:\n`;
    smsMessage += `Based on current trends: ${formatCurrency(predictedNextMonth)}\n`;
    smsMessage += `(${totalChangePercent > 0 ? '📈 Trending up' : totalChangePercent < -10 ? '📉 Trending down' : '➡️ Stable'})`;

    return NextResponse.json({
      smsMessage,
      data: {
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
        topIncreases,
        topDecreases,
        topCategories,
        insights
      }
    });

  } catch (error) {
    console.error('Spending comparison SMS error:', error);
    return NextResponse.json({ error: 'Failed to generate SMS' }, { status: 500 });
  }
}
