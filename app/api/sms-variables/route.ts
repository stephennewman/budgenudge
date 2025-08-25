import { createSupabaseClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createSupabaseClient();
  
  try {
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔍 Sampling data for user:', user.id);

    // Get user's Plaid items first (this is the correct data flow)
    const { data: userItems } = await supabase
      .from('items')
      .select('id, plaid_item_id')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .limit(10);

    console.log('🔍 Found user items:', userItems?.length || 0);

    if (!userItems || userItems.length === 0) {
      console.log('❌ No Plaid items found for user');
      return NextResponse.json({
        user: { id: user.id, email: user.email },
        accounts: { count: 0, total_balance: 0, types: [], sample: [] },
        transactions: { recent_count: 0, monthly_spending: 0, unique_categories: 0, unique_merchants: 0, sample: [] },
        recurring_bills: { count: 0, total_monthly: 0, sample: [] },
        income_sources: { count: 0, total_monthly: 0, sample: [] },
        spending_analysis: { top_categories: [], top_merchants: [] },
        suggested_variables: [
          {
            id: 'no-accounts',
            name: 'No Accounts Connected',
            description: 'You need to connect your bank accounts first',
            example: 'Please connect your bank accounts via Plaid to see financial data'
          }
        ]
      });
    }

    const itemIds = userItems.map(item => item.id);
    const plaidItemIds = userItems.map(item => item.plaid_item_id).filter(Boolean);

    console.log('🔍 Using item IDs:', itemIds);
    console.log('🔍 Using Plaid item IDs:', plaidItemIds);
    console.log('🔍 User ID being used:', user.id);

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
      .in('item_id', itemIds)
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
      .in('plaid_item_id', plaidItemIds)
      .order('date', { ascending: false })
      .limit(10);

    // Sample 3: Recurring Bills (using tagged_merchants table like the recurring bills page)
    const { data: recurringBills } = await supabase
      .from('tagged_merchants')
      .select(`
        id,
        merchant_name,
        expected_amount,
        prediction_frequency,
        next_predicted_date,
        confidence_score,
        is_active,
        created_at
      `)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(5);

    // Sample 4: Spending Categories
    const { data: spendingCategories } = await supabase
      .from('transactions')
      .select(`
        category,
        subcategory,
        amount
      `)
      .in('plaid_item_id', plaidItemIds)
      .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

    // Sample 5: Income Sources (using user_income_profiles table like the income page)
    const { data: incomeProfile } = await supabase
      .from('user_income_profiles')
      .select('profile_data')
      .eq('user_id', user.id)
      .single();

    let incomeSources: Array<{
      id: string;
      name: string;
      amount: number;
      frequency: string;
      next_pay_date: string | null;
      category: string;
      created_at: string;
    }> = [];
    if (incomeProfile?.profile_data?.income_sources) {
      incomeSources = incomeProfile.profile_data.income_sources.map((source: {
        id?: string;
        source_name?: string;
        expected_amount?: number;
        amount?: number;
        frequency?: string;
        pattern_type?: string;
        next_predicted_date?: string | null;
        category?: string;
      }) => ({
        id: source.id || `source_${source.source_name?.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        name: source.source_name || 'Unknown Source',
        amount: source.expected_amount || source.amount || 0,
        frequency: source.frequency || source.pattern_type || 'irregular',
        next_pay_date: source.next_predicted_date || null,
        category: source.category || 'income',
        created_at: new Date().toISOString()
      })).slice(0, 5);
    }

    // Sample 6: Merchant Analytics
    const { data: topMerchants } = await supabase
      .from('transactions')
      .select(`
        merchant_name,
        amount,
        category
      `)
      .in('plaid_item_id', plaidItemIds)
      .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .not('merchant_name', 'is', null)
      .limit(10);

    // Sample 7: Account Types
    const { data: accountTypes } = await supabase
      .from('accounts')
      .select(`
        type,
        subtype
      `)
      .in('item_id', itemIds)
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
        total_monthly: recurringBills?.reduce((sum, bill) => sum + (bill.expected_amount || 0), 0) || 0,
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
          example: `$${recurringBills?.reduce((sum, bill) => sum + (bill.expected_amount || 0), 0).toLocaleString() || 0}`
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
