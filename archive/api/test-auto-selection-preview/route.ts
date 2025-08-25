import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/server';

// POST - Preview what auto-selection would find for a user (without saving)
export async function POST(request: Request) {
  try {
    const { user_id } = await request.json();
    
    const supabase = await createSupabaseClient();

    // Get user's items to filter transactions
    const { data: items } = await supabase
      .from('items')
      .select('plaid_item_id')
      .eq('user_id', user_id);

    const itemIds = items?.map(item => item.plaid_item_id) || [];
    if (itemIds.length === 0) {
      return NextResponse.json({ 
        success: false, 
        message: 'No Plaid items found for user',
        merchants: [],
        categories: []
      });
    }

    // Get current month for analysis
    const now = new Date();
    const currentMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    // Get 3 months of data for analysis
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const analysisStartDate = `${threeMonthsAgo.getFullYear()}-${String(threeMonthsAgo.getMonth() + 1).padStart(2, '0')}-01`;

    // MERCHANT ANALYSIS
    const { data: merchantTransactions } = await supabase
      .from('transactions')
      .select('ai_merchant_name, amount, date')
      .in('plaid_item_id', itemIds)
      .not('ai_merchant_name', 'is', null)
      .gte('amount', 0) // Only spending transactions
      .gte('date', analysisStartDate)
      .order('date', { ascending: false });

    const merchantMap = new Map();
    merchantTransactions?.forEach(transaction => {
      const merchant = transaction.ai_merchant_name;
      if (!merchantMap.has(merchant)) {
        merchantMap.set(merchant, {
          totalSpending: 0,
          transactionCount: 0,
          transactionDates: []
        });
      }
      
      const merchantData = merchantMap.get(merchant)!;
      merchantData.totalSpending += transaction.amount;
      merchantData.transactionCount += 1;
      merchantData.transactionDates.push(transaction.date);
    });

    const merchantAnalysis = Array.from(merchantMap.entries()).map(([merchant, data]) => {
      const avgDailySpending = data.totalSpending / Math.max(1, data.transactionDates.length);
      const avgMonthlySpending = avgDailySpending * 30;
      
      // Calculate frequency (average days between transactions)
      const sortedDates = data.transactionDates.sort();
      let totalDaysBetween = 0;
      for (let i = 1; i < sortedDates.length; i++) {
        const date1 = new Date(sortedDates[i-1] + 'T12:00:00');
        const date2 = new Date(sortedDates[i] + 'T12:00:00');
        const daysBetween = Math.ceil((date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24));
        totalDaysBetween += daysBetween;
      }
      const frequencyDays = sortedDates.length > 1 ? totalDaysBetween / (sortedDates.length - 1) : 30;

      return {
        merchant,
        totalSpending: data.totalSpending,
        transactionCount: data.transactionCount,
        avgMonthlySpending: Math.round(avgMonthlySpending * 100) / 100,
        frequencyDays: Math.round(frequencyDays * 10) / 10
      };
    })
    .filter(m => 
      m.avgMonthlySpending >= 25 &&  // Lower threshold for meaningful spending ($25+ avg monthly)
      m.frequencyDays <= 45 &&       // Allow up to 6-week frequency 
      m.transactionCount >= 2 &&     // Lower minimum transaction count (2+)
      // Allow high-activity merchants with even lower frequency if they spend enough
      (m.frequencyDays <= 45 || (m.avgMonthlySpending >= 100 && m.frequencyDays <= 60))
    )
    .sort((a, b) => {
      // Enhanced scoring: spending (60%) + frequency (30%) + high activity bonus (10%)
      const frequencyScoreA = Math.max(0, 30 - a.frequencyDays);
      const frequencyScoreB = Math.max(0, 30 - b.frequencyDays);
      const highActivityBonusA = a.avgMonthlySpending >= 200 ? 100 : 0;
      const highActivityBonusB = b.avgMonthlySpending >= 200 ? 100 : 0;
      
      const scoreA = (a.avgMonthlySpending * 0.6) + (frequencyScoreA * 0.3) + (highActivityBonusA * 0.1);
      const scoreB = (b.avgMonthlySpending * 0.6) + (frequencyScoreB * 0.3) + (highActivityBonusB * 0.1);
      return scoreB - scoreA;
    });

    // CATEGORY ANALYSIS
    const { data: categoryTransactions } = await supabase
      .from('transactions')
      .select('ai_category, amount, date')
      .in('plaid_item_id', itemIds)
      .not('ai_category', 'is', null)
      .gte('amount', 0) // Only spending transactions
      .gte('date', analysisStartDate)
      .order('date', { ascending: false });

    const categoryAnalysis = new Map();
    categoryTransactions?.forEach(transaction => {
      const category = transaction.ai_category;
      const isCurrentMonth = transaction.date >= currentMonthStart;
      
      if (!categoryAnalysis.has(category)) {
        categoryAnalysis.set(category, {
          totalSpending: 0,
          transactionCount: 0,
          currentMonthSpending: 0,
          currentMonthTransactions: 0
        });
      }

      const analysis = categoryAnalysis.get(category)!;
      analysis.totalSpending += transaction.amount;
      analysis.transactionCount += 1;

      if (isCurrentMonth) {
        analysis.currentMonthSpending += transaction.amount;
        analysis.currentMonthTransactions += 1;
      }
    });

    const categoryScores = Array.from(categoryAnalysis.entries())
      .map(([category, analysis]) => {
        const avgMonthlySpending = analysis.totalSpending / 3; // 3 months of data
        const avgMonthlyTransactions = analysis.transactionCount / 3;
        
        // Score based on: high spending + frequent usage + high activity patterns
        const spendingScore = avgMonthlySpending;
        const frequencyScore = avgMonthlyTransactions >= 2.5 ? avgMonthlyTransactions * 20 : 0; // Boost for frequent usage
        const currentActivityScore = analysis.currentMonthSpending > 0 ? 50 : 0; // Boost for current activity
        const highActivityScore = avgMonthlySpending >= 200 ? 100 : 0; // Extra boost for high-spend categories
        
        const totalScore = spendingScore + frequencyScore + currentActivityScore + highActivityScore;

        return {
          category,
          totalSpending: analysis.totalSpending,
          avgMonthlySpending: Math.round(avgMonthlySpending * 100) / 100,
          avgMonthlyTransactions: Math.round(avgMonthlyTransactions * 10) / 10,
          currentMonthSpending: analysis.currentMonthSpending,
          totalScore: Math.round(totalScore * 100) / 100
        };
      })
      .filter(item => 
        item.avgMonthlySpending >= 25 && // Lower threshold: $25/month average spending
        item.avgMonthlyTransactions >= 1.5 && // Lower threshold: 1.5+ transactions per month
        // Allow high-activity categories even without current month activity
        (item.currentMonthSpending > 0 || item.avgMonthlySpending >= 75)
      )
      .sort((a, b) => b.totalScore - a.totalScore);

    return NextResponse.json({
      success: true,
      user_id,
      analysis: {
        merchants: {
          total_found: merchantAnalysis.length,
          top_5: merchantAnalysis.slice(0, 5),
          all: merchantAnalysis
        },
        categories: {
          total_found: categoryScores.length,
          top_5: categoryScores.slice(0, 5),
          all: categoryScores
        }
      },
      summary: {
        merchants_would_select: Math.min(5, merchantAnalysis.length),
        categories_would_select: Math.min(5, categoryScores.length),
        total_would_select: Math.min(5, merchantAnalysis.length) + Math.min(5, categoryScores.length)
      }
    });

  } catch (error) {
    console.error('Auto-selection preview error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
