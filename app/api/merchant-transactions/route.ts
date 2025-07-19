import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const merchantName = url.searchParams.get('merchant');
    
    if (!merchantName) {
      return NextResponse.json({ error: 'merchant parameter is required' }, { status: 400 });
    }
    
    const supabase = await createSupabaseClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's plaid_item_ids
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('plaid_item_id')
      .eq('user_id', user.id);

    if (itemsError) {
      console.error('Error fetching items:', itemsError);
      return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
    }

    const itemIds = items?.map(item => item.plaid_item_id) || [];
    
    if (itemIds.length === 0) {
      return NextResponse.json({ 
        success: true,
        transactions: [],
        message: 'No connected accounts found'
      });
    }

    // Query transactions for this merchant
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('id, date, merchant_name, name, amount')
      .in('plaid_item_id', itemIds)
      .or(`merchant_name.ilike.%${merchantName}%,name.ilike.%${merchantName}%`)
      .order('date', { ascending: false })
      .limit(5);

    if (txError) {
      console.error('Error fetching transactions:', txError);
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      transactions: transactions || [],
      count: transactions?.length || 0,
      merchant: merchantName
    });

  } catch (error) {
    console.error('Merchant transactions API error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 