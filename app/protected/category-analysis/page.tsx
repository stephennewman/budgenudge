'use client';

import { useState, useEffect } from 'react';
import { createSupabaseClient } from '@/utils/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import ManualRefreshButton from '@/components/manual-refresh-button';

interface CategorySpendingData {
  category: string;
  total_spending: number;
  transaction_count: number;
  first_transaction_date: string;
  last_transaction_date: string;
  days_of_data: number;
  avg_daily_spending: number;
  avg_monthly_spending: number;
  avg_transaction_amount: number;
  merchants: string[];
  current_month_spending: number;
  pacing_percentage: number;
  pacing_status: 'under' | 'on-track' | 'over';
}

export default function CategoryAnalysisPage() {
  const [categoryData, setCategoryData] = useState<CategorySpendingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const supabase = createSupabaseClient();

  const fetchCategoryData = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Get ALL transactions to determine the user's true data period
      const { data: allTx, error: allTxError } = await supabase
        .from('transactions')
        .select('date')
        .order('date', { ascending: false });
      if (allTxError) throw new Error(`Failed to fetch all transactions: ${allTxError.message}`);
      if (!allTx || allTx.length === 0) {
        setCategoryData([]);
        setLoading(false);
        return;
      }
      const allDates = allTx.map(t => t.date).sort();
      // Use the user's true first and last transaction date for all subcategories
      const globalFirstDateStr = allDates[0];  // oldest (first element after sort)
      const globalLastDateStr = allDates[allDates.length - 1];  // newest (last element after sort)
      const globalFirstDate = new Date(globalFirstDateStr);
      const globalLastDate = new Date(globalLastDateStr);
      const daysOfData = Math.max(1, Math.ceil((globalLastDate.getTime() - globalFirstDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);

      // 2. Get user's spending transactions with subcategory data
      const { data: transactions, error: transactionsError } = await supabase
        .from('transactions')
        .select(`
          amount,
          date,
          subcategory,
          plaid_item_id,
          merchant_name
        `)
        .gte('amount', 0) // Only spending transactions (positive amounts)
        .order('date', { ascending: false });

      if (transactionsError) {
        throw new Error(`Failed to fetch transactions: ${transactionsError.message}`);
      }

      if (!transactions || transactions.length === 0) {
        setCategoryData([]);
        setLoading(false);
        return;
      }

      // Process transactions to calculate subcategory spending
      const categoryMap = new Map<string, {
        totalSpending: number;
        transactionCount: number;
        amounts: number[];
        firstTransactionDate: string;
        lastTransactionDate: string;
        merchants: Set<string>; // Add merchants set
      }>();

      transactions.forEach(transaction => {
        // Handle subcategory - use subcategory or 'Other' if none
        const subcategory = transaction.subcategory || 'Other';
        if (!categoryMap.has(subcategory)) {
          categoryMap.set(subcategory, {
            totalSpending: 0,
            transactionCount: 0,
            amounts: [],
            firstTransactionDate: transaction.date,
            lastTransactionDate: transaction.date,
            merchants: new Set(), // Initialize merchants set
          });
        }
        const categoryData = categoryMap.get(subcategory)!;
        categoryData.totalSpending += transaction.amount;
        categoryData.transactionCount += 1;
        categoryData.amounts.push(transaction.amount);
        // Add merchant name to the set
        if (transaction.merchant_name) {
          categoryData.merchants.add(transaction.merchant_name);
        }
        // Update first/last transaction date for this subcategory
        if (transaction.date < categoryData.firstTransactionDate) categoryData.firstTransactionDate = transaction.date;
        if (transaction.date > categoryData.lastTransactionDate) categoryData.lastTransactionDate = transaction.date;
      });

      // Convert to array and calculate averages
      const processedData: CategorySpendingData[] = Array.from(categoryMap.entries()).map(([subcategory, data]) => {
        const avgDailySpending = data.totalSpending / daysOfData;
        const avgMonthlySpending = avgDailySpending * 30; // Approximate month
        const avgTransactionAmount = data.totalSpending / data.transactionCount;
        
        // Calculate current month spending for this subcategory
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const currentMonthStart = new Date(currentYear, currentMonth, 1);
        const currentMonthEnd = new Date(currentYear, currentMonth + 1, 0);
        
        const currentMonthTransactions = transactions.filter(t => {
          const txDate = new Date(t.date);
          return txDate >= currentMonthStart && txDate <= currentMonthEnd && (t.subcategory || 'Other') === subcategory;
        });
        
        const currentMonthSpending = currentMonthTransactions.reduce((sum, tx) => sum + tx.amount, 0);
        
        // Calculate pacing
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const dayOfMonth = now.getDate();
        const monthProgress = dayOfMonth / daysInMonth; // e.g., 17/31 = 0.548
        
        const expectedSpendingAtThisPoint = avgMonthlySpending * monthProgress;
        const pacingPercentage = currentMonthSpending / expectedSpendingAtThisPoint;
        
        // Determine pacing status
        let pacingStatus: 'under' | 'on-track' | 'over';
        if (pacingPercentage < 0.9) {
          pacingStatus = 'under';
        } else if (pacingPercentage > 1.1) {
          pacingStatus = 'over';
        } else {
          pacingStatus = 'on-track';
        }
        
        return {
          category: subcategory,
          total_spending: data.totalSpending,
          transaction_count: data.transactionCount,
          first_transaction_date: globalFirstDateStr,
          last_transaction_date: globalLastDateStr,
          days_of_data: daysOfData,
          avg_daily_spending: avgDailySpending,
          avg_monthly_spending: avgMonthlySpending,
          avg_transaction_amount: avgTransactionAmount,
          merchants: Array.from(data.merchants).sort(),
          current_month_spending: currentMonthSpending,
          pacing_percentage: pacingPercentage,
          pacing_status: pacingStatus
        };
      });

      // Sort by average monthly spending (highest to lowest)
      processedData.sort((a, b) => b.avg_monthly_spending - a.avg_monthly_spending);

      setCategoryData(processedData);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching category data:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategoryData();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getCategoryIcon = (subcategory: string) => {
    const icons: { [key: string]: string } = {
      'Food and Drink': '🍽️',
      'Restaurants': '🍽️',
      'Groceries': '🛒',
      'Shopping': '🛍️',
      'Transportation': '🚗',
      'Gas': '⛽',
      'Entertainment': '🎬',
      'Travel': '✈️',
      'Healthcare': '🏥',
      'Utilities': '💡',
      'Rent': '🏠',
      'Mortgage': '🏠',
      'Insurance': '🛡️',
      'Education': '📚',
      'Personal Care': '💄',
      'Fitness': '💪',
      'Pets': '🐕',
      'Gifts': '🎁',
      'Charity': '❤️',
      'Other': '📊'
    };
    return icons[subcategory] || '💰';
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading subcategory analysis...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-w-md mx-auto">
            <p className="text-red-700">Error: {error}</p>
            <Button onClick={fetchCategoryData} className="mt-2">
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">📊 Subcategory Spending Analysis</h1>
          <p className="text-gray-600">
            Historical spending by subcategory, ranked by average monthly spend
          </p>
        </div>
        <ManualRefreshButton onRefresh={fetchCategoryData} />
      </div>

      {lastUpdated && (
        <div className="text-sm text-gray-500 mb-6">
          Last updated: {lastUpdated.toLocaleString()}
        </div>
      )}

      {categoryData.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-gray-600">No spending data found. Connect your bank account to see subcategory analysis.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {categoryData.map((category, index) => (
            <Card key={category.category} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{getCategoryIcon(category.category)}</span>
                    <div>
                      <CardTitle className="text-xl">{category.category}</CardTitle>
                      <p className="text-sm text-gray-500">
                        #{index + 1} in monthly spending
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-600">
                      {formatCurrency(category.avg_monthly_spending)}
                    </div>
                    <div className="text-sm text-gray-500">avg/month</div>
                  </div>
                </div>
                
                {/* Pacing Analysis */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-gray-900">This Month</div>
                      <div className="text-lg font-bold text-gray-900">
                        {formatCurrency(category.current_month_spending)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full ${
                          category.pacing_status === 'under' ? 'bg-green-500' :
                          category.pacing_status === 'on-track' ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}></div>
                        <div className="text-sm">
                          <div className="font-medium text-gray-900">
                            {category.pacing_status === 'under' ? 'Under Pace' :
                             category.pacing_status === 'on-track' ? 'On Track' :
                             'Over Pace'}
                          </div>
                          <div className="text-gray-500">
                            {Math.round(category.pacing_percentage * 100)}% of expected
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="font-medium text-gray-900">Total Spent</div>
                    <div className="text-gray-600">{formatCurrency(category.total_spending)}</div>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">Transactions</div>
                    <div className="text-gray-600">{category.transaction_count}</div>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">Avg Transaction</div>
                    <div className="text-gray-600">{formatCurrency(category.avg_transaction_amount)}</div>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">Data Period</div>
                    <div className="text-gray-600">{category.days_of_data} days</div>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="font-medium text-gray-900">Daily Average</div>
                      <div className="text-gray-600">{formatCurrency(category.avg_daily_spending)}</div>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">Date Range</div>
                      <div className="text-gray-600">
                        {formatDate(category.first_transaction_date)} - {formatDate(category.last_transaction_date)}
                      </div>
                    </div>
                  </div>
                </div>

                {category.merchants.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Merchants</h4>
                    <div className="flex flex-wrap gap-2">
                      {category.merchants.map((merchant, merchantIndex) => (
                        <span key={merchantIndex} className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                          {merchant}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-8 text-center text-sm text-gray-500">
        <p>
          💡 <strong>How it works:</strong> We calculate your average monthly spending by adding up all transactions 
          for each subcategory, then dividing by the number of days of data and multiplying by 30.
        </p>
        <p className="mt-2">
          Example: $900 spent on restaurants over 90 days = $10/day = $300/month average
        </p>
      </div>
    </div>
  );
} 