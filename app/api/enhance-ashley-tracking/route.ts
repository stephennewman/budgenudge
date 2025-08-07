import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create a Supabase client for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST - Manually add more high-activity merchants and categories for Ashley's demo
export async function POST() {
  try {
    const ashleyUserId = 'd5671ac4-cd39-4c1b-a897-7298dd15938a';
    
    // Get Ashley's transaction data to identify high-activity patterns
    const { data: items } = await supabase
      .from('items')
      .select('plaid_item_id')
      .eq('user_id', ashleyUserId);

    const itemIds = items?.map(item => item.plaid_item_id) || [];
    if (itemIds.length === 0) {
      return NextResponse.json({ 
        success: false, 
        message: 'No Plaid items found for Ashley'
      });
    }

    // Get 3 months of transaction data
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const analysisStartDate = `${threeMonthsAgo.getFullYear()}-${String(threeMonthsAgo.getMonth() + 1).padStart(2, '0')}-01`;

    // Analyze merchants
    const { data: merchantTransactions } = await supabase
      .from('transactions')
      .select('ai_merchant_name, amount, date')
      .in('plaid_item_id', itemIds)
      .not('ai_merchant_name', 'is', null)
      .gte('amount', 0)
      .gte('date', analysisStartDate)
      .order('date', { ascending: false });

    // Analyze categories  
    const { data: categoryTransactions } = await supabase
      .from('transactions')
      .select('ai_category, amount, date')
      .in('plaid_item_id', itemIds)
      .not('ai_category', 'is', null)
      .gte('amount', 0)
      .gte('date', analysisStartDate)
      .order('date', { ascending: false });

    // Get current tracking to avoid duplicates
    const { data: currentMerchants } = await supabase
      .from('merchant_pacing_tracking')
      .select('ai_merchant_name')
      .eq('user_id', ashleyUserId);

    const { data: currentCategories } = await supabase
      .from('category_pacing_tracking')
      .select('ai_category')
      .eq('user_id', ashleyUserId);

    const currentMerchantNames = new Set(currentMerchants?.map(m => m.ai_merchant_name) || []);
    const currentCategoryNames = new Set(currentCategories?.map(c => c.ai_category) || []);

    // Analyze merchant patterns
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

    const highActivityMerchants = Array.from(merchantMap.entries())
      .map(([merchant, data]) => {
        const avgMonthlySpending = data.totalSpending / 3;
        return {
          merchant,
          totalSpending: data.totalSpending,
          transactionCount: data.transactionCount,
          avgMonthlySpending: Math.round(avgMonthlySpending * 100) / 100
        };
      })
      .filter(m => 
        m.avgMonthlySpending >= 15 && // Very low threshold to capture more
        m.transactionCount >= 2 &&
        !currentMerchantNames.has(m.merchant)
      )
      .sort((a, b) => b.avgMonthlySpending - a.avgMonthlySpending)
      .slice(0, 8); // Get top 8 new merchants

    // Analyze category patterns
    const categoryMap = new Map();
    categoryTransactions?.forEach(transaction => {
      const category = transaction.ai_category;
      
      if (!categoryMap.has(category)) {
        categoryMap.set(category, {
          totalSpending: 0,
          transactionCount: 0
        });
      }

      const categoryData = categoryMap.get(category)!;
      categoryData.totalSpending += transaction.amount;
      categoryData.transactionCount += 1;
    });

    const highActivityCategories = Array.from(categoryMap.entries())
      .map(([category, data]) => {
        const avgMonthlySpending = data.totalSpending / 3;
        return {
          category,
          totalSpending: data.totalSpending,
          transactionCount: data.transactionCount,
          avgMonthlySpending: Math.round(avgMonthlySpending * 100) / 100
        };
      })
      .filter(c => 
        c.avgMonthlySpending >= 15 && // Very low threshold to capture more
        c.transactionCount >= 2 &&
        !currentCategoryNames.has(c.category)
      )
      .sort((a, b) => b.avgMonthlySpending - a.avgMonthlySpending)
      .slice(0, 8); // Get top 8 new categories

    // Add new merchants
    let addedMerchants = [];
    if (highActivityMerchants.length > 0) {
      const merchantsToInsert = highActivityMerchants.map(m => ({
        user_id: ashleyUserId,
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
    let addedCategories = [];
    if (highActivityCategories.length > 0) {
      const categoriesToInsert = highActivityCategories.map(c => ({
        user_id: ashleyUserId,
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
      user_id: ashleyUserId,
      enhancement_summary: {
        merchants_before: currentMerchants?.length || 0,
        categories_before: currentCategories?.length || 0,
        new_merchants_added: addedMerchants.length,
        new_categories_added: addedCategories.length,
        total_merchants_now: (currentMerchants?.length || 0) + addedMerchants.length,
        total_categories_now: (currentCategories?.length || 0) + addedCategories.length
      },
      analysis: {
        merchant_candidates: highActivityMerchants,
        category_candidates: highActivityCategories,
        added_merchants: addedMerchants,
        added_categories: addedCategories
      },
      message: `Enhanced Ashley's tracking: +${addedMerchants.length} merchants, +${addedCategories.length} categories for comprehensive coverage`
    });

  } catch (error) {
    console.error('Ashley tracking enhancement error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
