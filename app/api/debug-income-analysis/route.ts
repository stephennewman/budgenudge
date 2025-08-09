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

    console.log(`🔍 Debugging income analysis for user: ${userId}`);
    
    // 1. Check if user has connected accounts
    const { data: userItems, error: itemsError } = await supabase
      .from('items')
      .select('plaid_item_id, plaid_access_token')
      .eq('user_id', userId);
    
    console.log('Connected accounts:', userItems);
    
    if (itemsError || !userItems || userItems.length === 0) {
      return NextResponse.json({ 
        debug: 'No connected accounts',
        userItems,
        error: itemsError 
      });
    }
    
    // 2. Check for negative transactions (income)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(endDate.getMonth() - 6);
    
    const { data: transactions } = await supabase
      .from('transactions')
      .select('name, amount, date, account_id')
      .in('plaid_item_id', userItems.map(item => item.plaid_item_id))
      .lt('amount', -100) // Only significant negative amounts
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0])
      .order('date', { ascending: true });
    
    console.log(`Found ${transactions?.length || 0} potential income transactions`);
    
    // 3. Look for CHECKIT LLC specifically
    const checkitTransactions = transactions?.filter(t => 
      t.name.toLowerCase().includes('checkit')
    ) || [];
    
    console.log(`CHECKIT transactions:`, checkitTransactions);
    
    // 4. Check if there's an existing income profile
    const { data: existingProfile } = await supabase
      .from('user_income_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    return NextResponse.json({
      success: true,
      debug: {
        userId,
        connectedAccounts: userItems?.length || 0,
        totalTransactions: transactions?.length || 0,
        checkitTransactions: checkitTransactions.length,
        dateRange: {
          start: startDate.toISOString().split('T')[0],
          end: endDate.toISOString().split('T')[0]
        },
        sampleTransactions: transactions?.slice(0, 5),
        checkitSample: checkitTransactions.slice(0, 3),
        existingProfile: existingProfile ? 'exists' : 'none'
      }
    });
    
  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json({ 
      error: 'Debug failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
