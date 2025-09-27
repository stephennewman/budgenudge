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

    // Check user's accounts
    const { data: accounts, error: accountError } = await supabase
      .from('items')
      .select('*')
      .eq('user_id', userId);

    if (accountError) {
      return NextResponse.json({ error: accountError.message }, { status: 500 });
    }

    // Check transactions for this user (all accounts)
    const { data: allTransactions, error: txError } = await supabase
      .from('transactions')
      .select(`
        id,
        name,
        merchant_name,
        ai_merchant_name,
        ai_category_tag,
        amount,
        date,
        items!inner(user_id, status)
      `)
      .eq('items.user_id', userId)
      .order('date', { ascending: false })
      .limit(10);

    if (txError) {
      return NextResponse.json({ error: txError.message }, { status: 500 });
    }

    // Check transactions for active accounts only
    const { data: activeTransactions, error: activeTxError } = await supabase
      .from('transactions')
      .select(`
        id,
        name,
        merchant_name,
        ai_merchant_name,
        ai_category_tag,
        amount,
        date,
        items!inner(user_id, status)
      `)
      .eq('items.user_id', userId)
      .eq('items.status', 'good')
      .order('date', { ascending: false })
      .limit(10);

    if (activeTxError) {
      return NextResponse.json({ error: activeTxError.message }, { status: 500 });
    }

    // Get transaction counts
    const { count: totalTxCount, error: totalCountError } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('items.user_id', userId);

    const { count: activeTxCount, error: activeCountError } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('items.user_id', userId)
      .eq('items.status', 'good');

    return NextResponse.json({
      userId,
      accounts: {
        total: accounts?.length || 0,
        details: accounts?.map(acc => ({
          id: acc.id,
          institution: acc.institution_name,
          status: acc.status,
          last_sync: acc.updated_at
        })) || []
      },
      transactions: {
        total: totalTxCount || 0,
        active: activeTxCount || 0,
        recentAll: allTransactions?.length || 0,
        recentActive: activeTransactions?.length || 0,
        sampleActive: activeTransactions?.slice(0, 3).map(tx => ({
          id: tx.id,
          name: tx.name,
          merchant: tx.ai_merchant_name || tx.merchant_name,
          category: tx.ai_category_tag,
          amount: tx.amount,
          date: tx.date
        })) || []
      }
    });

  } catch (error) {
    console.error('Debug API Error:', error);
    return NextResponse.json({ error: 'Failed to debug user data' }, { status: 500 });
  }
}
