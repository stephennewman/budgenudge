import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase/server';
import { buildActivitySMS } from '@/utils/sms/templates';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Testing buildActivitySMS function...');
    
    // Get a user with recent transactions
    const userId = 'bc474c8b-4b47-4c7d-b202-f469330af2a2';
    
    // Get user's item
    const { data: userItem, error: itemError } = await supabase
      .from('items')
      .select('plaid_item_id')
      .eq('user_id', userId)
      .single();
    
    if (itemError || !userItem) {
      return NextResponse.json({ error: 'User item not found', itemError });
    }
    
    // Get transactions (last 90 days)
    const { data: allTransactions, error: transError } = await supabase
      .from('transactions')
      .select('date, name, merchant_name, amount')
      .eq('plaid_item_id', userItem.plaid_item_id)
      .gte('date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('date', { ascending: false });
    
    if (transError) {
      return NextResponse.json({ error: 'Failed to fetch transactions', transError });
    }
    
    if (!allTransactions || allTransactions.length === 0) {
      return NextResponse.json({ message: 'No transactions found' });
    }
    
    console.log(`📊 Found ${allTransactions.length} transactions for user ${userId}`);
    
    // Test buildActivitySMS function
    const activitySMS = await buildActivitySMS(allTransactions);
    
    return NextResponse.json({
      success: true,
      userId,
      totalTransactions: allTransactions.length,
      sampleTransactions: allTransactions.slice(0, 5),
      activitySMS
    });
    
  } catch (error) {
    console.error('Error in debug activity SMS:', error);
    return NextResponse.json({ error: 'Test failed', details: error.message }, { status: 500 });
  }
} 