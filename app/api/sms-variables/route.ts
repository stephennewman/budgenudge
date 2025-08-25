import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies });
  
  try {
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔍 Sampling data for user:', user.id);

    // Sample 1: Account Information
    const { data: accounts } = await supabase
      .from('accounts')
      .select(`
        id,
        name,
        type,
        subtype,
        available_balance,
        current_balance,
        mask,
        institution_name,
        created_at
      `)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .limit(5);

    // Sample 2: Recent Transactions
    const { data: recentTransactions } = await supabase
      .from('transactions')
      .select(`
        id,
        name,
        amount,
        date,
        category,
        subcategory,
        merchant_name,
        pending,
        created_at
      `)
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(10);

    // Sample 3: Recurring Bills
    const { data: recurringBills } = await supabase
      .from('recurring_bills')
      .select(`
        id,
        name,
        amount,
        frequency,
        next_due_date,
        category,
        merchant_name,
        created_at
      `)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .limit(5);

    // Sample 4: Spending Categories
    const { data: spendingCategories } = await supabase
      .from('transactions')
      .select(`
        category,
        subcategory,
        amount
      `)
      .eq('user_id', user.id)
      .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

    // Sample 5: Income Sources
    const { data: incomeSources } = await supabase
      .from('income_sources')
      .select(`
        id,
        name,
        amount,
        frequency,
        next_pay_date,
        category,
        created_at
      `)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .limit(5);

    // Sample 6: Merchant Analytics
    const { data: topMerchants } = await supabase
      .from('transactions')
      .select(`
        merchant_name,
        amount,
        category
      `)
      .eq('user_id', user.id)
      .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .not('merchant_name', 'is', null)
      .limit(10);

    // Sample 7: Account Types
    const { data: accountTypes } = await supabase
      .from('accounts')
      .select(`
        type,
        subtype,
        count
      `)
      .eq('user_id', user.id)
      .is('deleted_at', null);

    // Sample 8: Transaction Patterns (commented out for now)
    // const { data: transactionPatterns } = await supabase
    //   .from('transactions')
    //   .select(`
    //     date,
    //     amount,
    //     category
    //   `)
    //   .eq('user_id', user.id)
    //   .gte('date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    //   .order('date', { ascending: false });

    // Calculate some derived metrics
    const totalBalance = accounts?.reduce((sum, acc) => sum + (acc.available_balance || acc.current_balance || 0), 0) || 0;
    const monthlySpending = spendingCategories?.reduce((sum, tx) => sum + Math.abs(tx.amount || 0), 0) || 0;
    const uniqueCategories = [...new Set(spendingCategories?.map(tx => tx.category).filter(Boolean))];
    const uniqueMerchants = [...new Set(topMerchants?.map(tx => tx.merchant_name).filter(Boolean))];

    const dataSample = {
      user: {
        id: user.id,
        email: user.email
      },
      accounts: {
        count: accounts?.length || 0,
        total_balance: totalBalance,
        types: accountTypes?.map(acc => ({ type: acc.type, subtype: acc.subtype })) || [],
        sample: accounts?.slice(0, 3) || []
      },
      transactions: {
        recent_count: recentTransactions?.length || 0,
        monthly_spending: monthlySpending,
        unique_categories: uniqueCategories.length,
        unique_merchants: uniqueMerchants.length,
        sample: recentTransactions?.slice(0, 5) || []
      },
      recurring_bills: {
        count: recurringBills?.length || 0,
        total_monthly: recurringBills?.reduce((sum, bill) => sum + (bill.amount || 0), 0) || 0,
        sample: recurringBills?.slice(0, 3) || []
      },
      income_sources: {
        count: incomeSources?.length || 0,
        total_monthly: incomeSources?.reduce((sum, income) => sum + (income.amount || 0), 0) || 0,
        sample: incomeSources?.slice(0, 3) || []
      },
      spending_analysis: {
        top_categories: spendingCategories
          ?.reduce((acc, tx) => {
            const cat = tx.category || 'Uncategorized';
            acc[cat] = (acc[cat] || 0) + Math.abs(tx.amount || 0);
            return acc;
          }, {} as Record<string, number>)
          ? Object.entries(spendingCategories.reduce((acc, tx) => {
              const cat = tx.category || 'Uncategorized';
              acc[cat] = (acc[cat] || 0) + Math.abs(tx.amount || 0);
              return acc;
            }, {} as Record<string, number>))
            .sort(([,a], [,b]) => (b as number) - (a as number))
            .slice(0, 5)
            .map(([category, amount]) => ({ category, amount: amount as number }))
          : [],
        top_merchants: topMerchants
          ?.reduce((acc, tx) => {
            const merchant = tx.merchant_name || 'Unknown';
            acc[merchant] = (acc[merchant] || 0) + Math.abs(tx.amount || 0);
            return acc;
          }, {} as Record<string, number>)
          ? Object.entries(topMerchants.reduce((acc, tx) => {
              const merchant = tx.merchant_name || 'Unknown';
              acc[merchant] = (acc[merchant] || 0) + Math.abs(tx.amount || 0);
              return acc;
            }, {} as Record<string, number>))
            .sort(([,a], [,b]) => (b as number) - (a as number))
            .slice(0, 5)
            .map(([merchant, amount]) => ({ merchant, amount: amount as number }))
          : []
      },
      suggested_variables: [
        {
          id: 'account-names',
          name: 'Account Names',
          description: 'List of connected account names',
          example: accounts?.map(acc => acc.name).join(', ') || 'No accounts'
        },
        {
          id: 'institution-count',
          name: 'Institution Count',
          description: 'Number of different financial institutions',
          example: `${new Set(accounts?.map(acc => acc.institution_name).filter(Boolean)).size} institutions`
        },
        {
          id: 'monthly-spending',
          name: 'Monthly Spending',
          description: 'Total spending in the last 30 days',
          example: `$${monthlySpending.toLocaleString()}`
        },
        {
          id: 'top-spending-category',
          name: 'Top Spending Category',
          description: 'Category with highest spending this month',
          example: spendingCategories?.length ? 
            Object.entries(spendingCategories.reduce((acc, tx) => {
              const cat = tx.category || 'Uncategorized';
              acc[cat] = (acc[cat] || 0) + Math.abs(tx.amount || 0);
              return acc;
            }, {} as Record<string, number>))
            .sort(([,a], [,b]) => b - a)[0]?.[0] || 'None' : 'None'
        },
        {
          id: 'recurring-bills-count',
          name: 'Recurring Bills Count',
          description: 'Number of recurring bills',
          example: `${recurringBills?.length || 0} bills`
        },
        {
          id: 'recurring-bills-total',
          name: 'Recurring Bills Total',
          description: 'Total monthly recurring bill amount',
          example: `$${recurringBills?.reduce((sum, bill) => sum + (bill.amount || 0), 0).toLocaleString() || 0}`
        },
        {
          id: 'income-sources-count',
          name: 'Income Sources Count',
          description: 'Number of income sources',
          example: `${incomeSources?.length || 0} sources`
        },
        {
          id: 'income-sources-total',
          name: 'Income Sources Total',
          description: 'Total monthly income',
          example: `$${incomeSources?.reduce((sum, income) => sum + (income.amount || 0), 0).toLocaleString() || 0}`
        },
        {
          id: 'unique-categories',
          name: 'Unique Categories',
          description: 'Number of unique spending categories',
          example: `${uniqueCategories.length} categories`
        },
        {
          id: 'unique-merchants',
          name: 'Unique Merchants',
          description: 'Number of unique merchants',
          example: `${uniqueMerchants.length} merchants`
        },
        {
          id: 'account-types',
          name: 'Account Types',
          description: 'Types of accounts connected',
          example: accounts?.map(acc => `${acc.type} (${acc.subtype})`).join(', ') || 'None'
        },
        {
          id: 'pending-transactions',
          name: 'Pending Transactions',
          description: 'Number of pending transactions',
          example: `${recentTransactions?.filter(tx => tx.pending).length || 0} pending`
        }
      ]
    };

    return NextResponse.json(dataSample);

  } catch (error) {
    console.error('Error sampling SMS variables data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
