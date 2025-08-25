import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create a Supabase client for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST - Fix Ashley's categories directly
export async function POST() {
  try {
    console.log('🔧 Fixing Ashley\'s categories directly...');
    
    const ashleyUserId = 'd5671ac4-cd39-4c1b-a897-7298dd15938a';
    
    // Step 1: Remove ALL existing categories for Ashley
    const { data: allRemoved, error: removeAllError } = await supabase
      .from('category_pacing_tracking')
      .delete()
      .eq('user_id', ashleyUserId)
      .select();

    if (removeAllError) {
      console.error('Error removing all categories:', removeAllError);
      return NextResponse.json({ success: false, error: 'Failed to remove existing categories' });
    }

    console.log(`✅ Removed ${allRemoved?.length || 0} existing categories`);

    // Step 2: Add only appropriate gradual spending categories
    // Categories that actually benefit from daily pacing analysis
    const goodCategories = [
      'Groceries',    // Daily/weekly shopping
      'Restaurant',   // Variable dining spending  
      'Gas',          // Frequent fuel purchases
      'Shopping',     // Variable retail purchases
      'Entertainment' // Variable entertainment spending
    ];

    const categoriesToAdd = goodCategories.map(category => ({
      user_id: ashleyUserId,
      ai_category: category,
      is_active: true,
      auto_selected: false
    }));

    // Insert one by one to handle any conflicts gracefully
    const addedCategories = [];
    const failedCategories = [];

    for (const categoryData of categoriesToAdd) {
      try {
        const { data: addedCategory, error: addError } = await supabase
          .from('category_pacing_tracking')
          .insert(categoryData)
          .select()
          .single();

        if (addError) {
          console.error(`Failed to add ${categoryData.ai_category}:`, addError);
          failedCategories.push(categoryData.ai_category);
        } else {
          console.log(`✅ Added category: ${categoryData.ai_category}`);
          addedCategories.push(addedCategory);
        }
      } catch (error) {
        console.error(`Exception adding ${categoryData.ai_category}:`, error);
        failedCategories.push(categoryData.ai_category);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Fixed Ashley's categories: removed ${allRemoved?.length || 0}, added ${addedCategories.length}`,
      details: {
        removed_count: allRemoved?.length || 0,
        added_count: addedCategories.length,
        failed_count: failedCategories.length,
        removed_categories: allRemoved?.map(c => c.ai_category) || [],
        added_categories: addedCategories.map(c => c.ai_category),
        failed_categories: failedCategories
      },
      explanation: 'Removed all one-time payment categories and added only gradual spending categories that benefit from daily pacing analysis'
    });

  } catch (error) {
    console.error('Direct category fix error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
