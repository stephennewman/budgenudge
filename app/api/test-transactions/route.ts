import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'userId parameter required' }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseClient();

    // Get user's active items
    const { data: activeItems, error: itemsError } = await supabase
      .from('items')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'good');

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    // Get transactions for each active item
    const results = [];
    for (const item of activeItems || []) {
      const { data: transactions, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .eq('plaid_item_id', item.plaid_item_id)
        .order('date', { ascending: false })
        .limit(5);

      results.push({
        item: {
          id: item.id,
          plaid_item_id: item.plaid_item_id,
          institution_name: item.institution_name,
          status: item.status
        },
        transactions: transactions || [],
        error: txError?.message,
        transactionCount: transactions?.length || 0
      });
    }

    return NextResponse.json({
      userId,
      activeItems: activeItems?.length || 0,
      itemDetails: results
    });

  } catch (error) {
    console.error('Test transactions error:', error);
    return NextResponse.json({ error: 'Failed to test transactions' }, { status: 500 });
  }
}
