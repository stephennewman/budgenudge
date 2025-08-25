import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/server';

// ADF Classification Logic
function classifyForADF(tx: { ai_merchant_name?: string; merchant_name?: string; name?: string; ai_category_tag?: string }) {
  const merchantName = (tx.ai_merchant_name || tx.merchant_name || tx.name || '').toLowerCase();
  const categoryTag = (tx.ai_category_tag || '').toLowerCase();
  
  // Fixed Expenses (excluded from ADF)
  const fixedKeywords = [
    'utilities', 'mortgage', 'lakeview loan', 'spectrum', 'p c utilities',
    'duke energy', 't-mobile', 'verizon', 'insurance', 'payment', 'autopay',
    'chase credit', 'fccu', 'mercantile solut'
  ];
  
  // Transfers/Other (excluded from ADF)  
  const transferKeywords = ['transfer', 'venmo', 'zelle', 'apple cash'];
  
  // Tithe/Charity (excluded from ADF)
  const charityKeywords = ['generations', 'compassion', 'tithe', 'charities'];
  
  if (fixedKeywords.some(k => merchantName.includes(k) || categoryTag.includes(k))) {
    return { type: 'FIXED_EXPENSE', adf_eligible: false };
  }
  
  if (transferKeywords.some(k => categoryTag.includes(k))) {
    return { type: 'TRANSFER', adf_eligible: false };
  }
  
  if (charityKeywords.some(k => merchantName.includes(k) || categoryTag.includes(k))) {
    return { type: 'CHARITY', adf_eligible: false };
  }
  
  // Everything else is discretionary (ADF eligible)
  return { type: 'DISCRETIONARY', adf_eligible: true };
}

