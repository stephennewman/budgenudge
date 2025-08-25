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
      .select('id, plaid_item_id, institution_name')
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

    const itemDbIds = userItems.map(item => item.id); // Database IDs for accounts
    const plaidItemIds = userItems.map(item => item.plaid_item_id).filter(Boolean); // Plaid IDs for transactions

    console.log('🔍 Using database item IDs:', itemDbIds);
    console.log('🔍 Using Plaid item IDs:', plaidItemIds);
    console.log('🔍 User ID being used:', user.id);

    // Sample 1: Account Information (using itemDbIds like the working transactions API)
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
      .in('item_id', itemDbIds)
      .is('deleted_at', null)
      .limit(10);

    console.log('🔍 Accounts query result:', accounts?.length || 0, 'accounts found');
    if (accounts && accounts.length > 0) {
      console.log('🔍 First account sample:', accounts[0]);
    }

    // Sample 2: Recent Transactions with AI categorization
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
        ai_merchant_name,
        ai_category_tag,
        pending,
        created_at
      `)
      .in('plaid_item_id', plaidItemIds)
      .order('date', { ascending: false })
      .limit(15);

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
      .eq('type', 'expense')
      .limit(10);

    // Sample 4: Income Sources (using tagged_income_sources table)
    const { data: incomeSources } = await supabase
      .from('tagged_income_sources')
      .select(`
        id,
        income_source_name,
        expected_amount,
        frequency,
        next_predicted_date,
        confidence_score,
        is_active
      `)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(10);

    // Sample 5: Spending Categories (last 30 days with AI categorization)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: spendingCategories } = await supabase
      .from('transactions')
      .select(`
        ai_category_tag,
        ai_merchant_name,
        amount,
        date
      `)
      .in('plaid_item_id', plaidItemIds)
      .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
      .not('ai_category_tag', 'is', null);

    // Sample 6: Merchant Analytics (top spending merchants)
    const { data: topMerchants } = await supabase
      .from('transactions')
      .select(`
        ai_merchant_name,
        amount,
        ai_category_tag,
        date
      `)
      .in('plaid_item_id', plaidItemIds)
      .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
      .not('ai_merchant_name', 'is', null)
      .limit(15);

    // Sample 7: Account Types Summary
    const { data: accountTypes } = await supabase
      .from('accounts')
      .select(`
        type,
        subtype
      `)
      .in('item_id', itemDbIds)
      .is('deleted_at', null);

    // Sample 8: Pending Transactions
    const { data: pendingTransactions } = await supabase
      .from('transactions')
      .select(`
        id,
        name,
        amount,
        merchant_name,
        date
      `)
      .in('plaid_item_id', plaidItemIds)
      .eq('pending', true)
      .order('date', { ascending: false })
      .limit(5);

    // Calculate derived metrics
    const totalBalance = accounts?.reduce((sum, acc) => {
      const balance = acc.available_balance ?? acc.current_balance ?? 0;
      return sum + balance;
    }, 0) || 0;

    const monthlySpending = spendingCategories?.reduce((sum, tx) => {
      return sum + Math.abs(tx.amount || 0);
    }, 0) || 0;

    const uniqueCategories = [...new Set(spendingCategories?.map(tx => tx.ai_category_tag).filter(Boolean))];
    const uniqueMerchants = [...new Set(topMerchants?.map(tx => tx.ai_merchant_name).filter(Boolean))];

    // Enhanced spending analysis with AI categorization
    const categorySpending = spendingCategories?.reduce((acc, tx) => {
      const cat = tx.ai_category_tag || 'Uncategorized';
      acc[cat] = (acc[cat] || 0) + Math.abs(tx.amount || 0);
      return acc;
    }, {} as Record<string, number>) || {};

    const topCategories = Object.entries(categorySpending)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 8)
      .map(([category, amount]) => ({ category, amount }));

    const merchantSpending = topMerchants?.reduce((acc, tx) => {
      const merchant = tx.ai_merchant_name || 'Unknown';
      acc[merchant] = (acc[merchant] || 0) + Math.abs(tx.amount || 0);
      return acc;
    }, {} as Record<string, number>) || {};

    const topMerchantsList = Object.entries(merchantSpending)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 8)
      .map(([merchant, amount]) => ({ merchant, amount }));

    // Enhanced suggested variables with real data
    const suggestedVariables = [
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
        example: topCategories.length > 0 ? `${topCategories[0].category}: $${topCategories[0].amount.toLocaleString()}` : 'None'
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
        example: `$${incomeSources?.reduce((sum, income) => sum + (income.expected_amount || 0), 0).toLocaleString() || 0}`
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
        example: `${pendingTransactions?.length || 0} pending`
      },
      {
        id: 'total-balance',
        name: 'Total Balance',
        description: 'Combined balance from all accounts',
        example: `$${totalBalance.toLocaleString()}`
      },
      {
        id: 'last-transaction-date',
        name: 'Last Transaction Date',
        description: 'Most recent transaction date',
        example: (recentTransactions && recentTransactions.length > 0) ? new Date(recentTransactions[0].date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'None'
      }
    ];

    const dataSample = {
      user: {
        id: user.id,
        email: user.email
      },
      accounts: {
        count: accounts?.length || 0,
        total_balance: totalBalance,
        types: accountTypes?.map(acc => ({ type: acc.type, subtype: acc.subtype })) || [],
        sample: accounts?.slice(0, 5) || []
      },
      transactions: {
        recent_count: recentTransactions?.length || 0,
        monthly_spending: monthlySpending,
        unique_categories: uniqueCategories.length,
        unique_merchants: uniqueMerchants.length,
        sample: recentTransactions?.slice(0, 8) || []
      },
      recurring_bills: {
        count: recurringBills?.length || 0,
        total_monthly: recurringBills?.reduce((sum, bill) => sum + (bill.expected_amount || 0), 0) || 0,
        sample: recurringBills?.slice(0, 5).map(bill => ({
          name: bill.merchant_name || 'Unknown',
          amount: bill.expected_amount || 0,
          frequency: bill.prediction_frequency || 'monthly',
          next_date: bill.next_predicted_date
        })) || []
      },
      income_sources: {
        count: incomeSources?.length || 0,
        total_monthly: incomeSources?.reduce((sum, income) => sum + (income.expected_amount || 0), 0) || 0,
        sample: incomeSources?.slice(0, 5).map(income => ({
          name: income.income_source_name || 'Unknown',
          amount: income.expected_amount || 0,
          frequency: income.frequency || 'monthly',
          next_date: income.next_predicted_date
        })) || []
      },
      spending_analysis: {
        top_categories: topCategories,
        top_merchants: topMerchantsList
      },
      pending_transactions: {
        count: pendingTransactions?.length || 0,
        sample: pendingTransactions || []
      },
      suggested_variables: suggestedVariables
    };

    return NextResponse.json(dataSample);

  } catch (error) {
    console.error('Error sampling SMS variables data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
