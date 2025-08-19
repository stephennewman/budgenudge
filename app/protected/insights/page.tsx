'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ContentAreaLoader } from '@/components/ui/content-area-loader';

interface CategoryInsight {
  category: string;
  baseline_monthly_avg: number;
  recent_30_day_avg: number;
  recent_14_day_avg: number;
  behavioral_change_30d: 'improving' | 'stable' | 'worsening';
  behavioral_change_14d: 'improving' | 'stable' | 'worsening';
  change_percentage_30d: number;
  change_percentage_14d: number;
  transaction_count_baseline: number;
  transaction_count_recent_30d: number;
  transaction_count_recent_14d: number;
  first_transaction_date: string;
  last_transaction_date: string;
}

interface MerchantInsight {
  merchant: string;
  baseline_monthly_avg: number;
  recent_30_day_avg: number;
  recent_14_day_avg: number;
  behavioral_change_30d: 'improving' | 'stable' | 'worsening';
  behavioral_change_14d: 'improving' | 'stable' | 'worsening';
  change_percentage_30d: number;
  change_percentage_14d: number;
  transaction_count_baseline: number;
  transaction_count_recent_30d: number;
  transaction_count_recent_14d: number;
  frequency_baseline: number;
  frequency_recent: number;
}

interface BehavioralInsightsData {
  user_signup_date: string;
  baseline_period_start: string;
  baseline_period_end: string;
  days_since_signup: number;
  total_baseline_days: number;
  categories: CategoryInsight[];
  merchants: MerchantInsight[];
  summary: {
    total_categories_analyzed: number;
    total_merchants_analyzed: number;
    categories_improving: number;
    categories_worsening: number;
    merchants_improving: number;
    merchants_worsening: number;
    overall_trend: 'improving' | 'stable' | 'worsening';
  };
}

type ViewMode = 'categories' | 'merchants';
type SortBy = 'change' | 'baseline' | 'recent' | 'name';
type PeriodFilter = '30d' | '14d';

