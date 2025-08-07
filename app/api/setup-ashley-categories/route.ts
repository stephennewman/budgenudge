import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create a Supabase client for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST - Set up category tracking for Ashley based on her spending patterns
export async function POST() {
  try {
    const ashleyUserId = 'd5671ac4-cd39-4c1b-a897-7298dd15938a';
    
    console.log('🎯 Setting up category pacing tracking for Ashley...');
    
    // Get Ashley's Plaid items
    const { data: items } = await supabase
      .from('items')
      .select('plaid_item_id')
      .eq('user_id', ashleyUserId);

    const itemIds = items?.map(item => item.plaid_item_id) || [];
    if (itemIds.length === 0) {
      return NextResponse.json({ success: false, error: 'No accounts found for Ashley' });
    }

    // Get all Ashley's transactions with categories
    const { data: transactions } = await supabase
      .from('transactions')
      .select('ai_category_tag, amount')
      .in('plaid_item_id', itemIds)
      .gt('amount', 0)
      .not('ai_category_tag', 'is', null);

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({ success: false, error: 'No categorized transactions found' });
    }

    // Analyze category spending
    const categorySpending = new Map<string, { total: number; count: number }>();
    
    transactions.forEach(t => {
      const category = t.ai_category_tag;
      if (!categorySpending.has(category)) {
        categorySpending.set(category, { total: 0, count: 0 });
      }
      const data = categorySpending.get(category)!;
      data.total += t.amount;
      data.count += 1;
    });

    // Sort categories by total spending (highest first)
    const sortedCategories = Array.from(categorySpending.entries())
      .map(([category, data]) => ({
        category,
        totalSpending: data.total,
        transactionCount: data.count,
        avgPerTransaction: data.total / data.count
      }))
      .sort((a, b) => b.totalSpending - a.totalSpending)
      .slice(0, 5); // Top 5 spending categories

    // Add categories to tracking
    const addedCategories = [];
    for (const cat of sortedCategories) {
      // Check if already tracked
      const { data: existing } = await supabase
        .from('category_pacing_tracking')
        .select('id')
        .eq('user_id', ashleyUserId)
        .eq('ai_category', cat.category)
        .eq('is_active', true);

      if (!existing || existing.length === 0) {
        const { data: newCategory, error } = await supabase
          .from('category_pacing_tracking')
          .insert({
            user_id: ashleyUserId,
            ai_category: cat.category,
            is_active: true,
            auto_selected: true
          })
          .select();

        if (!error && newCategory) {
          addedCategories.push({
            category: cat.category,
            totalSpending: cat.totalSpending,
            transactionCount: cat.transactionCount,
            id: newCategory[0].id
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Set up category tracking for Ashley's top ${addedCategories.length} spending categories`,
      analysis: {
        total_categories_analyzed: sortedCategories.length,
        categories_added: addedCategories.length
      },
      categories: sortedCategories,
      added_to_tracking: addedCategories
    });

  } catch (error) {
    console.error('Error setting up Ashley categories:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
