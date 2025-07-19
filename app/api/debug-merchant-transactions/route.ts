import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const merchantName = url.searchParams.get('merchant') || 'Apple';
    
    const supabase = await createSupabaseClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔍 DEBUG: Testing merchant transaction query for:', merchantName);

    // Step 1: Get user's plaid_item_ids (same as frontend)
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('plaid_item_id')
      .eq('user_id', user.id);

    if (itemsError) {
      return NextResponse.json({ error: 'Items error', details: itemsError }, { status: 500 });
    }

    const itemIds = items?.map(item => item.plaid_item_id) || [];
    
    if (itemIds.length === 0) {
      return NextResponse.json({ 
        error: 'No items found',
        user_id: user.id,
        items: items
      }, { status: 404 });
    }

    // Step 2: Test the exact query from frontend
    console.log('🔍 DEBUG: Testing .or() query with itemIds:', itemIds);
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .in('plaid_item_id', itemIds)
      .or(`merchant_name.ilike.%${merchantName}%,name.ilike.%${merchantName}%`)
      .order('date', { ascending: false })
      .limit(5);

    if (txError) {
      console.error('🚨 DEBUG: Query error:', txError);
      return NextResponse.json({ 
        error: 'Transaction query failed', 
        details: txError,
        query_params: {
          itemIds,
          merchantName,
          or_clause: `merchant_name.ilike.%${merchantName}%,name.ilike.%${merchantName}%`
        }
      }, { status: 500 });
    }

    // Step 3: Also test alternative query methods for comparison
    const { data: alternativeTransactions, error: altError } = await supabase
      .from('transactions')
      .select('*')
      .in('plaid_item_id', itemIds)
      .or(`merchant_name.ilike.*${merchantName}*,name.ilike.*${merchantName}*`)
      .order('date', { ascending: false })
      .limit(5);

    return NextResponse.json({
      success: true,
      debug: {
        user_id: user.id,
        merchant_name: merchantName,
        itemIds: itemIds,
        items_count: items?.length || 0,
        query_clause: `merchant_name.ilike.%${merchantName}%,name.ilike.%${merchantName}%`
      },
      results: {
        original_query: {
          count: transactions?.length || 0,
          transactions: transactions || [],
          error: txError
        },
        alternative_query: {
          count: alternativeTransactions?.length || 0,
          transactions: alternativeTransactions || [],
          error: altError
        }
      }
    });

  } catch (error) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error',
      details: error
    }, { status: 500 });
  }
} 