'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ContentAreaLoader } from '@/components/ui/content-area-loader';
import { FlowBreakdownModal } from '@/components/flow-breakdown-modal';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar
} from 'recharts';

interface ADFTimelinePoint {
  date: string;
  dailyADF: number;
  totalADF: number;
  totalFixed: number;
  totalTransfers: number;
  totalSpending: number;
  merchantADF: { [key: string]: number };
  categoryADF: { [key: string]: number };
  adfTransactionCount: number;
}

interface MerchantTrend {
  merchant: string;
  currentDailyADF: number;
  currentTotal: number;
  trend: number;
  timelinePoints: number;
}

interface CategoryTrend {
  category: string;
  currentDailyADF: number;
  currentTotal: number;
  trend: number;
  timelinePoints: number;
}

interface ADFFlowData {
  summary: {
    totalTransactions: number;
    dataStartDate: string;
    dataEndDate: string;
    totalDaysOfData: number;
    rollingWindowsGenerated: number;
  };
  current: {
    dailyADF: number;
    totalADF: number;
    totalFixed: number;
    totalTransfers: number;
    totalSpending: number;
    adfPercentage: number;
    fixedPercentage: number;
  };
  timeline: ADFTimelinePoint[];
  trends: {
    overallTrendPercentage: number;
    overallTrendDirection: 'increasing' | 'decreasing' | 'stable';
  };
  topMerchants: MerchantTrend[];
  topCategories: CategoryTrend[];
  merchantTimelines: { [key: string]: { date: string; dailyADF: number; totalADF: number }[] };
  categoryTimelines: { [key: string]: { date: string; dailyADF: number; totalADF: number }[] };
}

