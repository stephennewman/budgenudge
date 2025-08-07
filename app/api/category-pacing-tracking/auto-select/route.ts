import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/server';

// POST - Auto-select top 5 high-activity categories for a user
export async function POST() {
  try {
    const supabase = await createSupabaseClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user already has category tracking set up
    const { data: existingTracking } = await supabase
      .from('category_pacing_tracking')
      .select('id')
      .eq('user_id', user.id)
      .limit(1);

    if (existingTracking && existingTracking.length > 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'User already has category pacing tracking configured',
        auto_selected: []
      });
    }

    // Get user's items to filter transactions
    const { data: items } = await supabase
      .from('items')
      .select('plaid_item_id')
      .eq('user_id', user.id);

    const itemIds = items?.map(item => item.plaid_item_id) || [];
    if (itemIds.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No Plaid items found for user',
        auto_selected: []
      });
    }

    // Get current month for analysis (to focus on recent activity)
    const now = new Date();
    const currentMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    // Get all spending transactions with AI categories from last 3 months for analysis
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const analysisStartDate = `${threeMonthsAgo.getFullYear()}-${String(threeMonthsAgo.getMonth() + 1).padStart(2, '0')}-01`;

    const { data: transactions, error: transactionsError } = await supabase
      .from('transactions')
      .select('amount, ai_category_tag, date')
      .in('plaid_item_id', itemIds)
      .gte('amount', 0) // Only spending transactions
      .gte('date', analysisStartDate)
      .not('ai_category_tag', 'is', null)
      .not('ai_category_tag', 'in', '("Income","Transfer","Uncategorized")'); // Exclude as per requirements

    if (transactionsError) {
      console.error('Error fetching transactions for auto-selection:', transactionsError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to analyze transactions for auto-selection' 
      }, { status: 500 });
    }

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No categorized transactions found for analysis',
        auto_selected: []
      });
    }

    // Analyze categories and find high-activity ones
    const categoryAnalysis = new Map<string, {
      totalSpending: number;
      transactionCount: number;
      currentMonthSpending: number;
      currentMonthTransactions: number;
    }>();

    transactions.forEach(transaction => {
      const category = transaction.ai_category_tag;
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

    // Calculate selection criteria and find top 3
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
          analysis,
          avgMonthlySpending,
          avgMonthlyTransactions,
          totalScore
        };
      })
      .filter(item => 
        item.avgMonthlySpending >= 25 && // Lower threshold: $25/month average spending
        item.avgMonthlyTransactions >= 1.5 && // Lower threshold: 1.5+ transactions per month
        // Allow high-activity categories even without current month activity
        (item.analysis.currentMonthSpending > 0 || item.avgMonthlySpending >= 75)
      )
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, 5); // Top 5

    if (categoryScores.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No categories met auto-selection criteria',
        auto_selected: []
      });
    }

    // Insert auto-selected categories
    const categoriesForTracking = categoryScores.map(item => ({
      user_id: user.id,
      ai_category: item.category,
      is_active: true,
      auto_selected: true
    }));

    const { data: autoSelectedRecords, error: insertError } = await supabase
      .from('category_pacing_tracking')
      .insert(categoriesForTracking)
      .select();

    if (insertError) {
      console.error('Error auto-selecting categories:', insertError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to auto-select categories' 
      }, { status: 500 });
    }

    // Format response with analysis details
    const categoryAnalysisDetails = categoryScores.map(item => ({
      category: item.category,
      avg_monthly_spending: Math.round(item.avgMonthlySpending * 100) / 100,
      avg_monthly_transactions: Math.round(item.avgMonthlyTransactions * 10) / 10,
      current_month_spending: item.analysis.currentMonthSpending,
      current_month_transactions: item.analysis.currentMonthTransactions,
      selection_score: Math.round(item.totalScore)
    }));

    return NextResponse.json({ 
      success: true, 
      message: `Auto-selected ${autoSelectedRecords?.length || 0} categories for pacing tracking`,
      auto_selected: autoSelectedRecords || [],
      category_analysis: categoryAnalysisDetails
    });

  } catch (error) {
    console.error('Category auto-selection error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 