// Date helper functions
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const supabase = await createSupabaseClient();
    
    // Get all transactions from ACTIVE accounts only
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select(`
        name,
        merchant_name, 
        ai_merchant_name,
        ai_category_tag,
        amount,
        date,
        items!inner(user_id, status)
      `)
      .eq('items.user_id', userId)
      .eq('items.status', 'good')  // Only active accounts
      .gt('amount', 0)
      .order('date', { ascending: true });

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({ error: 'No transactions found' }, { status: 404 });
    }

    // Convert and classify transactions
    const txData = transactions.map(tx => ({
      ...tx,
      date: new Date(tx.date),
      amount: parseFloat(tx.amount),
      classification: classifyForADF(tx)
    }));

    // Calculate date ranges
    const firstDate = txData[0].date;
    const lastDate = txData[txData.length - 1].date;
    const totalDays = Math.floor((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));

    // Generate rolling 30-day ADF timeline
    const rollingTimeline = [];
    const merchantTimelines: { [key: string]: { date: string; dailyADF: number; totalADF: number }[] } = {};
    const categoryTimelines: { [key: string]: { date: string; dailyADF: number; totalADF: number }[] } = {};

    // Sample every 7 days for a clean timeline
    for (let dayOffset = 30; dayOffset <= totalDays; dayOffset += 7) {
      const windowEndDate = addDays(firstDate, dayOffset);
      const windowStartDate = addDays(windowEndDate, -30);
      
      // Get transactions in this 30-day window
      const windowTx = txData.filter(tx => 
        tx.date >= windowStartDate && tx.date < windowEndDate
      );
      
      // Calculate ADF for this window
      let totalADF = 0;
      let totalFixed = 0;
      let totalTransfers = 0;
      const merchantADF: { [key: string]: number } = {};
      const categoryADF: { [key: string]: number } = {};
      
      windowTx.forEach(tx => {
        const amount = tx.amount;
        
        if (tx.classification.adf_eligible) {
          totalADF += amount;
          
          // Track by merchant
          const merchant = tx.ai_merchant_name || tx.merchant_name || tx.name;
          if (!merchantADF[merchant]) merchantADF[merchant] = 0;
          merchantADF[merchant] += amount;
          
          // Track by category
          const category = tx.ai_category_tag || 'Unknown';
          if (!categoryADF[category]) categoryADF[category] = 0;
          categoryADF[category] += amount;
        } else if (tx.classification.type === 'FIXED_EXPENSE') {
          totalFixed += amount;
        } else if (tx.classification.type === 'TRANSFER') {
          totalTransfers += amount;
        }
      });
      
      const dailyADF = totalADF / 30;
      
      rollingTimeline.push({
        date: formatDate(windowEndDate),
        dailyADF,
        totalADF,
        totalFixed,
        totalTransfers,
        totalSpending: totalADF + totalFixed + totalTransfers,
        merchantADF,
        categoryADF,
        adfTransactionCount: windowTx.filter(tx => tx.classification.adf_eligible).length
      });
      
      // Track merchant timelines
      Object.entries(merchantADF).forEach(([merchant, amount]) => {
        if (!merchantTimelines[merchant]) merchantTimelines[merchant] = [];
        merchantTimelines[merchant].push({
          date: formatDate(windowEndDate),
          dailyADF: amount / 30,
          totalADF: amount
        });
      });

      // Track category timelines
      Object.entries(categoryADF).forEach(([category, amount]) => {
        if (!categoryTimelines[category]) categoryTimelines[category] = [];
        categoryTimelines[category].push({
          date: formatDate(windowEndDate),
          dailyADF: amount / 30,
          totalADF: amount
        });
      });
    }

    // Current period analysis (last 30 days)
    const currentWindowEnd = lastDate;
    const currentWindowStart = addDays(currentWindowEnd, -30);
    const currentTx = txData.filter(tx => 
      tx.date >= currentWindowStart && tx.date <= currentWindowEnd
    );

    let currentADF = 0;
    let currentFixed = 0;
    let currentTransfers = 0;
    const currentMerchantADF: { [key: string]: number } = {};
    const currentCategoryADF: { [key: string]: number } = {};

    currentTx.forEach(tx => {
      const amount = tx.amount;
      
      if (tx.classification.adf_eligible) {
        currentADF += amount;
        
        const merchant = tx.ai_merchant_name || tx.merchant_name || tx.name;
        if (!currentMerchantADF[merchant]) currentMerchantADF[merchant] = 0;
        currentMerchantADF[merchant] += amount;
        
        const category = tx.ai_category_tag || 'Unknown';
        if (!currentCategoryADF[category]) currentCategoryADF[category] = 0;
        currentCategoryADF[category] += amount;
      } else if (tx.classification.type === 'FIXED_EXPENSE') {
        currentFixed += amount;
      } else if (tx.classification.type === 'TRANSFER') {
        currentTransfers += amount;
      }
    });

    const currentDailyADF = currentADF / 30;
    const currentTotalSpending = currentADF + currentFixed + currentTransfers;

    // Calculate trends for top merchants/categories
    const topMerchants = Object.entries(currentMerchantADF)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([merchant, amount]) => {
        const timeline = merchantTimelines[merchant] || [];
        const firstPoint = timeline[0];
        const lastPoint = timeline[timeline.length - 1];
        const trend = firstPoint && lastPoint ? 
          ((lastPoint.dailyADF - firstPoint.dailyADF) / firstPoint.dailyADF * 100) : 0;
        
        return {
          merchant,
          currentDailyADF: amount / 30,
          currentTotal: amount,
          trend,
          timelinePoints: timeline.length
        };
      });

    const topCategories = Object.entries(currentCategoryADF)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([category, amount]) => {
        const timeline = categoryTimelines[category] || [];
        const firstPoint = timeline[0];
        const lastPoint = timeline[timeline.length - 1];
        const trend = firstPoint && lastPoint ? 
          ((lastPoint.dailyADF - firstPoint.dailyADF) / firstPoint.dailyADF * 100) : 0;
        
        return {
          category,
          currentDailyADF: amount / 30,
          currentTotal: amount,
          trend,
          timelinePoints: timeline.length
        };
      });

    // ADF trend analysis
    const recentTimeline = rollingTimeline.slice(-10);
    const earlyTimeline = rollingTimeline.slice(0, 10);
    const avgRecentADF = recentTimeline.reduce((sum, point) => sum + point.dailyADF, 0) / recentTimeline.length;
    const avgEarlyADF = earlyTimeline.reduce((sum, point) => sum + point.dailyADF, 0) / earlyTimeline.length;
    const overallTrend = avgRecentADF > avgEarlyADF ? 
      (avgRecentADF - avgEarlyADF) / avgEarlyADF * 100 : 
      -((avgEarlyADF - avgRecentADF) / avgEarlyADF * 100);

    const result = {
      summary: {
        totalTransactions: transactions.length,
        dataStartDate: formatDate(firstDate),
        dataEndDate: formatDate(lastDate),
        totalDaysOfData: totalDays,
        rollingWindowsGenerated: rollingTimeline.length
      },
      current: {
        dailyADF: currentDailyADF,
        totalADF: currentADF,
        totalFixed: currentFixed,
        totalTransfers: currentTransfers,
        totalSpending: currentTotalSpending,
        adfPercentage: (currentADF / currentTotalSpending) * 100,
        fixedPercentage: (currentFixed / currentTotalSpending) * 100
      },
      timeline: rollingTimeline,
      trends: {
        overallTrendPercentage: overallTrend,
        overallTrendDirection: overallTrend > 5 ? 'increasing' : overallTrend < -5 ? 'decreasing' : 'stable'
      },
      topMerchants,
      topCategories,
      merchantTimelines,
      categoryTimelines
    };

    return NextResponse.json(result);

  } catch (error) {
    console.error('ADF Flow API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
