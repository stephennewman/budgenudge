import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();
    
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    // Get user's connected accounts
    const { data: userItems } = await supabase
      .from('items')
      .select('plaid_item_id')
      .eq('user_id', userId);
    
    if (!userItems?.length) {
      return NextResponse.json({ error: 'No connected accounts' });
    }

    // Get ALL negative transactions (potential income)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(endDate.getMonth() - 6);
    
    const { data: allTransactions } = await supabase
      .from('transactions')
      .select('name, amount, date, account_id')
      .in('plaid_item_id', userItems.map(item => item.plaid_item_id))
      .lt('amount', -100)
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0])
      .order('date', { ascending: true });
    
    // Filter for GCA transactions
    const gcaTransactions = allTransactions?.filter(t => 
      t.name.toLowerCase().includes('gca')
    ) || [];
    
    // Filter for CHECKIT transactions  
    const checkitTransactions = allTransactions?.filter(t =>
      t.name.toLowerCase().includes('checkit')
    ) || [];
    
    return NextResponse.json({
      success: true,
      total_transactions: allTransactions?.length || 0,
      gca_transactions: {
        count: gcaTransactions.length,
        transactions: gcaTransactions
      },
      checkit_transactions: {
        count: checkitTransactions.length,
        transactions: checkitTransactions
      }
    });
    
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ 
      error: 'Failed to check transactions',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
