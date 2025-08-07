import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create a Supabase client for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST - Clean up Ashley's inappropriate category pacing categories
export async function POST() {
  try {
    console.log('🧹 Cleaning up Ashley\'s inappropriate category pacing...');
    
    const ashleyUserId = 'd5671ac4-cd39-4c1b-a897-7298dd15938a';
    
    // Categories to remove: one-time payments and large monthly bills that don't benefit from daily pacing
    const categoriesToRemove = ['rent', 'transfer', 'financial', 'insurance', 'mortgage', 'loan', 'housing', 'payment'];
    
    // Remove all inappropriate categories for Ashley
    const { data: removedCategories, error: removeError } = await supabase
      .from('category_pacing_tracking')
      .delete()
      .eq('user_id', ashleyUserId)
      .in('ai_category', categoriesToRemove)
      .select();

    if (removeError) {
      console.error('Error removing categories:', removeError);
      return NextResponse.json({ success: false, error: 'Failed to remove categories' });
    }

    console.log(`✅ Removed ${removedCategories?.length || 0} inappropriate categories`);

    // Add appropriate categories that benefit from daily pacing tracking
    const appropriateCategories = [
      { ai_category: 'Groceries', is_active: true },
      { ai_category: 'Restaurant', is_active: true },
      { ai_category: 'Gas', is_active: true },
      { ai_category: 'Shopping', is_active: true },
      { ai_category: 'Entertainment', is_active: true }
    ];

    const categoriesToAdd = appropriateCategories.map(cat => ({
      user_id: ashleyUserId,
      ai_category: cat.ai_category,
      is_active: cat.is_active,
      auto_selected: false // Manually configured for better experience
    }));

    const { data: addedCategories, error: addError } = await supabase
      .from('category_pacing_tracking')
      .insert(categoriesToAdd)
      .select();

    if (addError) {
      console.error('Error adding categories:', addError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to add appropriate categories',
        removed_count: removedCategories?.length || 0
      });
    }

    console.log(`✅ Added ${addedCategories?.length || 0} appropriate categories`);

    return NextResponse.json({
      success: true,
      message: `Cleaned up Ashley's category pacing: removed ${removedCategories?.length || 0} inappropriate categories, added ${addedCategories?.length || 0} appropriate ones`,
      cleanup_summary: {
        categories_removed: removedCategories?.length || 0,
        categories_added: addedCategories?.length || 0,
        removed_categories: removedCategories?.map(c => c.ai_category) || [],
        added_categories: addedCategories?.map(c => c.ai_category) || []
      },
      explanation: 'Removed one-time payments (rent, transfer, financial, insurance) and added gradual spending categories (groceries, restaurant, gas, shopping, entertainment) that benefit from daily pacing analysis'
    });

  } catch (error) {
    console.error('Ashley category cleanup error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
