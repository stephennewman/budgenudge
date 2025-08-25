'use client';

import { useState, useEffect } from 'react';
import { createSupabaseClient } from '@/utils/supabase/client';

interface DataSample {
  user: {
    id: string;
    email: string;
  };
  accounts: {
    count: number;
    total_balance: number;
    types: Array<{ type: string; subtype: string }>;
    sample: Array<{
      name: string;
      institution_name: string | null;
      available_balance: number | null;
      current_balance: number | null;
    }>;
  };
  transactions: {
    recent_count: number;
    monthly_spending: number;
    unique_categories: number;
    unique_merchants: number;
    sample: Array<{
      name: string;
      amount: number;
      category: string | null;
      merchant_name: string | null;
      ai_merchant_name?: string | null;
      ai_category_tag?: string | null;
      date: string;
      pending: boolean;
    }>;
  };
  recurring_bills: {
    count: number;
    total_monthly: number;
    sample: Array<{
      name: string;
      amount: number;
      frequency: string;
      next_date?: string;
    }>;
  };
  income_sources: {
    count: number;
    total_monthly: number;
    sample: Array<{
      name: string;
      income_source_name: string;
      expected_amount: number;
      frequency: string;
      next_predicted_date?: string;
    }>;
  };
  spending_analysis: {
    top_categories: Array<{ category: string; amount: number }>;
    top_merchants: Array<{ merchant: string; amount: number }>;
  };
  pending_transactions: {
    count: number;
    sample: Array<{
      name: string;
      amount: number;
      merchant_name: string | null;
      date: string;
    }>;
  };
  suggested_variables: Array<{
    id: string;
    name: string;
    description: string;
    example: string;
  }>;
}