export default function InsightsPage() {
  const [data, setData] = useState<BehavioralInsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('categories');
  const [sortBy, setSortBy] = useState<SortBy>('change');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('30d');
  const [behaviorFilter, setBehaviorFilter] = useState<'all' | 'improving' | 'worsening' | 'stable'>('all');

  const fetchInsights = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/behavioral-insights');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch insights: ${response.statusText}`);
      }
      
      const insights = await response.json();
      setData(insights);
    } catch (err) {
      console.error('Error fetching behavioral insights:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatPercentage = (percentage: number) => {
    const sign = percentage > 0 ? '+' : '';
    return `${sign}${percentage.toFixed(1)}%`;
  };

  const getBehaviorIcon = (behavior: 'improving' | 'stable' | 'worsening') => {
    switch (behavior) {
      case 'improving': return '🎉';
      case 'worsening': return '⚠️';
      case 'stable': return '➡️';
    }
  };

  const getBehaviorColor = (behavior: 'improving' | 'stable' | 'worsening') => {
    switch (behavior) {
      case 'improving': return 'text-green-600';
      case 'worsening': return 'text-red-600';
      case 'stable': return 'text-gray-600';
    }
  };

  const getBehaviorBgColor = (behavior: 'improving' | 'stable' | 'worsening') => {
    switch (behavior) {
      case 'improving': return 'bg-green-50 border-green-200';
      case 'worsening': return 'bg-red-50 border-red-200';
      case 'stable': return 'bg-gray-50 border-gray-200';
    }
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

  const getSortedData = () => {
    if (!data) return [];
    
    const items = viewMode === 'categories' ? data.categories : data.merchants;
    
    // Filter by behavior
    const filtered = items.filter(item => {
      if (behaviorFilter === 'all') return true;
      const categoryItem = item as CategoryInsight;
      const merchantItem = item as MerchantInsight;
      const behavior = periodFilter === '30d' ? 
        (categoryItem.behavioral_change_30d || merchantItem.behavioral_change_30d) : 
        (categoryItem.behavioral_change_14d || merchantItem.behavioral_change_14d);
      return behavior === behaviorFilter;
    });
    
    // Sort
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'change':
          const aCategoryItem = a as CategoryInsight;
          const aMerchantItem = a as MerchantInsight;
          const bCategoryItem = b as CategoryInsight;
          const bMerchantItem = b as MerchantInsight;
          
          const aChange = periodFilter === '30d' ? 
            (aCategoryItem.change_percentage_30d ?? aMerchantItem.change_percentage_30d) : 
            (aCategoryItem.change_percentage_14d ?? aMerchantItem.change_percentage_14d);
          const bChange = periodFilter === '30d' ? 
            (bCategoryItem.change_percentage_30d ?? bMerchantItem.change_percentage_30d) : 
            (bCategoryItem.change_percentage_14d ?? bMerchantItem.change_percentage_14d);
          return aChange - bChange; // Improving (negative) first
        case 'baseline':
          return b.baseline_monthly_avg - a.baseline_monthly_avg;
        case 'recent':
          const aRecent = periodFilter === '30d' ? a.recent_30_day_avg : a.recent_14_day_avg;
          const bRecent = periodFilter === '30d' ? b.recent_30_day_avg : b.recent_14_day_avg;
          return bRecent - aRecent;
        case 'name':
          const aName = viewMode === 'categories' ? (a as CategoryInsight).category : (a as MerchantInsight).merchant;
          const bName = viewMode === 'categories' ? (b as CategoryInsight).category : (b as MerchantInsight).merchant;
          return aName.localeCompare(bName);
        default:
          return 0;
      }
    });
  };

  if (loading) {
    return (
      <div className="relative min-h-[600px]">
        <ContentAreaLoader />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-w-md mx-auto">
            <p className="text-red-700">Error: {error}</p>
            <Button onClick={fetchInsights} className="mt-2">
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return <div>No data available</div>;
  }

  const sortedData = getSortedData();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="text-2xl font-medium">📊 Behavioral Insights</h1>
          <p className="text-muted-foreground mt-2">
            Track how your spending habits have changed since you signed up
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-center">
              {data.days_since_signup}
            </div>
            <div className="text-sm text-gray-600 text-center">
              Days Since Signup
            </div>
            <div className="text-xs text-gray-500 text-center mt-1">
              {data.user_signup_date}
            </div>
          </CardContent>
        </Card>

        <Card className={getBehaviorBgColor(data.summary.overall_trend)}>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-center">
              {getBehaviorIcon(data.summary.overall_trend)}
            </div>
            <div className={`text-sm text-center font-medium ${getBehaviorColor(data.summary.overall_trend)}`}>
              Overall Trend
            </div>
            <div className="text-xs text-gray-600 text-center mt-1 capitalize">
              {data.summary.overall_trend}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-center text-green-600">
              {data.summary.categories_improving + data.summary.merchants_improving}
            </div>
            <div className="text-sm text-green-700 text-center font-medium">
              Areas Improving
            </div>
            <div className="text-xs text-gray-600 text-center mt-1">
              Categories & Merchants
            </div>
          </CardContent>
        </Card>

        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-center text-red-600">
              {data.summary.categories_worsening + data.summary.merchants_worsening}
            </div>
            <div className="text-sm text-red-700 text-center font-medium">
              Areas Worsening
            </div>
            <div className="text-xs text-gray-600 text-center mt-1">
              Categories & Merchants
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Baseline Info */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-medium text-gray-900 mb-2">📅 Your Baseline Period</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-gray-600">Baseline Period:</div>
              <div className="font-medium">{data.baseline_period_start} to {data.baseline_period_end}</div>
            </div>
            <div>
              <div className="text-gray-600">Baseline Length:</div>
              <div className="font-medium">{data.total_baseline_days} days</div>
            </div>
            <div>
              <div className="text-gray-600">Analysis Method:</div>
              <div className="font-medium">
                {data.days_since_signup > 90 ? 
                  'First 90 days after signup' : 
                  'All historical data as baseline'
                }
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center">
            {/* View Mode */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">View:</span>
              <div className="flex border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('categories')}
                  className={`px-3 py-1 text-sm ${viewMode === 'categories' ? 
                    'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                >
                  Categories ({data.categories.length})
                </button>
                <button
                  onClick={() => setViewMode('merchants')}
                  className={`px-3 py-1 text-sm ${viewMode === 'merchants' ? 
                    'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                >
                  Merchants ({data.merchants.length})
                </button>
              </div>
            </div>

            {/* Period Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Compare to:</span>
              <select
                value={periodFilter}
                onChange={(e) => setPeriodFilter(e.target.value as PeriodFilter)}
                className="px-3 py-1 text-sm border border-gray-200 rounded-lg"
              >
                <option value="30d">Last 30 Days</option>
                <option value="14d">Last 14 Days</option>
              </select>
            </div>

            {/* Behavior Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Show:</span>
              <select
                value={behaviorFilter}
                onChange={(e) => setBehaviorFilter(e.target.value as 'all' | 'improving' | 'worsening' | 'stable')}
                className="px-3 py-1 text-sm border border-gray-200 rounded-lg"
              >
                <option value="all">All Changes</option>
                <option value="improving">🎉 Improving</option>
                <option value="worsening">⚠️ Worsening</option>
                <option value="stable">➡️ Stable</option>
              </select>
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="px-3 py-1 text-sm border border-gray-200 rounded-lg"
              >
                <option value="change">Biggest Changes</option>
                <option value="baseline">Baseline Spending</option>
                <option value="recent">Recent Spending</option>
                <option value="name">Name</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {viewMode === 'categories' ? '🗂️ Category' : '🏪 Merchant'} Behavioral Changes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sortedData.length === 0 ? (
            <div className="text-center py-8 text-gray-600">
              No {behaviorFilter === 'all' ? '' : behaviorFilter + ' '}changes found in the selected period.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-2 font-medium text-gray-900">
                      {viewMode === 'categories' ? 'Category' : 'Merchant'}
                    </th>
                    <th className="text-left py-3 px-2 font-medium text-gray-900">
                      Baseline Monthly Avg
                    </th>
                    <th className="text-left py-3 px-2 font-medium text-gray-900">
                      Recent {periodFilter === '30d' ? '30-Day' : '14-Day'} Avg
                    </th>
                    <th className="text-left py-3 px-2 font-medium text-gray-900">
                      Change
                    </th>
                    <th className="text-left py-3 px-2 font-medium text-gray-900">
                      Behavior
                    </th>
                    <th className="text-left py-3 px-2 font-medium text-gray-900">
                      Transactions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedData.map((item) => {
                    const categoryItem = item as CategoryInsight;
                    const merchantItem = item as MerchantInsight;
                    
                    const name = viewMode === 'categories' ? 
                      categoryItem.category : 
                      merchantItem.merchant;
                    
                    const icon = viewMode === 'categories' ? 
                      getCategoryIcon(categoryItem.category) : 
                      getMerchantIcon(merchantItem.merchant);
                    
                    const recentAvg = periodFilter === '30d' ? item.recent_30_day_avg : item.recent_14_day_avg;
                    const behaviorChange = periodFilter === '30d' ? 
                      (categoryItem.behavioral_change_30d || merchantItem.behavioral_change_30d) : 
                      (categoryItem.behavioral_change_14d || merchantItem.behavioral_change_14d);
                    const changePercentage = periodFilter === '30d' ? 
                      (categoryItem.change_percentage_30d ?? merchantItem.change_percentage_30d) : 
                      (categoryItem.change_percentage_14d ?? merchantItem.change_percentage_14d);
                    const recentTransactions = periodFilter === '30d' ? 
                      (categoryItem.transaction_count_recent_30d ?? merchantItem.transaction_count_recent_30d) : 
                      (categoryItem.transaction_count_recent_14d ?? merchantItem.transaction_count_recent_14d);
                    
                    return (
                      <tr key={name} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-2">
                          <div className="flex items-center space-x-2">
                            <span className="text-lg">{icon}</span>
                            <span className="font-medium text-gray-900">{name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <div className="font-medium text-blue-600">
                            {formatCurrency(item.baseline_monthly_avg)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {item.transaction_count_baseline} transactions
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <div className="font-medium">
                            {formatCurrency(recentAvg)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {recentTransactions} transactions
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <div className={`font-medium ${changePercentage < 0 ? 'text-green-600' : changePercentage > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                            {formatPercentage(changePercentage)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {formatCurrency(Math.abs(recentAvg - item.baseline_monthly_avg))}
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <div className={`flex items-center space-x-1 ${getBehaviorColor(behaviorChange)}`}>
                            <span>{getBehaviorIcon(behaviorChange)}</span>
                            <span className="font-medium capitalize">{behaviorChange}</span>
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <div className="text-sm">
                            <div>Baseline: {item.transaction_count_baseline}</div>
                            <div>Recent: {recentTransactions}</div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Insights Summary */}
      <Card>
        <CardHeader>
          <CardTitle>🧠 Key Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.summary.overall_trend === 'improving' && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <span className="text-lg">🎉</span>
                  <span className="font-medium text-green-800">Great job! Your spending habits are improving overall.</span>
                </div>
                <p className="text-green-700 mt-2 text-sm">
                  You have {data.summary.categories_improving + data.summary.merchants_improving} areas showing improvement 
                  compared to {data.summary.categories_worsening + data.summary.merchants_worsening} areas that have worsened.
                </p>
              </div>
            )}
            
            {data.summary.overall_trend === 'worsening' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <span className="text-lg">💡</span>
                  <span className="font-medium text-yellow-800">Opportunity for improvement in your spending habits.</span>
                </div>
                <p className="text-yellow-700 mt-2 text-sm">
                  Focus on the {data.summary.categories_worsening + data.summary.merchants_worsening} areas showing increased spending 
                  while maintaining the {data.summary.categories_improving + data.summary.merchants_improving} areas that are improving.
                </p>
              </div>
            )}

            {data.summary.overall_trend === 'stable' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <span className="text-lg">📊</span>
                  <span className="font-medium text-blue-800">Your spending habits are generally stable.</span>
                </div>
                              <p className="text-blue-700 mt-2 text-sm">
                You&apos;re maintaining consistent spending patterns. Look for specific areas where you can optimize further.
              </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="font-medium text-gray-900">Baseline Period Analysis:</div>
                <div className="text-gray-600">
                  {data.total_baseline_days} days of spending data from your early usage 
                  ({data.baseline_period_start} to {data.baseline_period_end})
                </div>
              </div>
              <div>
                <div className="font-medium text-gray-900">Comparison Method:</div>
                <div className="text-gray-600">
                  Comparing recent {periodFilter === '30d' ? '30-day' : '14-day'} averages 
                  to your baseline monthly spending patterns
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
