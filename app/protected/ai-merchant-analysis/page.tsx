'use client';

import { useState, useEffect } from 'react';
import { createSupabaseClient } from '@/utils/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BouncingMoneyLoader } from '@/components/ui/bouncing-money-loader';
import ManualRefreshButton from '@/components/manual-refresh-button';

interface AIMerchantData {
  ai_merchant: string;
  total_spending: number;
  transaction_count: number;
  unique_categories: number;
  first_transaction_date: string;
  last_transaction_date: string;
  days_of_data: number;
  avg_daily_spending: number;
  avg_monthly_spending: number;
  avg_transaction_amount: number;
  frequency_days: number; // Average days between transactions
  categories: Array<{ category: string; amount: number; count: number }>;
  current_month_spending: number;
  pacing_percentage: number;
  pacing_status: 'under' | 'on-track' | 'over';
  spending_trend: 'increasing' | 'stable' | 'decreasing';
  merchant_type: 'frequent' | 'occasional' | 'rare'; // Based on transaction frequency
}

export default function AIMerchantAnalysisPage() {
  const [merchantData, setMerchantData] = useState<AIMerchantData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [sortBy, setSortBy] = useState<'spending' | 'transactions' | 'frequency' | 'remaining'>('spending');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [trackedMerchants, setTrackedMerchants] = useState<Set<string>>(new Set());
  const [trackingLoading, setTrackingLoading] = useState<Set<string>>(new Set());

  const supabase = createSupabaseClient();

  // Fetch tracked merchants for the current user
  const fetchTrackedMerchants = async () => {
    try {
      const response = await fetch('/api/merchant-pacing-tracking');
      const data = await response.json();
      
      if (data.success && data.tracked_merchants) {
        const tracked = new Set<string>(
          data.tracked_merchants
            .filter((t: { is_active: boolean }) => t.is_active)
            .map((t: { ai_merchant_name: string }) => t.ai_merchant_name)
        );
        setTrackedMerchants(tracked);
      }
    } catch (error) {
      console.error('Error fetching tracked merchants:', error);
    }
  };

  // Toggle merchant tracking
  const toggleMerchantTracking = async (merchantName: string) => {
    try {
      setTrackingLoading(prev => new Set([...prev, merchantName]));
      
      const isCurrentlyTracked = trackedMerchants.has(merchantName);
      
      const response = await fetch('/api/merchant-pacing-tracking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ai_merchant_name: merchantName,
          is_active: !isCurrentlyTracked,
          auto_selected: false
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setTrackedMerchants(prev => {
          const newSet = new Set(prev);
          if (isCurrentlyTracked) {
            newSet.delete(merchantName);
          } else {
            newSet.add(merchantName);
          }
          return newSet;
        });
      } else {
        console.error('Failed to toggle merchant tracking:', data.error);
      }
    } catch (error) {
      console.error('Error toggling merchant tracking:', error);
    } finally {
      setTrackingLoading(prev => {
        const newSet = new Set(prev);
        newSet.delete(merchantName);
        return newSet;
      });
    }
  };

  // OPTIMIZED: Simplified data fetching for better performance
  const fetchAIMerchantData = async () => {
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
        setMerchantData([]);
        setLoading(false);
        return;
      }

      // Get all spending transactions (including those pending AI processing)
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
        .order('date', { ascending: false });

      if (transactionsError) {
        throw new Error(`Failed to fetch transactions: ${transactionsError.message}`);
      }

      if (!transactions || transactions.length === 0) {
        setMerchantData([]);
        setLoading(false);
        return;
      }

      // Calculate global date range
      const allDates = transactions.map(t => t.date).sort();
      const globalFirstDate = new Date(allDates[0]);
      const globalLastDate = new Date(allDates[allDates.length - 1]);
      const daysOfData = Math.max(1, Math.ceil((globalLastDate.getTime() - globalFirstDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);

      // Process transactions by AI merchant
      const merchantMap = new Map<string, {
        totalSpending: number;
        transactionCount: number;
        amounts: number[];
        categories: Map<string, { amount: number; count: number }>;
        monthlySpending: Map<string, number>; // For trend analysis
        transactionDates: string[]; // For frequency analysis
      }>();

      transactions.forEach(transaction => {
        // Use AI merchant name if available, fallback to original merchant name, then transaction name
        const aiMerchant = transaction.ai_merchant_name || transaction.merchant_name || transaction.name || 'Unknown';
        const aiCategory = transaction.ai_category_tag || 'Uncategorized';
        
        // Try to parse date consistently - assume date is YYYY-MM-DD format
        const dateStr = transaction.date;
        const txDate = new Date(dateStr + 'T12:00:00'); // Add noon time to avoid timezone edge cases
        const monthKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;

        if (!merchantMap.has(aiMerchant)) {
          merchantMap.set(aiMerchant, {
            totalSpending: 0,
            transactionCount: 0,
            amounts: [],
            categories: new Map(),
            monthlySpending: new Map(),
            transactionDates: [],
          });
        }

        const merchantData = merchantMap.get(aiMerchant)!;
        merchantData.totalSpending += transaction.amount;
        merchantData.transactionCount += 1;
        merchantData.amounts.push(transaction.amount);
        merchantData.transactionDates.push(dateStr); // Use original date string

        // Track category spending
        if (!merchantData.categories.has(aiCategory)) {
          merchantData.categories.set(aiCategory, { amount: 0, count: 0 });
        }
        const categoryData = merchantData.categories.get(aiCategory)!;
        categoryData.amount += transaction.amount;
        categoryData.count += 1;

        // Track monthly spending for trends
        if (!merchantData.monthlySpending.has(monthKey)) {
          merchantData.monthlySpending.set(monthKey, 0);
        }
        merchantData.monthlySpending.set(monthKey, merchantData.monthlySpending.get(monthKey)! + transaction.amount);
      });

      // Convert to array and calculate metrics
      const processedData: AIMerchantData[] = Array.from(merchantMap.entries()).map(([aiMerchant, data]) => {
        const avgDailySpending = data.totalSpending / daysOfData;
        const avgMonthlySpending = avgDailySpending * 30;
        const avgTransactionAmount = data.totalSpending / data.transactionCount;

        // Calculate transaction frequency
        const sortedDates = data.transactionDates.sort();
        let totalDaysBetween = 0;
        for (let i = 1; i < sortedDates.length; i++) {
          const date1 = new Date(sortedDates[i-1] + 'T12:00:00');
          const date2 = new Date(sortedDates[i] + 'T12:00:00');
          const daysBetween = Math.ceil((date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24));
          totalDaysBetween += daysBetween;
        }
        const frequencyDays = sortedDates.length > 1 ? totalDaysBetween / (sortedDates.length - 1) : daysOfData;

        // Determine merchant type based on frequency
        let merchantType: 'frequent' | 'occasional' | 'rare';
        if (frequencyDays <= 7) {
          merchantType = 'frequent'; // Weekly or more
        } else if (frequencyDays <= 30) {
          merchantType = 'occasional'; // Monthly
        } else {
          merchantType = 'rare'; // Less than monthly
        }

        // Get top categories (top 3)
        const categories = Array.from(data.categories.entries())
          .sort((a, b) => b[1].amount - a[1].amount)
          .slice(0, 3)
          .map(([category, data]) => ({
            category,
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
          ai_merchant: aiMerchant,
          total_spending: data.totalSpending,
          transaction_count: data.transactionCount,
          unique_categories: data.categories.size,
          first_transaction_date: allDates[0],
          last_transaction_date: allDates[allDates.length - 1],
          days_of_data: daysOfData,
          avg_daily_spending: avgDailySpending,
          avg_monthly_spending: avgMonthlySpending,
          avg_transaction_amount: avgTransactionAmount,
          frequency_days: frequencyDays,
          categories: categories,
          current_month_spending: currentMonthSpending,
          pacing_percentage: pacingPercentage,
          pacing_status: pacingStatus,
          spending_trend: spendingTrend,
          merchant_type: merchantType
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
          case 'frequency':
            comparison = a.frequency_days - b.frequency_days; // Lower days = higher frequency
            break;
          case 'remaining':
            const aRemaining = a.avg_monthly_spending - a.current_month_spending;
            const bRemaining = b.avg_monthly_spending - b.current_month_spending;
            comparison = aRemaining - bRemaining;
            break;
        }
        return sortOrder === 'desc' ? -comparison : comparison;
      });

      setMerchantData(processedData);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching AI merchant data:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Auto-select top merchants for new users
  const runAutoSelection = async () => {
    try {
      console.log('🤖 Running auto-selection for top merchants...');
      const response = await fetch('/api/merchant-pacing-tracking/auto-select', {
        method: 'POST',
      });

      const data = await response.json();
      
      if (data.success && data.auto_selected?.length > 0) {
        console.log(`✅ Auto-selected ${data.auto_selected.length} merchants:`, data.merchant_analysis);
        // Refresh tracked merchants to show the newly selected ones
        await fetchTrackedMerchants();
      } else {
        console.log('ℹ️ Auto-selection result:', data.message);
      }
    } catch (error) {
      console.error('Error during auto-selection:', error);
    }
  };

  useEffect(() => {
    const initializePage = async () => {
      await fetchAIMerchantData();
      await fetchTrackedMerchants();
      
      // Check if user needs auto-selection (no tracked merchants)
      const checkResponse = await fetch('/api/merchant-pacing-tracking/auto-select');
      const checkData = await checkResponse.json();
      
      if (checkData.success && checkData.needs_auto_selection) {
        await runAutoSelection();
      }
    };

    initializePage();
  }, [sortBy, sortOrder]); // eslint-disable-line react-hooks/exhaustive-deps

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getMerchantIcon = (merchant: string) => {
    const icons: { [key: string]: string } = {
      'Amazon': '📦',
      'Target': '🎯',
      'Walmart': '🛒',
      'Costco': '🏪',
      'Starbucks': '☕',
      'McDonald\'s': '🍟',
      'Subway': '🥪',
      'Publix': '🛒',
      'Kroger': '🛒',
      'Shell': '⛽',
      'Exxon': '⛽',
      'Apple': '🍎',
      'Netflix': '📺',
      'Spotify': '🎵',
      'Uber': '🚗',
      'Lyft': '🚕'
    };
    return icons[merchant] || '🏢';
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

  const getMerchantTypeColor = (type: string) => {
    switch (type) {
      case 'frequent': return 'text-blue-700 bg-blue-100';
      case 'occasional': return 'text-orange-700 bg-orange-100';
      case 'rare': return 'text-gray-700 bg-gray-100';
      default: return 'text-gray-700 bg-gray-100';
    }
  };

  const getMerchantTypeLabel = (type: string) => {
    switch (type) {
      case 'frequent': return 'Frequent';
      case 'occasional': return 'Occasional';
      case 'rare': return 'Rare';
      default: return 'Unknown';
    }
  };

  const formatFrequency = (days: number) => {
    if (days < 1) return 'Daily+';
    if (days < 7) return `${Math.round(days)}d`;
    if (days < 30) return `${Math.round(days / 7)}w`;
    return `${Math.round(days / 30)}m`;
  };

  const handleSort = (newSortBy: 'spending' | 'transactions' | 'frequency' | 'remaining') => {
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
            <Button onClick={fetchAIMerchantData} className="mt-2">
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
          <h1 className="text-2xl font-medium">🏪 Merchants</h1>
          <p className="text-muted-foreground mt-2">
            Smart merchant analysis and spending tracking
            {lastUpdated && (
              <span className="block text-sm">
                Last updated: {lastUpdated.toLocaleString()}
              </span>
            )}
          </p>
        </div>
        <ManualRefreshButton onRefresh={fetchAIMerchantData} />
      </div>

      {merchantData.length === 0 ? (
                 <Card>
           <CardContent className="text-center py-8">
             <p className="text-gray-600">No merchant transactions found. This could mean no transactions are available or they&apos;re still being processed.</p>
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
                      <th className="text-left py-3 px-2 font-medium text-gray-900">Merchant</th>
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
                      <th className="text-center py-3 px-2 font-medium text-gray-900">Type</th>
                      <th 
                        className="text-center py-3 px-2 font-medium text-gray-900 cursor-pointer hover:bg-gray-50 select-none"
                        onClick={() => handleSort('frequency')}
                      >
                        <div className="flex items-center justify-center">
                          Frequency
                          {sortBy === 'frequency' && (
                            <span className="ml-1">
                              {sortOrder === 'desc' ? '↓' : '↑'}
                            </span>
                          )}
                        </div>
                      </th>
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
                      <th className="text-right py-3 px-2 font-medium text-gray-900">Avg/Transaction</th>
                      <th className="text-left py-3 px-2 font-medium text-gray-900">Categories</th>
                    </tr>
                  </thead>
                  <tbody>
                    {merchantData.map((merchant) => (
                      <tr key={merchant.ai_merchant} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-2 text-center">
                          <button
                            onClick={() => toggleMerchantTracking(merchant.ai_merchant)}
                            disabled={trackingLoading.has(merchant.ai_merchant)}
                            className="text-2xl hover:scale-110 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                            title={trackedMerchants.has(merchant.ai_merchant) ? 
                              `Stop tracking pacing for ${merchant.ai_merchant}` : 
                              `Start tracking pacing for ${merchant.ai_merchant}`}
                          >
                            {trackingLoading.has(merchant.ai_merchant) ? (
                              '⏳'
                            ) : trackedMerchants.has(merchant.ai_merchant) ? (
                              merchant.pacing_status === 'under' ? '🟢' :
                              merchant.pacing_status === 'over' ? '🔴' : '🟡'
                            ) : (
                              '⚪'
                            )}
                          </button>
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex items-center space-x-2">
                            <span className="text-lg">{getMerchantIcon(merchant.ai_merchant)}</span>
                            <span className="font-medium text-gray-900">{merchant.ai_merchant}</span>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-right font-bold text-blue-600">
                          {formatCurrency(merchant.avg_monthly_spending)}
                        </td>
                        <td className="py-3 px-2 text-right">
                          {formatCurrency(merchant.current_month_spending)}
                        </td>
                        <td className="py-3 px-2 text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPacingColor(merchant.pacing_status)}`}>
                            {merchant.pacing_status === 'under' && '🟢'}
                            {merchant.pacing_status === 'on-track' && '🟡'}
                            {merchant.pacing_status === 'over' && '🔴'}
                            {Math.round(merchant.pacing_percentage * 100)}%
                          </span>
                        </td>
                        <td className="py-3 px-2 text-center">
                          {(() => {
                            const remaining = merchant.avg_monthly_spending - merchant.current_month_spending;
                            const percentSpent = merchant.avg_monthly_spending > 0 ? (merchant.current_month_spending / merchant.avg_monthly_spending) : 0;
                            
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
                          <span className="text-lg">{getTrendIcon(merchant.spending_trend)}</span>
                        </td>
                        <td className="py-3 px-2 text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getMerchantTypeColor(merchant.merchant_type)}`}>
                            {getMerchantTypeLabel(merchant.merchant_type)}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-center text-sm text-gray-600">
                          {formatFrequency(merchant.frequency_days)}
                        </td>
                        <td className="py-3 px-2 text-right text-gray-600">
                          {merchant.transaction_count}
                        </td>
                        <td className="py-3 px-2 text-right text-gray-600">
                          {formatCurrency(merchant.avg_transaction_amount)}
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex flex-wrap gap-1">
                            {merchant.categories.slice(0, 2).map((cat, i) => (
                              <span key={i} className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded">
                                {cat.category} ({cat.count})
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
                  <p><strong>Merchant Types:</strong> Based on transaction frequency</p>
                  <p><strong>🔵 Frequent:</strong> Weekly or more (≤7 days)</p>
                  <p><strong>🟠 Occasional:</strong> Monthly (8-30 days)</p>
                  <p><strong>⚪ Rare:</strong> Less than monthly (&gt;30 days)</p>
                </div>
                <div>
                  <p><strong>Frequency:</strong> Average days between transactions</p>
                  <p><strong>d:</strong> days, <strong>w:</strong> weeks, <strong>m:</strong> months</p>
                  <p><strong>Categories:</strong> Top categories by spending with transaction count</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
} 