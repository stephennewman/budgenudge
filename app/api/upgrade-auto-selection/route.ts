import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/server';

// POST - Upgrade existing user's auto-selection to use new high-activity criteria
export async function POST(request: Request) {
  try {
    const { user_id, force_upgrade = false } = await request.json();
    
    const supabase = await createSupabaseClient();

    // Get user's items
    const { data: items } = await supabase
      .from('items')
      .select('plaid_item_id')
      .eq('user_id', user_id);

    const itemIds = items?.map(item => item.plaid_item_id) || [];
    if (itemIds.length === 0) {
      return NextResponse.json({ 
        success: false, 
        message: 'No Plaid items found for user'
      });
    }

    // Get current auto-selected items to compare
    const { data: currentMerchants } = await supabase
      .from('merchant_pacing_tracking')
      .select('ai_merchant_name')
      .eq('user_id', user_id)
      .eq('auto_selected', true);

    const { data: currentCategories } = await supabase
      .from('category_pacing_tracking')
      .select('ai_category')
      .eq('user_id', user_id)
      .eq('auto_selected', true);

    // Get 3 months of transaction data for analysis
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const analysisStartDate = `${threeMonthsAgo.getFullYear()}-${String(threeMonthsAgo.getMonth() + 1).padStart(2, '0')}-01`;

    const now = new Date();
    const currentMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    // MERCHANT ANALYSIS with new criteria
    const { data: merchantTransactions } = await supabase
      .from('transactions')
      .select('ai_merchant_name, amount, date')
      .in('plaid_item_id', itemIds)
      .not('ai_merchant_name', 'is', null)
      .gte('amount', 0)
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

    const newMerchantCandidates = Array.from(merchantMap.entries()).map(([merchant, data]) => {
      const avgDailySpending = data.totalSpending / Math.max(1, data.transactionDates.length);
      const avgMonthlySpending = avgDailySpending * 30;
      
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
      m.avgMonthlySpending >= 25 &&  // New lower threshold
      m.frequencyDays <= 45 &&       // New relaxed frequency 
      m.transactionCount >= 2 &&     // New lower transaction count
      (m.frequencyDays <= 45 || (m.avgMonthlySpending >= 100 && m.frequencyDays <= 60))
    )
    .sort((a, b) => {
      const frequencyScoreA = Math.max(0, 30 - a.frequencyDays);
      const frequencyScoreB = Math.max(0, 30 - b.frequencyDays);
      const highActivityBonusA = a.avgMonthlySpending >= 200 ? 100 : 0;
      const highActivityBonusB = b.avgMonthlySpending >= 200 ? 100 : 0;
      
      const scoreA = (a.avgMonthlySpending * 0.6) + (frequencyScoreA * 0.3) + (highActivityBonusA * 0.1);
      const scoreB = (b.avgMonthlySpending * 0.6) + (frequencyScoreB * 0.3) + (highActivityBonusB * 0.1);
      return scoreB - scoreA;
    })
    .slice(0, 5);

    // CATEGORY ANALYSIS with new criteria
    const { data: categoryTransactions } = await supabase
      .from('transactions')
      .select('ai_category, amount, date')
      .in('plaid_item_id', itemIds)
      .not('ai_category', 'is', null)
      .gte('amount', 0)
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

    const newCategoryCandidates = Array.from(categoryAnalysis.entries())
      .map(([category, analysis]) => {
        const avgMonthlySpending = analysis.totalSpending / 3;
        const avgMonthlyTransactions = analysis.transactionCount / 3;
        
        const spendingScore = avgMonthlySpending;
        const frequencyScore = avgMonthlyTransactions >= 2.5 ? avgMonthlyTransactions * 20 : 0;
        const currentActivityScore = analysis.currentMonthSpending > 0 ? 50 : 0;
        const highActivityScore = avgMonthlySpending >= 200 ? 100 : 0;
        
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
        item.avgMonthlySpending >= 25 && // New lower threshold
        item.avgMonthlyTransactions >= 1.5 && // New lower threshold
        (item.currentMonthSpending > 0 || item.avgMonthlySpending >= 75) // New relaxed criteria
      )
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, 5);

    // Identify new merchants and categories to add
    const currentMerchantNames = new Set(currentMerchants?.map(m => m.ai_merchant_name) || []);
    const currentCategoryNames = new Set(currentCategories?.map(c => c.ai_category) || []);

    const newMerchantsToAdd = newMerchantCandidates.filter(m => !currentMerchantNames.has(m.merchant));
    const newCategoriesToAdd = newCategoryCandidates.filter(c => !currentCategoryNames.has(c.category));

    let addedMerchants = [];
    let addedCategories = [];

    // Add new merchants
    if (newMerchantsToAdd.length > 0) {
      const merchantsToInsert = newMerchantsToAdd.map(m => ({
        user_id: user_id,
        ai_merchant_name: m.merchant,
        is_active: true,
        auto_selected: true
      }));

      const { data: insertedMerchants, error: merchantError } = await supabase
        .from('merchant_pacing_tracking')
        .insert(merchantsToInsert)
        .select();

      if (!merchantError) {
        addedMerchants = insertedMerchants || [];
      }
    }

    // Add new categories
    if (newCategoriesToAdd.length > 0) {
      const categoriesToInsert = newCategoriesToAdd.map(c => ({
        user_id: user_id,
        ai_category: c.category,
        is_active: true,
        auto_selected: true
      }));

      const { data: insertedCategories, error: categoryError } = await supabase
        .from('category_pacing_tracking')
        .insert(categoriesToInsert)
        .select();

      if (!categoryError) {
        addedCategories = insertedCategories || [];
      }
    }

    return NextResponse.json({
      success: true,
      user_id,
      upgrade_summary: {
        merchants_before: currentMerchants?.length || 0,
        categories_before: currentCategories?.length || 0,
        new_merchants_added: addedMerchants.length,
        new_categories_added: addedCategories.length,
        total_merchants_now: (currentMerchants?.length || 0) + addedMerchants.length,
        total_categories_now: (currentCategories?.length || 0) + addedCategories.length
      },
      analysis: {
        merchant_candidates: newMerchantCandidates,
        category_candidates: newCategoryCandidates,
        added_merchants: addedMerchants,
        added_categories: addedCategories
      },
      message: `Upgraded auto-selection: +${addedMerchants.length} merchants, +${addedCategories.length} categories based on high-activity patterns`
    });

  } catch (error) {
    console.error('Auto-selection upgrade error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
