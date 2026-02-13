'use client';

import { useState, useEffect } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface WeeklyData {
  week_start: string;
  total_spent: number;
  transaction_count: number;
  avg_transaction: number;
}

interface MerchantSummary {
  merchant: string;
  totalTransactions: number;
  totalSpent: number;
}

interface CategorySummary {
  category: string;
  totalTransactions: number;
  totalSpent: number;
}

interface AnalysisData {
  dateRange: {
    start: string;
    end: string;
    weekCount: number;
  };
  topMerchants: MerchantSummary[];
  weeklyData: {
    [merchant: string]: WeeklyData[];
  };
  topCategories: CategorySummary[];
  categoryWeeklyData: {
    [category: string]: WeeklyData[];
  };
}

export default function MerchantWeeklyReportPage() {
  const [data, setData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMerchant, setSelectedMerchant] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch('/api/merchant-weekly-analysis');
        if (!response.ok) {
          throw new Error('Failed to fetch merchant analysis data');
        }
        const result = await response.json();
        setData(result);
        if (result.topMerchants.length > 0) {
          setSelectedMerchant(result.topMerchants[0].merchant);
        }
        if (result.topCategories.length > 0) {
          setSelectedCategory(result.topCategories[0].category);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading merchant analysis...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center text-red-600">
          <p className="text-xl font-semibold mb-2">Error</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!data || data.topMerchants.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center text-gray-600">
          <p className="text-xl font-semibold mb-2">No Data Available</p>
          <p>No transactions found to analyze.</p>
        </div>
      </div>
    );
  }

  const selectedMerchantData = selectedMerchant ? data.weeklyData[selectedMerchant] : [];

  // Calculate summary stats for selected merchant
  const activeWeeks = selectedMerchantData.filter(w => w.transaction_count > 0).length;
  const totalSpent = selectedMerchantData.reduce((sum, w) => sum + w.total_spent, 0);
  const totalTransactions = selectedMerchantData.reduce((sum, w) => sum + w.transaction_count, 0);
  const overallAvg = totalTransactions > 0 ? totalSpent / totalTransactions : 0;

  // Format chart data
  const chartData = selectedMerchantData.map(week => ({
    week: new Date(week.week_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    'Total Spent': parseFloat(week.total_spent.toFixed(2)),
    '# Transactions': week.transaction_count,
    'Avg Transaction': parseFloat(week.avg_transaction.toFixed(2)),
  }));

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { value: number; payload: Record<string, number> }[] }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border border-gray-200 rounded shadow-lg">
          <p className="font-semibold mb-2">{payload[0].payload.week}</p>
          <p className="text-blue-600">Total Spent: ${payload[0].value.toFixed(2)}</p>
          <p className="text-green-600"># Transactions: {payload[1].value}</p>
          <p className="text-gray-600">Avg Transaction: ${payload[0].payload['Avg Transaction'].toFixed(2)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            📊 Weekly Merchant Spending Report
          </h1>
          <p className="text-gray-600">
            {new Date(data.dateRange.start).toLocaleDateString('en-US', { 
              month: 'long', 
              day: 'numeric', 
              year: 'numeric' 
            })} - {new Date(data.dateRange.end).toLocaleDateString('en-US', { 
              month: 'long', 
              day: 'numeric', 
              year: 'numeric' 
            })} ({data.dateRange.weekCount} weeks)
          </p>
        </div>

        {/* Merchant Selector Tabs */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6 overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            {data.topMerchants.map((merchant) => (
              <button
                key={merchant.merchant}
                onClick={() => setSelectedMerchant(merchant.merchant)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                  selectedMerchant === merchant.merchant
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {merchant.merchant}
                <span className="ml-2 text-sm opacity-75">
                  ({merchant.totalTransactions})
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Summary Stats */}
        {selectedMerchant && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {selectedMerchant} - Summary
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600">Total Spent</p>
                <p className="text-2xl font-bold text-blue-600">
                  ${totalSpent.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Transactions</p>
                <p className="text-2xl font-bold text-green-600">
                  {totalTransactions}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Avg Transaction</p>
                <p className="text-2xl font-bold text-purple-600">
                  ${overallAvg.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Active Weeks</p>
                <p className="text-2xl font-bold text-orange-600">
                  {activeWeeks}/{data.dateRange.weekCount}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Chart */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Weekly Spending Pattern
          </h3>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                margin={{ top: 20, right: 60, left: 20, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="week" 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  yAxisId="left" 
                  label={{ value: 'Total Spent ($)', angle: -90, position: 'insideLeft' }}
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  yAxisId="right" 
                  orientation="right"
                  label={{ value: '# Transactions', angle: 90, position: 'insideRight' }}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  wrapperStyle={{ paddingTop: '20px' }}
                  iconType="circle"
                />
                <Bar 
                  yAxisId="left" 
                  dataKey="Total Spent" 
                  fill="#3b82f6" 
                  radius={[4, 4, 0, 0]}
                />
                <Line 
                  yAxisId="right" 
                  type="monotone"
                  dataKey="# Transactions" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CATEGORY ANALYSIS SECTION */}
        <div className="mt-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            📊 Category Breakdown
          </h2>

          {/* Category Selector Tabs */}
          <div className="bg-white rounded-lg shadow-sm p-4 mb-6 overflow-x-auto">
            <div className="flex gap-2 min-w-max">
              {data.topCategories.map((category) => (
                <button
                  key={category.category}
                  onClick={() => setSelectedCategory(category.category)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                    selectedCategory === category.category
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {category.category}
                  <span className="ml-2 text-sm opacity-75">
                    (${category.totalSpent.toFixed(0)})
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Category Summary Stats */}
          {selectedCategory && (() => {
            const categoryData = data.categoryWeeklyData[selectedCategory] || [];
            const activeWeeks = categoryData.filter(w => w.transaction_count > 0).length;
            const totalSpent = categoryData.reduce((sum, w) => sum + w.total_spent, 0);
            const totalTransactions = categoryData.reduce((sum, w) => sum + w.transaction_count, 0);
            const overallAvg = totalTransactions > 0 ? totalSpent / totalTransactions : 0;

            const chartData = categoryData.map(week => ({
              week: new Date(week.week_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
              'Total Spent': parseFloat(week.total_spent.toFixed(2)),
              '# Transactions': week.transaction_count,
              'Avg Transaction': parseFloat(week.avg_transaction.toFixed(2)),
            }));

            return (
              <>
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">
                    {selectedCategory} - Summary
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Total Spent</p>
                      <p className="text-2xl font-bold text-purple-600">
                        ${totalSpent.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Transactions</p>
                      <p className="text-2xl font-bold text-green-600">
                        {totalTransactions}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Avg Transaction</p>
                      <p className="text-2xl font-bold text-orange-600">
                        ${overallAvg.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Active Weeks</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {activeWeeks}/{data.dateRange.weekCount}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Category Chart */}
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Weekly Spending Pattern
                  </h3>
                  <div className="h-96">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={chartData}
                        margin={{ top: 20, right: 60, left: 20, bottom: 60 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis 
                          dataKey="week" 
                          angle={-45}
                          textAnchor="end"
                          height={80}
                          tick={{ fontSize: 12 }}
                        />
                        <YAxis 
                          yAxisId="left" 
                          label={{ value: 'Total Spent ($)', angle: -90, position: 'insideLeft' }}
                          tick={{ fontSize: 12 }}
                        />
                        <YAxis 
                          yAxisId="right" 
                          orientation="right"
                          label={{ value: '# Transactions', angle: 90, position: 'insideRight' }}
                          tick={{ fontSize: 12 }}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend 
                          wrapperStyle={{ paddingTop: '20px' }}
                          iconType="circle"
                        />
                        <Bar 
                          yAxisId="left" 
                          dataKey="Total Spent" 
                          fill="#9333ea" 
                          radius={[4, 4, 0, 0]}
                        />
                        <Line 
                          yAxisId="right" 
                          type="monotone"
                          dataKey="# Transactions" 
                          stroke="#10b981" 
                          strokeWidth={2}
                          dot={{ r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

