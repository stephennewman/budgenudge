import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/server';

interface VariableResult {
  value?: string;
  raw?: number | string;
  error?: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const variableType = searchParams.get('type');
    
    // Create Supabase client with proper server-side authentication
    const supabase = await createSupabaseClient();
    
    // Get current user (uses cookies automatically)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`📊 Fetching SMS variable "${variableType}" for user: ${user.id}`);

    let result: VariableResult = {};

    switch (variableType) {
      case 'account-count':
        // Get count of connected accounts through items
        const { data: userItems, error: itemsError } = await supabase
          .from('items')
          .select('id')
          .eq('user_id', user.id);

        if (itemsError || !userItems || userItems.length === 0) {
          result = { error: 'No connected accounts found' };
        } else {
          const itemIds = userItems.map(item => item.id);
          const { count: accountCount, error: accountError } = await supabase
            .from('accounts')
            .select('*', { count: 'exact', head: true })
            .in('item_id', itemIds)
            .is('deleted_at', null);

          if (accountError) {
            console.error('❌ Error fetching account count:', accountError);
            result = { error: 'Failed to fetch account count' };
          } else {
            result = { 
              value: `${accountCount || 0} account${(accountCount || 0) !== 1 ? 's' : ''} connected`,
              raw: accountCount || 0
            };
          }
        }
        break;

      case 'last-transaction-date':
        // Get most recent transaction date through items
        const { data: userItemsForTx, error: itemsTxError } = await supabase
          .from('items')
          .select('plaid_item_id')
          .eq('user_id', user.id);

        if (itemsTxError || !userItemsForTx || userItemsForTx.length === 0) {
          result = { error: 'No connected accounts found' };
        } else {
          const plaidItemIds = userItemsForTx.map(item => item.plaid_item_id);
          const { data: lastTransaction, error: transactionError } = await supabase
            .from('transactions')
            .select('date')
            .in('plaid_item_id', plaidItemIds)
            .order('date', { ascending: false })
            .limit(1)
            .single();

          if (transactionError || !lastTransaction) {
            console.error('❌ Error fetching last transaction date:', transactionError);
            result = { error: 'No transactions found' };
          } else {
            const date = new Date(lastTransaction.date);
            result = { 
              value: date.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              }),
              raw: lastTransaction.date
            };
          }
        }
        break;

      case 'total-balance':
        // Get total balance from all accounts through items
        const { data: userItemsForBalance, error: itemsBalanceError } = await supabase
          .from('items')
          .select('id')
          .eq('user_id', user.id);

        if (itemsBalanceError || !userItemsForBalance || userItemsForBalance.length === 0) {
          result = { error: 'No connected accounts found' };
        } else {
          const itemIds = userItemsForBalance.map(item => item.id);
          const { data: accounts, error: balanceError } = await supabase
            .from('accounts')
            .select('available_balance, current_balance')
            .in('item_id', itemIds)
            .is('deleted_at', null);

          if (balanceError) {
            console.error('❌ Error fetching account balances:', balanceError);
            result = { error: 'Failed to fetch balances' };
          } else if (!accounts || accounts.length === 0) {
            result = { error: 'No accounts found' };
          } else {
            const totalBalance = accounts.reduce((sum, acc) => {
              // Use available_balance if present, fallback to current_balance
              const balance = acc.available_balance ?? acc.current_balance ?? 0;
              return sum + balance;
            }, 0);
            
            result = { 
              value: `$${totalBalance.toLocaleString('en-US', { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
              })}`,
              raw: totalBalance
            };
          }
        }
        break;

      default:
        return NextResponse.json({ 
          error: 'Invalid variable type. Supported types: account-count, last-transaction-date, total-balance' 
        }, { status: 400 });
    }

    console.log(`✅ SMS variable "${variableType}" fetched:`, result);
    
    return NextResponse.json({ 
      success: true, 
      variable: variableType,
      data: result
    });
    
  } catch (error) {
    console.error('❌ SMS variables API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error while fetching SMS variable' 
    }, { status: 500 });
  }
}