export default function FlowPage() {
  const [data, setData] = useState<ADFFlowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'overview' | 'merchants' | 'categories' | 'timeline' | 'charts'>('charts');
  const [isBreakdownModalOpen, setIsBreakdownModalOpen] = useState(false);

  const fetchFlowData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/adf-flow?userId=bc474c8b-4b47-4c7d-b202-f469330af2a2');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch flow data: ${response.statusText}`);
      }
      
      const flowData = await response.json();
      setData(flowData);
    } catch (err) {
      console.error('Error fetching flow data:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlowData();
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

  const getTrendIcon = (trend: number) => {
    if (trend > 5) return '📈';
    if (trend < -5) return '📉';
    return '➡️';
  };

  const getTrendColor = (trend: number) => {
    if (trend > 5) return 'text-red-600';
    if (trend < -5) return 'text-green-600';
    return 'text-gray-600';
  };

  const getCategoryIcon = (category: string) => {
    const icons: { [key: string]: string } = {
      'Restaurant': '🍽️',
      'Groceries': '🛒',
      'Gas': '⛽',
      'Shopping': '🛍️',
      'Entertainment': '🎬',
      'Healthcare': '🏥',
      'Travel': '✈️',
      'Krezzo': '💼',
      'Education': '📚',
      'Automotive': '🚗',
      'Unknown': '❓'
    };
    return icons[category] || '📊';
  };

  const getMerchantIcon = (merchant: string) => {
    const icons: { [key: string]: string } = {
      'Amazon': '📦',
      'Target': '🎯',
      'Walmart': '🛒',
      'Publix': '🛒',
      'Circle K': '⛽',
      'Cursor': '💻',
      'Trader Joe\'s': '🥗',
      'Chick-fil-a': '🍗',
      'Starbucks': '☕'
    };
    return icons[merchant] || '🏢';
  };

  // Chart data formatters
  const formatTimelineData = () => {
    if (!data) return [];
    return data.timeline.map(point => ({
      date: new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      dailyADF: Math.round(point.dailyADF),
      totalSpending: Math.round(point.totalSpending),
      fixedExpenses: Math.round(point.totalFixed),
      transfers: Math.round(point.totalTransfers),
      adfPercentage: Math.round((point.totalADF / point.totalSpending) * 100)
    }));
  };

  const formatCategoryTrendData = () => {
    if (!data) return [];
    
    // Get timeline dates
    const dates = data.timeline.map(point => point.date);
    
    // Create data points for each date with top categories
    return dates.map(date => {
      const timelinePoint = data.timeline.find(p => p.date === date);
      if (!timelinePoint) return null;
      
      const result: { [key: string]: string | number } = {
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      };
      
      // Add top categories as daily ADF amounts
      data.topCategories.slice(0, 5).forEach(category => {
        const categoryAmount = timelinePoint.categoryADF[category.category] || 0;
        result[category.category] = Math.round(categoryAmount / 30); // Daily amount
      });
      
      return result;
    }).filter(Boolean);
  };

  const formatMerchantTrendData = () => {
    if (!data) return [];
    
    const dates = data.timeline.map(point => point.date);
    
    return dates.map(date => {
      const timelinePoint = data.timeline.find(p => p.date === date);
      if (!timelinePoint) return null;
      
      const result: { [key: string]: string | number } = {
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      };
      
      // Add top merchants as daily ADF amounts
      data.topMerchants.slice(0, 5).forEach(merchant => {
        const merchantAmount = timelinePoint.merchantADF[merchant.merchant] || 0;
        result[merchant.merchant] = Math.round(merchantAmount / 30); // Daily amount
      });
      
      return result;
    }).filter(Boolean);
  };

  // Chart colors
  const chartColors = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#6B7280'];
  
  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { dataKey: string; value: number; color: string }[]; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium">{label}</p>
          {payload.map((entry: { dataKey: string; value: number; color: string }, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.dataKey}: {formatCurrency(entry.value)}
              {entry.dataKey === 'adfPercentage' ? '%' : '/day'}
            </p>
          ))}
        </div>
      );
    }
    return null;
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
            <Button onClick={fetchFlowData} className="mt-2">
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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="text-2xl font-medium">💰 Flow Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Track your daily flow - the spending you can actually control
          </p>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card 
          className="bg-blue-50 border-blue-200 cursor-pointer hover:bg-blue-100 transition-colors"
          onClick={() => setIsBreakdownModalOpen(true)}
        >
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-center text-blue-600">
              {formatCurrency(data.current.dailyADF)}
            </div>
            <div className="text-sm text-blue-700 text-center font-medium">
              Current Daily Flow
            </div>
            <div className="text-xs text-gray-600 text-center mt-1">
              Your controllable spending/day
            </div>
            <div className="text-xs text-blue-500 text-center mt-2">
              Click for breakdown →
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-center text-green-600">
              {data.current.adfPercentage.toFixed(0)}%
            </div>
            <div className="text-sm text-green-700 text-center font-medium">
              Flow Percentage
            </div>
            <div className="text-xs text-gray-600 text-center mt-1">
              Of total spending
            </div>
          </CardContent>
        </Card>

        <Card className={`${data.trends.overallTrendDirection === 'decreasing' ? 'bg-green-50 border-green-200' : 
                         data.trends.overallTrendDirection === 'increasing' ? 'bg-red-50 border-red-200' : 
                         'bg-gray-50 border-gray-200'}`}>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-center">
              {data.trends.overallTrendDirection === 'decreasing' ? '📉' : 
               data.trends.overallTrendDirection === 'increasing' ? '📈' : '➡️'}
            </div>
            <div className={`text-sm text-center font-medium ${
              data.trends.overallTrendDirection === 'decreasing' ? 'text-green-700' : 
              data.trends.overallTrendDirection === 'increasing' ? 'text-red-700' : 'text-gray-700'
            }`}>
              Flow Trend
            </div>
            <div className="text-xs text-gray-600 text-center mt-1">
              {formatPercentage(data.trends.overallTrendPercentage)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-center">
              {data.summary.totalDaysOfData}
            </div>
            <div className="text-sm text-gray-700 text-center font-medium">
              Days of Data
            </div>
            <div className="text-xs text-gray-600 text-center mt-1">
              {data.summary.rollingWindowsGenerated} Flow calculations
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Spending Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>💸 Current Spending Breakdown (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(data.current.totalADF)}
              </div>
              <div className="text-sm text-blue-700 font-medium">Flow Spending</div>
              <div className="text-xs text-gray-600">
                {data.current.adfPercentage.toFixed(1)}% of total
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full" 
                  style={{ width: `${data.current.adfPercentage}%` }}
                ></div>
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">
                {formatCurrency(data.current.totalFixed)}
              </div>
              <div className="text-sm text-gray-700 font-medium">Fixed Expenses</div>
              <div className="text-xs text-gray-600">
                {data.current.fixedPercentage.toFixed(1)}% of total
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div 
                  className="bg-gray-600 h-2 rounded-full" 
                  style={{ width: `${data.current.fixedPercentage}%` }}
                ></div>
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(data.current.totalTransfers)}
              </div>
              <div className="text-sm text-green-700 font-medium">Transfers</div>
              <div className="text-xs text-gray-600">
                {((data.current.totalTransfers / data.current.totalSpending) * 100).toFixed(1)}% of total
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div 
                  className="bg-green-600 h-2 rounded-full" 
                  style={{ width: `${(data.current.totalTransfers / data.current.totalSpending) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* View Mode Toggle */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setViewMode('overview')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                viewMode === 'overview' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📊 Overview
            </button>
            <button
              onClick={() => setViewMode('merchants')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                viewMode === 'merchants' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              🏪 Merchants ({data.topMerchants.length})
            </button>
            <button
              onClick={() => setViewMode('categories')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                viewMode === 'categories' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              🗂️ Categories ({data.topCategories.length})
            </button>
            <button
              onClick={() => setViewMode('charts')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                viewMode === 'charts' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📈 Trend Charts
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                viewMode === 'timeline' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📊 Data Table ({data.timeline.length} points)
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Dynamic Content Based on View Mode */}
      {viewMode === 'charts' && (
        <div className="space-y-6">
          {/* Daily Flow Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle>📈 Daily Flow Trend Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div style={{ width: '100%', height: 400 }}>
                <ResponsiveContainer>
                  <LineChart data={formatTimelineData()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                      stroke="#666"
                    />
                    <YAxis 
                      yAxisId="left"
                      tick={{ fontSize: 12 }}
                      stroke="#666"
                      tickFormatter={(value) => `$${value}`}
                    />
                    <YAxis 
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 12 }}
                      stroke="#666"
                      tickFormatter={(value) => `${value}%`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="dailyADF" 
                      stroke="#3B82F6" 
                      strokeWidth={3}
                      dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                      name="Daily Flow"
                      yAxisId="left"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="adfPercentage" 
                      stroke="#10B981" 
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={{ fill: '#10B981', strokeWidth: 2, r: 3 }}
                      name="Flow %"
                      yAxisId="right"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Spending Breakdown Over Time */}
          <Card>
            <CardHeader>
              <CardTitle>🔍 Spending Breakdown Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div style={{ width: '100%', height: 400 }}>
                <ResponsiveContainer>
                  <AreaChart data={formatTimelineData()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                      stroke="#666"
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      stroke="#666"
                      tickFormatter={(value) => `$${value}`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Area 
                      type="monotone" 
                      dataKey="dailyADF" 
                      stackId="1"
                      stroke="#3B82F6" 
                      fill="#3B82F6"
                      fillOpacity={0.6}
                      name="Flow Spending"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="fixedExpenses" 
                      stackId="1"
                      stroke="#6B7280" 
                      fill="#6B7280"
                      fillOpacity={0.6}
                      name="Fixed Expenses"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="transfers" 
                      stackId="1"
                      stroke="#10B981" 
                      fill="#10B981"
                      fillOpacity={0.6}
                      name="Transfers"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Stacked Bar Chart - Spending Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>📊 Spending Breakdown - Stacked Bar Chart</CardTitle>
            </CardHeader>
            <CardContent>
              <div style={{ width: '100%', height: 400 }}>
                <ResponsiveContainer>
                  <BarChart data={formatTimelineData()} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                      stroke="#666"
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      stroke="#666"
                      tickFormatter={(value) => `$${value}`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar 
                      dataKey="dailyADF" 
                      stackId="a"
                      fill="#3B82F6"
                      name="Flow Spending"
                    />
                    <Bar 
                      dataKey="fixedExpenses" 
                      stackId="a"
                      fill="#6B7280"
                      name="Fixed Expenses"
                    />
                    <Bar 
                      dataKey="transfers" 
                      stackId="a"
                      fill="#10B981"
                      name="Transfers"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Category Trends */}
          <Card>
            <CardHeader>
              <CardTitle>🗂️ Top Category Flow Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <div style={{ width: '100%', height: 400 }}>
                <ResponsiveContainer>
                  <LineChart data={formatCategoryTrendData()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                      stroke="#666"
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      stroke="#666"
                      tickFormatter={(value) => `$${value}/day`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    {data?.topCategories.slice(0, 5).map((category, index) => (
                      <Line 
                        key={category.category}
                        type="monotone" 
                        dataKey={category.category} 
                        stroke={chartColors[index]} 
                        strokeWidth={2}
                        dot={{ fill: chartColors[index], strokeWidth: 2, r: 3 }}
                        name={`${getCategoryIcon(category.category)} ${category.category}`}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Merchant Trends */}
          <Card>
            <CardHeader>
              <CardTitle>🏪 Top Merchant Flow Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <div style={{ width: '100%', height: 400 }}>
                <ResponsiveContainer>
                  <LineChart data={formatMerchantTrendData()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                      stroke="#666"
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      stroke="#666"
                      tickFormatter={(value) => `$${value}/day`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    {data?.topMerchants.slice(0, 5).map((merchant, index) => (
                      <Line 
                        key={merchant.merchant}
                        type="monotone" 
                        dataKey={merchant.merchant} 
                        stroke={chartColors[index]} 
                        strokeWidth={2}
                        dot={{ fill: chartColors[index], strokeWidth: 2, r: 3 }}
                        name={`${getMerchantIcon(merchant.merchant)} ${merchant.merchant}`}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {viewMode === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top ADF Categories */}
          <Card>
            <CardHeader>
              <CardTitle>🏷️ Top Flow Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.topCategories.slice(0, 6).map((category) => (
                  <div key={category.category} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <span className="text-lg">{getCategoryIcon(category.category)}</span>
                      <div>
                        <div className="font-medium">{category.category}</div>
                        <div className="text-sm text-gray-600">
                          {formatCurrency(category.currentDailyADF)}/day
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{formatCurrency(category.currentTotal)}</div>
                      <div className={`text-sm ${getTrendColor(category.trend)}`}>
                        {getTrendIcon(category.trend)} {formatPercentage(category.trend)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Top ADF Merchants */}
          <Card>
            <CardHeader>
              <CardTitle>🏪 Top Flow Merchants</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.topMerchants.slice(0, 6).map((merchant) => (
                  <div key={merchant.merchant} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <span className="text-lg">{getMerchantIcon(merchant.merchant)}</span>
                      <div>
                        <div className="font-medium">{merchant.merchant}</div>
                        <div className="text-sm text-gray-600">
                          {formatCurrency(merchant.currentDailyADF)}/day
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{formatCurrency(merchant.currentTotal)}</div>
                      <div className={`text-sm ${getTrendColor(merchant.trend)}`}>
                        {getTrendIcon(merchant.trend)} {formatPercentage(merchant.trend)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {viewMode === 'merchants' && (
        <Card>
          <CardHeader>
            <CardTitle>🏪 Complete Merchant Flow Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-2 font-medium">Merchant</th>
                    <th className="text-left py-3 px-2 font-medium">Daily Flow</th>
                    <th className="text-left py-3 px-2 font-medium">30-Day Total</th>
                    <th className="text-left py-3 px-2 font-medium">Trend</th>
                    <th className="text-left py-3 px-2 font-medium">Data Points</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topMerchants.map((merchant) => (
                    <tr key={merchant.merchant} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-lg">{getMerchantIcon(merchant.merchant)}</span>
                          <span className="font-medium">{merchant.merchant}</span>
                        </div>
                      </td>
                      <td className="py-3 px-2 font-medium text-blue-600">
                        {formatCurrency(merchant.currentDailyADF)}
                      </td>
                      <td className="py-3 px-2">
                        {formatCurrency(merchant.currentTotal)}
                      </td>
                      <td className="py-3 px-2">
                        <div className={`flex items-center space-x-1 ${getTrendColor(merchant.trend)}`}>
                          <span>{getTrendIcon(merchant.trend)}</span>
                          <span className="font-medium">{formatPercentage(merchant.trend)}</span>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-gray-600">
                        {merchant.timelinePoints} windows
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {viewMode === 'categories' && (
        <Card>
          <CardHeader>
            <CardTitle>🗂️ Complete Category Flow Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-2 font-medium">Category</th>
                    <th className="text-left py-3 px-2 font-medium">Daily Flow</th>
                    <th className="text-left py-3 px-2 font-medium">30-Day Total</th>
                    <th className="text-left py-3 px-2 font-medium">Trend</th>
                    <th className="text-left py-3 px-2 font-medium">Data Points</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topCategories.map((category) => (
                    <tr key={category.category} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-lg">{getCategoryIcon(category.category)}</span>
                          <span className="font-medium">{category.category}</span>
                        </div>
                      </td>
                      <td className="py-3 px-2 font-medium text-blue-600">
                        {formatCurrency(category.currentDailyADF)}
                      </td>
                      <td className="py-3 px-2">
                        {formatCurrency(category.currentTotal)}
                      </td>
                      <td className="py-3 px-2">
                        <div className={`flex items-center space-x-1 ${getTrendColor(category.trend)}`}>
                          <span>{getTrendIcon(category.trend)}</span>
                          <span className="font-medium">{formatPercentage(category.trend)}</span>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-gray-600">
                        {category.timelinePoints} windows
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {viewMode === 'timeline' && (
        <Card>
          <CardHeader>
            <CardTitle>📈 Flow Timeline ({data.timeline.length} Rolling Windows)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Timeline Chart Area - Simple Text Visualization for now */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium mb-3">Recent Flow Timeline (Last 10 Windows)</h4>
                              <div className="space-y-2">
                {data.timeline.slice(-10).map((point) => (
                  <div key={point.date} className="flex items-center justify-between">
                      <div className="text-sm text-gray-600">{point.date}</div>
                      <div className="flex items-center space-x-4">
                        <div className="font-medium">{formatCurrency(point.dailyADF)}/day</div>
                        <div className="text-sm text-gray-500">
                          {point.adfTransactionCount} Flow transactions
                        </div>
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ 
                              width: `${Math.min(100, (point.dailyADF / Math.max(...data.timeline.map(p => p.dailyADF))) * 100)}%` 
                            }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Timeline Summary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-xl font-bold">
                      {formatCurrency(Math.max(...data.timeline.map(p => p.dailyADF)))}
                    </div>
                    <div className="text-sm text-gray-600">Peak Daily Flow</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-xl font-bold">
                      {formatCurrency(Math.min(...data.timeline.map(p => p.dailyADF)))}
                    </div>
                    <div className="text-sm text-gray-600">Lowest Daily Flow</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-xl font-bold">
                      {formatCurrency(data.timeline.reduce((sum, p) => sum + p.dailyADF, 0) / data.timeline.length)}
                    </div>
                    <div className="text-sm text-gray-600">Average Daily Flow</div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Key Insights */}
      <Card>
        <CardHeader>
          <CardTitle>💡 Flow Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.trends.overallTrendDirection === 'decreasing' && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <span className="text-lg">🎉</span>
                  <span className="font-medium text-green-800">Great job! Your Flow is trending down by {formatPercentage(Math.abs(data.trends.overallTrendPercentage))}.</span>
                </div>
                <p className="text-green-700 mt-2 text-sm">
                  You&apos;re successfully reducing your discretionary spending while maintaining your lifestyle.
                </p>
              </div>
            )}
            
            {data.trends.overallTrendDirection === 'increasing' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <span className="text-lg">⚠️</span>
                  <span className="font-medium text-yellow-800">Your Flow is trending up by {formatPercentage(data.trends.overallTrendPercentage)}.</span>
                </div>
                <p className="text-yellow-700 mt-2 text-sm">
                  Focus on your top Flow categories: {data.topCategories.slice(0, 3).map(c => c.category).join(', ')}.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="font-medium text-gray-900">Flow vs Fixed Spending:</div>
                <div className="text-gray-600">
                  {data.current.adfPercentage.toFixed(0)}% of your spending is controllable Flow, 
                  while {data.current.fixedPercentage.toFixed(0)}% is fixed expenses.
                </div>
              </div>
              <div>
                <div className="font-medium text-gray-900">Top Optimization Target:</div>
                <div className="text-gray-600">
                  {data.topCategories[0]?.category} at {formatCurrency(data.topCategories[0]?.currentDailyADF)}/day 
                  could be your biggest savings opportunity.
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Flow Breakdown Modal */}
      <FlowBreakdownModal 
        isOpen={isBreakdownModalOpen}
        onClose={() => setIsBreakdownModalOpen(false)}
        userId="bc474c8b-4b47-4c7d-b202-f469330af2a2"
      />
    </div>
  );
}
