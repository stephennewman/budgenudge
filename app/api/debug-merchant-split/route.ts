import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const merchantName = url.searchParams.get('merchant') || 'T-Mobile';
    
    const supabase = await createSupabaseClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's items
    const { data: items } = await supabase
      .from('items')
      .select('plaid_item_id')
      .eq('user_id', user.id);

    const itemIds = items?.map(item => item.plaid_item_id) || [];

    // Get all transactions for this merchant
    const { data: transactions } = await supabase
      .from('transactions')
      .select('id, plaid_transaction_id, date, merchant_name, name, amount, ai_merchant_name, ai_category_tag')
      .in('plaid_item_id', itemIds)
      .or(`merchant_name.ilike.%${merchantName}%,name.ilike.%${merchantName}%,ai_merchant_name.ilike.%${merchantName}%`)
      .order('date', { ascending: false })
      .limit(50);

    // Get existing tagged merchants
    const { data: taggedMerchants } = await supabase
      .from('tagged_merchants')
      .select('*')
      .eq('user_id', user.id)
      .ilike('merchant_name', `%${merchantName}%`);

    return NextResponse.json({ 
      success: true,
      merchant_name: merchantName,
      transactions: transactions || [],
      transaction_count: transactions?.length || 0,
      tagged_merchants: taggedMerchants || [],
      tagged_count: taggedMerchants?.length || 0,
      sample_transactions: (transactions || []).slice(0, 5).map(t => ({
        id: t.plaid_transaction_id,
        date: t.date,
        amount: t.amount,
        name: t.name || t.merchant_name,
        ai_name: t.ai_merchant_name
      }))
    });

  } catch (error) {
    console.error('Debug merchant split error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 