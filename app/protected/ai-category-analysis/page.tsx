'use client';

import { useState, useEffect } from 'react';
import { createSupabaseClient } from '@/utils/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import ManualRefreshButton from '@/components/manual-refresh-button';

interface AICategoryData {
  ai_category: string;
  total_spending: number;
  transaction_count: number;
  unique_merchants: number;
  first_transaction_date: string;
  last_transaction_date: string;
  days_of_data: number;
  avg_daily_spending: number;
  avg_monthly_spending: number;
  avg_transaction_amount: number;
  top_merchants: Array<{ merchant: string; amount: number; count: number }>;
  current_month_spending: number;
  pacing_percentage: number;
  pacing_status: 'under' | 'on-track' | 'over';
  spending_trend: 'increasing' | 'stable' | 'decreasing';
}

export default function AICategoryAnalysisPage() {
  const [categoryData, setCategoryData] = useState<AICategoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [sortBy, setSortBy] = useState<'spending' | 'transactions' | 'merchants'>('spending');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const supabase = createSupabaseClient();

  const fetchAICategoryData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get user's items to filter transactions
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('Authentication required');
      }

      const { data: items } = await supabase
        .from('items')
        .select('plaid_item_id')
        .eq('user_id', user.id);

      const itemIds = items?.map(item => item.plaid_item_id) || [];
      if (itemIds.length === 0) {
        setCategoryData([]);
        setLoading(false);
        return;
      }

      // Get all spending transactions with AI categories
      const { data: transactions, error: transactionsError } = await supabase
        .from('transactions')
        .select(`
          amount,
          date,
          ai_category_tag,
          ai_merchant_name,
          merchant_name,
          name
        `)
        .in('plaid_item_id', itemIds)
        .gte('amount', 0) // Only spending transactions
        .not('ai_category_tag', 'is', null) // Only transactions with AI categories
        .order('date', { ascending: false });

      if (transactionsError) {
        throw new Error(`Failed to fetch transactions: ${transactionsError.message}`);
      }

      if (!transactions || transactions.length === 0) {
        setCategoryData([]);
        setLoading(false);
        return;
      }

      // Calculate global date range
      const allDates = transactions.map(t => t.date).sort();
      const globalFirstDate = new Date(allDates[0] + 'T12:00:00');
      const globalLastDate = new Date(allDates[allDates.length - 1] + 'T12:00:00');
      const daysOfData = Math.max(1, Math.ceil((globalLastDate.getTime() - globalFirstDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);

      // Process transactions by AI category
      const categoryMap = new Map<string, {
        totalSpending: number;
        transactionCount: number;
        amounts: number[];
        merchants: Map<string, { amount: number; count: number }>;
        monthlySpending: Map<string, number>; // For trend analysis
      }>();

      transactions.forEach(transaction => {
        const aiCategory = transaction.ai_category_tag || 'Uncategorized';
        const merchantName = transaction.ai_merchant_name || transaction.merchant_name || 'Unknown';
        // Fix timezone parsing - add noon time to avoid timezone edge cases
        const dateStr = transaction.date;
        const txDate = new Date(dateStr + 'T12:00:00');
        const monthKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;

        if (!categoryMap.has(aiCategory)) {
          categoryMap.set(aiCategory, {
            totalSpending: 0,
            transactionCount: 0,
            amounts: [],
            merchants: new Map(),
            monthlySpending: new Map(),
          });
        }

        const categoryData = categoryMap.get(aiCategory)!;
        categoryData.totalSpending += transaction.amount;
        categoryData.transactionCount += 1;
        categoryData.amounts.push(transaction.amount);

        // Track merchant spending
        if (!categoryData.merchants.has(merchantName)) {
          categoryData.merchants.set(merchantName, { amount: 0, count: 0 });
        }
        const merchantData = categoryData.merchants.get(merchantName)!;
        merchantData.amount += transaction.amount;
        merchantData.count += 1;

        // Track monthly spending for trends
        if (!categoryData.monthlySpending.has(monthKey)) {
          categoryData.monthlySpending.set(monthKey, 0);
        }
        categoryData.monthlySpending.set(monthKey, categoryData.monthlySpending.get(monthKey)! + transaction.amount);
      });

      // Convert to array and calculate metrics
      const processedData: AICategoryData[] = Array.from(categoryMap.entries()).map(([aiCategory, data]) => {
        const avgDailySpending = data.totalSpending / daysOfData;
        const avgMonthlySpending = avgDailySpending * 30;
        const avgTransactionAmount = data.totalSpending / data.transactionCount;

        // Get top merchants (top 5)
        const topMerchants = Array.from(data.merchants.entries())
          .sort((a, b) => b[1].amount - a[1].amount)
          .slice(0, 5)
          .map(([merchant, data]) => ({
            merchant,
            amount: data.amount,
            count: data.count
          }));

        // Calculate current month spending
        const now = new Date();
        const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const currentMonthSpending = data.monthlySpending.get(currentMonthKey) || 0;

        // Calculate pacing
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const dayOfMonth = now.getDate();
        const monthProgress = dayOfMonth / daysInMonth;
        const expectedSpendingAtThisPoint = avgMonthlySpending * monthProgress;
        const pacingPercentage = expectedSpendingAtThisPoint > 0 ? currentMonthSpending / expectedSpendingAtThisPoint : 0;

        let pacingStatus: 'under' | 'on-track' | 'over';
        if (pacingPercentage < 0.9) {
          pacingStatus = 'under';
        } else if (pacingPercentage > 1.1) {
          pacingStatus = 'over';
        } else {
          pacingStatus = 'on-track';
        }

        // Calculate spending trend (last 3 months)
        const monthlyAmounts = Array.from(data.monthlySpending.values()).slice(-3);
        let spendingTrend: 'increasing' | 'stable' | 'decreasing' = 'stable';
        if (monthlyAmounts.length >= 2) {
          const recent = monthlyAmounts[monthlyAmounts.length - 1];
          const previous = monthlyAmounts[monthlyAmounts.length - 2];
          const change = recent - previous;
          const changePercent = Math.abs(change) / previous;
          
          if (changePercent > 0.1) { // More than 10% change
            spendingTrend = change > 0 ? 'increasing' : 'decreasing';
          }
        }

        return {
          ai_category: aiCategory,
          total_spending: data.totalSpending,
          transaction_count: data.transactionCount,
          unique_merchants: data.merchants.size,
          first_transaction_date: allDates[0],
          last_transaction_date: allDates[allDates.length - 1],
          days_of_data: daysOfData,
          avg_daily_spending: avgDailySpending,
          avg_monthly_spending: avgMonthlySpending,
          avg_transaction_amount: avgTransactionAmount,
          top_merchants: topMerchants,
          current_month_spending: currentMonthSpending,
          pacing_percentage: pacingPercentage,
          pacing_status: pacingStatus,
          spending_trend: spendingTrend
        };
      });

      // Sort data
      processedData.sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
          case 'spending':
            comparison = a.avg_monthly_spending - b.avg_monthly_spending;
            break;
          case 'transactions':
            comparison = a.transaction_count - b.transaction_count;
            break;
          case 'merchants':
            comparison = a.unique_merchants - b.unique_merchants;
            break;
        }
        return sortOrder === 'desc' ? -comparison : comparison;
      });

      setCategoryData(processedData);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching AI category data:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAICategoryData();
  }, [sortBy, sortOrder]); // eslint-disable-line react-hooks/exhaustive-deps

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getCategoryIcon = (category: string) => {
    const icons: { [key: string]: string } = {
      'Restaurant': '🍽️',
      'Groceries': '🛒',
      'Gas': '⛽',
      'Shopping': '🛍️',
      'Subscription': '📱',
      'Utilities': '💡',
      'Healthcare': '🏥',
      'Entertainment': '🎬',
      'Transfer': '💸',
      'Income': '💰',
      'Other': '📊',
      'Uncategorized': '❓'
    };
    return icons[category] || '💼';
  };

  const getPacingColor = (status: string) => {
    switch (status) {
      case 'under': return 'text-green-600 bg-green-50';
      case 'over': return 'text-red-600 bg-red-50';
      default: return 'text-yellow-600 bg-yellow-50';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing': return '📈';
      case 'decreasing': return '📉';
      default: return '➡️';
    }
  };

  const handleSort = (newSortBy: 'spending' | 'transactions' | 'merchants') => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('desc');
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading AI category analysis...</p>
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
            <Button onClick={fetchAICategoryData} className="mt-2">
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">🤖 AI Category Analysis</h1>
          <p className="text-gray-600">
            Spending analysis powered by AI-generated categories and merchant normalization
          </p>
        </div>
        <ManualRefreshButton onRefresh={fetchAICategoryData} />
      </div>

      {lastUpdated && (
        <div className="text-sm text-gray-500 mb-6">
          Last updated: {lastUpdated.toLocaleString()}
        </div>
      )}

      {categoryData.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-gray-600">No AI-categorized transactions found. AI tagging may still be in progress.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-blue-600">
                  {categoryData.length}
                </div>
                <div className="text-sm text-gray-600">AI Categories</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(categoryData.reduce((sum, cat) => sum + cat.total_spending, 0))}
                </div>
                <div className="text-sm text-gray-600">Total Spending</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-purple-600">
                  {categoryData.reduce((sum, cat) => sum + cat.transaction_count, 0)}
                </div>
                <div className="text-sm text-gray-600">Transactions</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-orange-600">
                  {categoryData.reduce((sum, cat) => sum + cat.unique_merchants, 0)}
                </div>
                <div className="text-sm text-gray-600">Unique Merchants</div>
              </CardContent>
            </Card>
          </div>

          {/* Table View */}
          <Card>
            <CardHeader>
              <CardTitle>📊 Category Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-2 font-medium text-gray-900">Category</th>
                      <th 
                        className="text-right py-3 px-2 font-medium text-gray-900 cursor-pointer hover:bg-gray-50 select-none"
                        onClick={() => handleSort('spending')}
                      >
                        <div className="flex items-center justify-end">
                          Monthly Avg
                          {sortBy === 'spending' && (
                            <span className="ml-1">
                              {sortOrder === 'desc' ? '↓' : '↑'}
                            </span>
                          )}
                        </div>
                      </th>
                      <th className="text-right py-3 px-2 font-medium text-gray-900">This Month</th>
                      <th className="text-center py-3 px-2 font-medium text-gray-900">Pacing</th>
                      <th className="text-center py-3 px-2 font-medium text-gray-900">Trend</th>
                      <th 
                        className="text-right py-3 px-2 font-medium text-gray-900 cursor-pointer hover:bg-gray-50 select-none"
                        onClick={() => handleSort('transactions')}
                      >
                        <div className="flex items-center justify-end">
                          Transactions
                          {sortBy === 'transactions' && (
                            <span className="ml-1">
                              {sortOrder === 'desc' ? '↓' : '↑'}
                            </span>
                          )}
                        </div>
                      </th>
                      <th 
                        className="text-right py-3 px-2 font-medium text-gray-900 cursor-pointer hover:bg-gray-50 select-none"
                        onClick={() => handleSort('merchants')}
                      >
                        <div className="flex items-center justify-end">
                          Merchants
                          {sortBy === 'merchants' && (
                            <span className="ml-1">
                              {sortOrder === 'desc' ? '↓' : '↑'}
                            </span>
                          )}
                        </div>
                      </th>
                      <th className="text-right py-3 px-2 font-medium text-gray-900">Avg/Transaction</th>
                      <th className="text-left py-3 px-2 font-medium text-gray-900">Top Merchants</th>
                    </tr>
                  </thead>
                  <tbody>
                                         {categoryData.map((category) => (
                      <tr key={category.ai_category} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-2">
                          <div className="flex items-center space-x-2">
                            <span className="text-lg">{getCategoryIcon(category.ai_category)}</span>
                            <span className="font-medium text-gray-900">{category.ai_category}</span>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-right font-bold text-blue-600">
                          {formatCurrency(category.avg_monthly_spending)}
                        </td>
                        <td className="py-3 px-2 text-right">
                          {formatCurrency(category.current_month_spending)}
                        </td>
                        <td className="py-3 px-2 text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPacingColor(category.pacing_status)}`}>
                            {category.pacing_status === 'under' && '🟢'}
                            {category.pacing_status === 'on-track' && '🟡'}
                            {category.pacing_status === 'over' && '🔴'}
                            {Math.round(category.pacing_percentage * 100)}%
                          </span>
                        </td>
                        <td className="py-3 px-2 text-center">
                          <span className="text-lg">{getTrendIcon(category.spending_trend)}</span>
                        </td>
                        <td className="py-3 px-2 text-right text-gray-600">
                          {category.transaction_count}
                        </td>
                        <td className="py-3 px-2 text-right text-gray-600">
                          {category.unique_merchants}
                        </td>
                        <td className="py-3 px-2 text-right text-gray-600">
                          {formatCurrency(category.avg_transaction_amount)}
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex flex-wrap gap-1">
                            {category.top_merchants.slice(0, 3).map((merchant, i) => (
                              <span key={i} className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded">
                                {merchant.merchant} ({merchant.count})
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Legend */}
          <Card>
            <CardContent className="p-4">
              <h4 className="font-medium text-gray-900 mb-2">🔍 Understanding Your Data</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                <div>
                  <p><strong>Pacing:</strong> How your current month spending compares to your historical average</p>
                  <p><strong>🟢 Under:</strong> Spending less than 90% of expected</p>
                  <p><strong>🟡 On Track:</strong> Spending 90-110% of expected</p>
                  <p><strong>🔴 Over:</strong> Spending more than 110% of expected</p>
                </div>
                <div>
                  <p><strong>Trends:</strong> Based on last 3 months of data</p>
                  <p><strong>📈 Increasing:</strong> Spending has grown by 10%+</p>
                  <p><strong>📉 Decreasing:</strong> Spending has dropped by 10%+</p>
                  <p><strong>➡️ Stable:</strong> Spending change is less than 10%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
} 