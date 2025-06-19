import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized - Missing token' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Create Supabase client and get user with token
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's items first
    const { data: items } = await supabase
      .from('items')
      .select('id, plaid_item_id')
      .eq('user_id', user.id);

    if (!items || items.length === 0) {
      return NextResponse.json({ transactions: [], accounts: [] });
    }

    const itemIds = items.map(item => item.plaid_item_id);
    const itemDbIds = items.map(item => item.id);

    // Get user's transactions
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .in('plaid_item_id', itemIds)
      .order('date', { ascending: false });

    // Get user's accounts  
    const { data: accounts, error: accError } = await supabase
      .from('accounts')
      .select('*')
      .in('item_id', itemDbIds);

    if (txError) throw txError;
    if (accError) throw accError;

    return NextResponse.json({ 
      transactions: transactions || [], 
      accounts: accounts || []
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
} 