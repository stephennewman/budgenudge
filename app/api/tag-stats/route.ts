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

    // Get user's item IDs
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('plaid_item_id')
      .eq('user_id', user.id);

    if (itemsError || !items?.length) {
      return NextResponse.json({ error: 'No connected accounts found' }, { status: 400 });
    }

    const itemIds = items.map(item => item.plaid_item_id);

    // Get comprehensive stats
    const { data: allTransactions } = await supabase
      .from('transactions')
      .select('ai_merchant_name, ai_category_tag, merchant_name, name')
      .in('plaid_item_id', itemIds)
      .order('date', { ascending: false });

    if (!allTransactions) {
      return NextResponse.json({ error: 'Failed to fetch transaction stats' }, { status: 500 });
    }

    const total = allTransactions.length;
    const tagged = allTransactions.filter(t => t.ai_merchant_name && t.ai_category_tag).length;
    const untagged = total - tagged;
    const percentage = total > 0 ? Math.round((tagged / total) * 100) : 0;

    // Get sample of untagged transactions
    const untaggedSample = allTransactions
      .filter(t => !t.ai_merchant_name)
      .slice(0, 10)
      .map(t => t.merchant_name || t.name);

    // Get unique untagged merchants
    const untaggedMerchants = new Set();
    allTransactions.forEach(t => {
      if (!t.ai_merchant_name) {
        untaggedMerchants.add(t.merchant_name || t.name);
      }
    });

    return NextResponse.json({
      success: true,
      stats: {
        total_transactions: total,
        tagged_transactions: tagged,
        untagged_transactions: untagged,
        tagging_percentage: percentage,
        unique_untagged_merchants: untaggedMerchants.size
      },
      untagged_sample: Array.from(untaggedMerchants).slice(0, 15),
      recommendations: {
        can_run_another_batch: untagged > 0,
        estimated_api_calls: untaggedMerchants.size,
        estimated_cost: `$${(untaggedMerchants.size * 0.01).toFixed(2)}`
      }
    });

  } catch (error) {
    console.error('Tag stats error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 