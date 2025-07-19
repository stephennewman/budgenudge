import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/server';

export async function GET() {
  try {
    const supabase = await createSupabaseClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all unique AI merchant names and categories from cache
    const { data: merchantTags, error: merchantError } = await supabase
      .from('merchant_ai_tags')
      .select('ai_merchant_name, ai_category_tag, is_manual_override')
      .order('ai_merchant_name');

    if (merchantError) {
      console.error('Failed to fetch merchant tags:', merchantError);
      return NextResponse.json({ error: 'Failed to fetch merchant tags' }, { status: 500 });
    }

    // Get user's transactions to see what merchants they have
    const { data: items } = await supabase
      .from('items')
      .select('plaid_item_id')
      .eq('user_id', user.id);

    const itemIds = items?.map(item => item.plaid_item_id) || [];

    const { data: userMerchants, error: userMerchantError } = await supabase
      .from('transactions')
      .select('merchant_name, name, ai_merchant_name, ai_category_tag')
      .in('plaid_item_id', itemIds)
      .not('ai_merchant_name', 'is', null)
      .limit(1000);

    if (userMerchantError) {
      console.error('Failed to fetch user merchants:', userMerchantError);
    }

    // Create unique lists
    const merchantNames = new Set<string>();
    const categoryTags = new Set<string>();

    // Add from cache
    merchantTags?.forEach(tag => {
      merchantNames.add(tag.ai_merchant_name);
      categoryTags.add(tag.ai_category_tag);
    });

    // Add from user's transactions
    userMerchants?.forEach(tx => {
      if (tx.ai_merchant_name) merchantNames.add(tx.ai_merchant_name);
      if (tx.ai_category_tag) categoryTags.add(tx.ai_category_tag);
    });

    // Convert to sorted arrays
    const sortedMerchants = Array.from(merchantNames).sort();
    const sortedCategories = Array.from(categoryTags).sort();

    // Popular categories to suggest first
    const popularCategories = [
      'Grocery', 'Shopping', 'Restaurants', 'Gas', 'Entertainment', 
      'Bills & Utilities', 'Healthcare', 'Transportation', 'Travel',
      'Services', 'Education', 'Fees', 'Income', 'Transfers'
    ];

    // Merge popular categories with existing ones, avoiding duplicates
    const allCategories = [
      ...popularCategories,
      ...sortedCategories.filter(cat => !popularCategories.includes(cat))
    ];

    return NextResponse.json({
      success: true,
      merchant_names: sortedMerchants,
      category_tags: allCategories,
      total_merchants: sortedMerchants.length,
      total_categories: allCategories.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Tag options error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 