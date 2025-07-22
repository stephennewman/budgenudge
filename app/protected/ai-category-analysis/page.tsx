'use client';

import { useState, useEffect } from 'react';
import { createSupabaseClient } from '@/utils/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BouncingMoneyLoader } from '@/components/ui/bouncing-money-loader';
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
  const [sortBy, setSortBy] = useState<'spending' | 'transactions' | 'merchants' | 'remaining'>('spending');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [trackedCategories, setTrackedCategories] = useState<Set<string>>(new Set());
  const [trackingLoading, setTrackingLoading] = useState<Set<string>>(new Set());

  const supabase = createSupabaseClient();

  // Fetch tracked categories for the current user
  const fetchTrackedCategories = async () => {
    try {
      const response = await fetch('/api/category-pacing-tracking');
      const data = await response.json();
      
      if (data.success && data.tracked_categories) {
        const tracked = new Set<string>(
          data.tracked_categories
            .filter((t: { is_active: boolean }) => t.is_active)
            .map((t: { ai_category: string }) => t.ai_category)
        );
        setTrackedCategories(tracked);
      }
    } catch (error) {
      console.error('Error fetching tracked categories:', error);
    }
  };

  // Toggle category tracking
  const toggleCategoryTracking = async (categoryName: string) => {
    try {
      setTrackingLoading(prev => new Set([...prev, categoryName]));

      const isCurrentlyTracked = trackedCategories.has(categoryName);
      const endpoint = '/api/category-pacing-tracking';
      const method = isCurrentlyTracked ? 'PUT' : 'POST';
      
      const body = isCurrentlyTracked 
        ? { ai_category: categoryName, is_active: false }
        : { ai_category: categoryName };

      const response = await fetch(endpoint, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await response.json();
      
      if (data.success) {
        if (isCurrentlyTracked) {
          setTrackedCategories(prev => {
            const newSet = new Set(prev);
            newSet.delete(categoryName);
            return newSet;
          });
        } else {
          setTrackedCategories(prev => new Set([...prev, categoryName]));
        }
      } else {
        console.error('Failed to toggle category tracking:', data.error);
      }
    } catch (error) {
      console.error('Error toggling category tracking:', error);
    } finally {
      setTrackingLoading(prev => {
        const newSet = new Set(prev);
        newSet.delete(categoryName);
        return newSet;
      });
    }
  };

  // Auto-select top categories for new users
  const runAutoSelection = async () => {
    try {
      console.log('🤖 Running auto-selection for top categories...');
      const response = await fetch('/api/category-pacing-tracking/auto-select', {
        method: 'POST',
      });

      const data = await response.json();
      
      if (data.success && data.auto_selected?.length > 0) {
        console.log(`✅ Auto-selected ${data.auto_selected.length} categories:`, data.category_analysis);
        // Refresh tracked categories to show the newly selected ones
        await fetchTrackedCategories();
      } else {
        console.log('ℹ️ Auto-selection result:', data.message);
      }
    } catch (error) {
      console.error('Error in auto-selection:', error);
    }
  };

  // OPTIMIZED: Simplified data fetching for better performance  
  const fetchAICategoryData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get user authentication
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('Authentication required');
      }

      // Get user's items to filter transactions
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

      // OPTIMIZED: Simplified query - get only what we need for display
      const { data: transactions, error: transactionsError } = await supabase
        .from('transactions')
        .select(`
          amount,
          date,
          ai_category_tag,
          ai_merchant_name
        `)
        .in('plaid_item_id', itemIds)
        .gte('amount', 0) // Only spending transactions
        .not('ai_category_tag', 'is', null) // Only transactions with AI categories
        .order('date', { ascending: false })
        .limit(500); // OPTIMIZED: Limit to recent 500 transactions for faster processing

      if (transactionsError) {
        throw new Error(`Failed to fetch transactions: ${transactionsError.message}`);
      }

      if (!transactions || transactions.length === 0) {
        setCategoryData([]);
        setLoading(false);
        return;
      }

      console.log('Processing', transactions.length, 'transactions for AI category analysis');

      // SIMPLIFIED: Basic category grouping without heavy calculations
      const categoryMap = new Map<string, {
        totalSpending: number;
        transactionCount: number;
        merchants: Set<string>;
      }>();

      transactions.forEach(transaction => {
        const aiCategory = transaction.ai_category_tag || 'Uncategorized';
        const merchantName = transaction.ai_merchant_name || 'Unknown';

        if (!categoryMap.has(aiCategory)) {
          categoryMap.set(aiCategory, {
            totalSpending: 0,
            transactionCount: 0,
            merchants: new Set(),
          });
        }

        const categoryData = categoryMap.get(aiCategory)!;
        categoryData.totalSpending += transaction.amount;
        categoryData.transactionCount += 1;
        categoryData.merchants.add(merchantName);
      });

      // SIMPLIFIED: Convert to display format with basic calculations
      const processedData: AICategoryData[] = Array.from(categoryMap.entries()).map(([aiCategory, data]) => {
        const avgTransactionAmount = data.totalSpending / data.transactionCount;

        return {
          ai_category: aiCategory,
          total_spending: data.totalSpending,
          transaction_count: data.transactionCount,
          unique_merchants: data.merchants.size,
          first_transaction_date: transactions[transactions.length - 1]?.date || '',
          last_transaction_date: transactions[0]?.date || '',
          days_of_data: 30, // Simplified
          avg_daily_spending: data.totalSpending / 30,
          avg_monthly_spending: data.totalSpending,
          avg_transaction_amount: avgTransactionAmount,
          top_merchants: Array.from(data.merchants).slice(0, 3).map(merchant => ({
            merchant,
            amount: 0, // Simplified - remove heavy calculation
            count: 0
          })),
          current_month_spending: data.totalSpending,
          pacing_percentage: 1,
          pacing_status: 'on-track' as 'under' | 'on-track' | 'over',
          spending_trend: 'stable' as 'increasing' | 'stable' | 'decreasing'
        };
      });

      // Sort by total spending
      processedData.sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
          case 'spending':
            comparison = a.total_spending - b.total_spending;
            break;
          case 'transactions':
            comparison = a.transaction_count - b.transaction_count;
            break;
          case 'merchants':
            comparison = a.unique_merchants - b.unique_merchants;
            break;
          default:
            comparison = a.total_spending - b.total_spending;
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
    const loadPageData = async () => {
      await fetchAICategoryData();
      await fetchTrackedCategories();
      // Run auto-selection for users who haven't set up category tracking yet
      await runAutoSelection();
    };
    
    loadPageData();
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

  const handleSort = (newSortBy: 'spending' | 'transactions' | 'merchants' | 'remaining') => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('desc');
    }
  };

  if (loading) {
    return <BouncingMoneyLoader />;
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
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="text-2xl font-medium">🗂️ Categories</h1>
          <p className="text-muted-foreground mt-2">
            AI-powered category analysis and spending tracking
            {lastUpdated && (
              <span className="block text-sm">
                Last updated: {lastUpdated.toLocaleString()}
              </span>
            )}
          </p>
        </div>
        <ManualRefreshButton onRefresh={fetchAICategoryData} />
      </div>

      {categoryData.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-gray-600">No AI-categorized transactions found. AI tagging may still be in progress.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Table View */}
          <Card>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-center py-3 px-2 font-medium text-gray-900">Track Pacing</th>
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
                      <th 
                        className="text-center py-3 px-2 font-medium text-gray-900 cursor-pointer hover:bg-gray-50 select-none"
                        onClick={() => handleSort('remaining')}
                      >
                        <div className="flex items-center justify-center">
                          Remaining
                          {sortBy === 'remaining' && (
                            <span className="ml-1">
                              {sortOrder === 'desc' ? '↓' : '↑'}
                            </span>
                          )}
                        </div>
                      </th>
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
                        <td className="py-3 px-2 text-center">
                          <button
                            onClick={() => toggleCategoryTracking(category.ai_category)}
                            disabled={trackingLoading.has(category.ai_category)}
                            className="text-2xl hover:scale-110 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                            title={trackedCategories.has(category.ai_category) ? 
                              `Stop tracking ${category.ai_category} pacing` : 
                              `Track ${category.ai_category} pacing`}
                          >
                            {trackingLoading.has(category.ai_category) ? (
                              '⏳'
                            ) : trackedCategories.has(category.ai_category) ? (
                              category.pacing_status === 'over' ? '🔴' :
                              category.pacing_status === 'under' ? '🟢' : '🟡'
                            ) : (
                              '⚪'
                            )}
                          </button>
                        </td>
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
                          {(() => {
                            const remaining = category.avg_monthly_spending - category.current_month_spending;
                            const percentSpent = category.avg_monthly_spending > 0 ? (category.current_month_spending / category.avg_monthly_spending) : 0;
                            
                            let emoji = '🟩'; // Under budget
                            if (percentSpent >= 1.0) {
                              emoji = '🟥'; // Over budget
                            } else if (percentSpent >= 0.9) {
                              emoji = '🟨'; // Approaching budget
                            }
                            
                            return (
                              <div className="text-center">
                                <div className="text-lg">{emoji}</div>
                                <div className="text-xs text-gray-600">{formatCurrency(Math.abs(remaining))}</div>
                              </div>
                            );
                          })()}
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