export default function DataSamplePage() {
  const [dataSample, setDataSample] = useState<DataSample | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create single Supabase client instance
  const supabase = createSupabaseClient();

  useEffect(() => {
    fetchDataSample();
  }, []);

  const fetchDataSample = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('Authentication error');
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
      console.log('🔍 User items details:', userItems);

      if (!userItems || userItems.length === 0) {
        console.log('❌ No Plaid items found for user');
        setDataSample({
          user: { id: user.id, email: user.email || '' },
          accounts: { count: 0, total_balance: 0, types: [], sample: [] },
          transactions: { recent_count: 0, monthly_spending: 0, unique_categories: 0, unique_merchants: 0, sample: [] },
          recurring_bills: { count: 0, total_monthly: 0, sample: [] },
          income_sources: { count: 0, total_monthly: 0, sample: [] },
          spending_analysis: { top_categories: [], top_merchants: [] },
          pending_transactions: { count: 0, sample: [] },
          suggested_variables: [
            {
              id: 'no-accounts',
              name: 'No Accounts Connected',
              description: 'You need to connect your bank accounts first',
              example: 'Please connect your bank accounts via Plaid to see financial data'
            }
          ]
        });
        return;
      }

      const itemDbIds = userItems.map(item => item.id); // Database IDs for accounts
      const plaidItemIds = userItems.map(item => item.plaid_item_id).filter(Boolean); // Plaid IDs for transactions

      console.log('🔍 Using database item IDs:', itemDbIds);
      console.log('🔍 Using Plaid item IDs:', plaidItemIds);
      console.log('🔍 User ID being used:', user.id);

      // Debug: Check transaction structure and relationships
      if (plaidItemIds.length > 0) {
        const { data: sampleTransactions, error: txError } = await supabase
          .from('transactions')
          .select('id, plaid_item_id, account_id, name, amount, date')
          .in('plaid_item_id', plaidItemIds)
          .limit(5);
        
        console.log('🔍 Sample transactions structure:', sampleTransactions);
        console.log('🔍 Transaction error:', txError);
        
        if (sampleTransactions && sampleTransactions.length > 0) {
          const uniqueAccountIds = [...new Set(sampleTransactions.map(tx => tx.account_id).filter(Boolean))];
          console.log('🔍 Unique account IDs from sample transactions:', uniqueAccountIds);
        }
      }

      // Debug: Check if accounts exist at all for this user
      const { data: allUserAccounts, error: accountsError } = await supabase
        .from('accounts')
        .select('*')
        .limit(5);
      
      console.log('🔍 All accounts in database:', allUserAccounts);
      console.log('🔍 Accounts error:', accountsError);

      // Sample 1: Account Information - Get accounts via transactions using plaid_item_id
      let accounts: Array<{
        id: string;
        name: string;
        type: string;
        subtype: string;
        available_balance: number | null;
        current_balance: number | null;
        mask: string | null;
        institution_name: string | null;
        created_at: string;
      }> = [];
      
      if (plaidItemIds.length > 0) {
        // Step 1: Get account IDs from transactions
        const { data: transactionAccounts } = await supabase
          .from('transactions')
          .select('account_id')
          .in('plaid_item_id', plaidItemIds)
          .not('account_id', 'is', null);
        
        if (transactionAccounts && transactionAccounts.length > 0) {
          const uniqueAccountIds = [...new Set(transactionAccounts.map(tx => tx.account_id).filter(Boolean))];
          console.log('🔍 Unique account IDs from transactions:', uniqueAccountIds);
          
          if (uniqueAccountIds.length > 0) {
            // Step 2: Get account details using the account IDs
            const { data: accountsData } = await supabase
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
              .in('id', uniqueAccountIds)
              .is('deleted_at', null);
            
            if (accountsData && accountsData.length > 0) {
              accounts = accountsData;
              console.log('🔍 Accounts found via transactions:', accounts.length);
              console.log('🔍 First account sample:', accounts[0]);
            }
          }
        }
      }
      
      // Fallback: Try direct accounts query if no accounts found via transactions
      if (!accounts || accounts.length === 0) {
        console.log('🔍 No accounts found via transactions, trying direct query');
        
        const { data: directAccounts } = await supabase
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
        
        if (directAccounts && directAccounts.length > 0) {
          accounts = directAccounts;
          console.log('🔍 Fallback: Direct accounts query found:', accounts.length);
        } else {
          console.log('🔍 No accounts found via any method');
        }
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
        console.log(`🔍 Account ${acc.name}: available_balance=${acc.available_balance}, current_balance=${acc.current_balance}, calculated=${balance}`);
        return sum + balance;
      }, 0) || 0;

      console.log('🔍 Total balance calculation:', {
        accountsCount: accounts?.length || 0,
        accountsData: accounts,
        totalBalance
      });

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
          email: user.email || ''
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
            income_source_name: income.income_source_name || 'Unknown',
            expected_amount: income.expected_amount || 0,
            frequency: income.frequency || 'monthly',
            next_predicted_date: income.next_predicted_date
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

      setDataSample(dataSample);

    } catch (err) {
      console.error('Error fetching data sample:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Sampling your financial data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-red-800 mb-2">Error Loading Data</h2>
            <p className="text-red-600">{error}</p>
            <button
              onClick={fetchDataSample}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!dataSample) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center">
            <p className="text-gray-600">No data available</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">📊 SMS Builder Data Sample</h1>
          <p className="text-gray-600">
            Real financial data available for SMS Builder variables - Updated in real-time
          </p>
        </div>

        {/* Current Variables Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">🔄 Current SMS Builder Variables</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-medium text-blue-900">Today&apos;s Date</h3>
              <p className="text-blue-700 text-sm">{new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="font-medium text-green-900">Account Count</h3>
              <p className="text-green-700 text-sm">{dataSample.accounts.count} accounts connected</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <h3 className="font-medium text-purple-900">Total Balance</h3>
              <p className="text-purple-700 text-sm">${dataSample.accounts.total_balance.toLocaleString()}</p>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <h3 className="font-medium text-orange-900">Last Transaction</h3>
              <p className="text-orange-700 text-sm">
                {dataSample.transactions.sample.length > 0 
                  ? new Date(dataSample.transactions.sample[0].date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })
                  : 'No transactions found'
                }
              </p>
            </div>
          </div>
        </div>

        {/* Suggested New Variables */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">🚀 Suggested New Variables</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dataSample.suggested_variables.map((variable) => (
              <div key={variable.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h3 className="font-medium text-gray-900 mb-2">{variable.name}</h3>
                <p className="text-gray-600 text-sm mb-3">{variable.description}</p>
                <div className="bg-white p-3 rounded border border-gray-200">
                  <p className="text-xs text-gray-500 mb-1">Example:</p>
                  <p className="text-sm font-mono text-gray-800">{variable.example}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Data Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Accounts Summary */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">🏦 Accounts Summary</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Accounts:</span>
                <span className="font-semibold">{dataSample.accounts.count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Balance:</span>
                <span className="font-semibold">${dataSample.accounts.total_balance.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Account Types:</span>
                <span className="font-semibold">{dataSample.accounts.types.length}</span>
              </div>
            </div>
            {dataSample.accounts.sample.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium text-gray-900 mb-2">Sample Accounts:</h4>
                <div className="space-y-2">
                  {dataSample.accounts.sample.map((account, index) => (
                    <div key={index} className="text-sm text-gray-600">
                      {account.name} - {account.institution_name || 'Unknown Institution'} (${(account.available_balance || account.current_balance || 0).toLocaleString()})
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Spending Summary */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">💳 Spending Summary</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Monthly Spending:</span>
                <span className="font-semibold">${dataSample.transactions.monthly_spending.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Unique Categories:</span>
                <span className="font-semibold">{dataSample.transactions.unique_categories}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Unique Merchants:</span>
                <span className="font-semibold">{dataSample.transactions.unique_merchants}</span>
              </div>
            </div>
            {dataSample.spending_analysis.top_categories.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium text-gray-900 mb-2">Top Spending Categories:</h4>
                <div className="space-y-1">
                  {dataSample.spending_analysis.top_categories.slice(0, 3).map((cat, index) => (
                    <div key={index} className="text-sm text-gray-600">
                      {cat.category}: ${cat.amount.toLocaleString()}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">📝 Recent Transactions</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Merchant</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">AI Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {dataSample.transactions.sample.map((transaction, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(transaction.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {transaction.ai_merchant_name || transaction.merchant_name || 'Unknown'}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                      transaction.amount < 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      ${Math.abs(transaction.amount).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {transaction.ai_category_tag || 'Uncategorized'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        transaction.pending 
                          ? 'bg-yellow-100 text-yellow-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {transaction.pending ? 'Pending' : 'Posted'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pending Transactions */}
        {dataSample.pending_transactions.count > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">⏳ Pending Transactions ({dataSample.pending_transactions.count})</h2>
            <div className="space-y-3">
              {dataSample.pending_transactions.sample.map((transaction, index) => (
                <div key={index} className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div>
                    <p className="font-medium text-gray-900">{transaction.merchant_name || 'Unknown Merchant'}</p>
                    <p className="text-sm text-gray-600">{new Date(transaction.date).toLocaleDateString()}</p>
                  </div>
                  <span className="text-lg font-semibold text-gray-900">${Math.abs(transaction.amount).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recurring Bills & Income */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">📅 Recurring Bills</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Bills:</span>
                <span className="font-semibold">{dataSample.recurring_bills.count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Monthly Total:</span>
                <span className="font-semibold">${dataSample.recurring_bills.total_monthly.toLocaleString()}</span>
              </div>
            </div>
            {dataSample.recurring_bills.sample.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium text-gray-900 mb-2">Sample Bills:</h4>
                <div className="space-y-2">
                  {dataSample.recurring_bills.sample.map((bill, index) => (
                    <div key={index} className="text-sm text-gray-600">
                      {bill.name}: ${bill.amount.toLocaleString()} ({bill.frequency})
                      {bill.next_date && (
                        <span className="text-xs text-gray-500 ml-2">
                          Next: {new Date(bill.next_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">💰 Income Sources</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Sources:</span>
                <span className="font-semibold">{dataSample.income_sources.count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Monthly Total:</span>
                <span className="font-semibold">${dataSample.income_sources.total_monthly.toLocaleString()}</span>
              </div>
            </div>
            {dataSample.income_sources.sample.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium text-gray-900 mb-2">Sample Sources:</h4>
                <div className="space-y-2">
                  {dataSample.income_sources.sample.map((income, index) => (
                    <div key={index} className="text-sm text-gray-600">
                      {income.name}: ${income.expected_amount.toLocaleString()} ({income.frequency})
                      {income.next_predicted_date && (
                        <span className="text-xs text-gray-500 ml-2">
                          Next: {new Date(income.next_predicted_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Top Merchants */}
        {dataSample.spending_analysis.top_merchants.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mt-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">🏪 Top Spending Merchants</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {dataSample.spending_analysis.top_merchants.slice(0, 8).map((merchant, index) => (
                <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h3 className="font-medium text-gray-900 mb-2">{merchant.merchant}</h3>
                  <p className="text-2xl font-bold text-blue-600">${merchant.amount.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-8 text-center">
          <button
            onClick={fetchDataSample}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 mr-4"
          >
            🔄 Refresh Data
          </button>
          <a
            href="/protected/simple-builder"
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 inline-block"
          >
            🚀 Go to SMS Builder
          </a>
        </div>
      </div>
    </div>
  );
}
