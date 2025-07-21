'use client';

import { useState, useEffect } from 'react';
import { createSupabaseClient } from '@/utils/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BouncingMoneyLoader } from '@/components/ui/bouncing-money-loader';

interface DashboardData {
  upcomingBills: Array<{
    id: number;
    merchant_name: string;
    ai_merchant_name: string;
    expected_amount: number;
    next_predicted_date: string;
    prediction_frequency: string;
  }>;
  activityTrend: Array<{
    date: string;
    transaction_count: number;
  }>;
  spendingTrend: Array<{
    date: string;
    total_amount: number;
  }>;
  merchantPacing: Array<{
    merchant_name: string;
    ai_merchant_name: string;
    status: 'green' | 'yellow' | 'red';
    percentage: number;
  }>;
  categoryPacing: Array<{
    category: string;
    status: 'green' | 'yellow' | 'red';
    percentage: number;
  }>;
  merchantSpending: Array<{
    merchant_name: string;
    ai_merchant_name: string;
    total_amount: number;
    percentage: number;
  }>;
  categorySpending: Array<{
    category: string;
    total_amount: number;
    percentage: number;
  }>;
}

export default function DashboardPage() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createSupabaseClient();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // For now, let's create some mock data to demonstrate the dashboard
      // In a real implementation, you'd fetch this from your APIs
      const mockData: DashboardData = {
        upcomingBills: [
          { id: 1, merchant_name: 'Netflix', ai_merchant_name: 'Netflix', expected_amount: 15.99, next_predicted_date: '2025-01-25', prediction_frequency: 'monthly' },
          { id: 2, merchant_name: 'Spotify', ai_merchant_name: 'Spotify', expected_amount: 9.99, next_predicted_date: '2025-01-26', prediction_frequency: 'monthly' },
          { id: 3, merchant_name: 'Amazon Prime', ai_merchant_name: 'Amazon Prime', expected_amount: 14.99, next_predicted_date: '2025-01-28', prediction_frequency: 'monthly' },
          { id: 4, merchant_name: 'Electric Company', ai_merchant_name: 'ConEd', expected_amount: 85.00, next_predicted_date: '2025-01-30', prediction_frequency: 'monthly' },
          { id: 5, merchant_name: 'Internet', ai_merchant_name: 'Verizon', expected_amount: 79.99, next_predicted_date: '2025-02-01', prediction_frequency: 'monthly' },
        ],
        activityTrend: [
          { date: '2025-01-15', transaction_count: 12 },
          { date: '2025-01-16', transaction_count: 8 },
          { date: '2025-01-17', transaction_count: 15 },
          { date: '2025-01-18', transaction_count: 6 },
          { date: '2025-01-19', transaction_count: 9 },
          { date: '2025-01-20', transaction_count: 14 },
          { date: '2025-01-21', transaction_count: 11 },
        ],
        spendingTrend: [
          { date: '2025-01-15', total_amount: 234.56 },
          { date: '2025-01-16', total_amount: 89.12 },
          { date: '2025-01-17', total_amount: 456.78 },
          { date: '2025-01-18', total_amount: 123.45 },
          { date: '2025-01-19', total_amount: 298.33 },
          { date: '2025-01-20', total_amount: 187.91 },
          { date: '2025-01-21', total_amount: 345.67 },
        ],
        merchantPacing: [
          { merchant_name: 'Amazon', ai_merchant_name: 'Amazon', status: 'red', percentage: 135 },
          { merchant_name: 'Starbucks', ai_merchant_name: 'Starbucks', status: 'yellow', percentage: 78 },
          { merchant_name: 'Grocery Store', ai_merchant_name: 'Whole Foods', status: 'green', percentage: 45 },
          { merchant_name: 'Gas Station', ai_merchant_name: 'Shell', status: 'green', percentage: 62 },
        ],
        categoryPacing: [
          { category: 'Dining', status: 'red', percentage: 120 },
          { category: 'Shopping', status: 'yellow', percentage: 85 },
          { category: 'Groceries', status: 'green', percentage: 55 },
          { category: 'Transportation', status: 'green', percentage: 40 },
        ],
        merchantSpending: [
          { merchant_name: 'Amazon', ai_merchant_name: 'Amazon', total_amount: 234.56, percentage: 35 },
          { merchant_name: 'Whole Foods', ai_merchant_name: 'Whole Foods', total_amount: 189.23, percentage: 28 },
          { merchant_name: 'Starbucks', ai_merchant_name: 'Starbucks', total_amount: 98.45, percentage: 15 },
          { merchant_name: 'Shell', ai_merchant_name: 'Shell', total_amount: 78.90, percentage: 12 },
          { merchant_name: 'Others', ai_merchant_name: 'Others', total_amount: 67.86, percentage: 10 },
        ],
        categorySpending: [
          { category: 'Shopping', total_amount: 298.45, percentage: 40 },
          { category: 'Groceries', total_amount: 223.67, percentage: 30 },
          { category: 'Dining', total_amount: 134.23, percentage: 18 },
          { category: 'Transportation', total_amount: 89.65, percentage: 12 },
        ],
      };

      setDashboardData(mockData);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getStatusColor = (status: 'green' | 'yellow' | 'red') => {
    switch (status) {
      case 'green': return 'text-green-600 bg-green-100';
      case 'yellow': return 'text-yellow-600 bg-yellow-100';
      case 'red': return 'text-red-600 bg-red-100';
    }
  };

  const getStatusBorder = (status: 'green' | 'yellow' | 'red') => {
    switch (status) {
      case 'green': return 'border-green-200';
      case 'yellow': return 'border-yellow-200';
      case 'red': return 'border-red-200';
    }
  };

  if (loading) {
    return <BouncingMoneyLoader />;
  }

  if (!dashboardData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p>Unable to load dashboard data.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">📊 Dashboard</h1>
        <p className="text-gray-600">Your financial snapshot at a glance</p>
      </div>

      {/* Grid Layout for Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        
        {/* Upcoming Bills Widget */}
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-100 border-blue-200 col-span-1 md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-blue-800 flex items-center gap-2">
              ⭐ Upcoming Bills
              <span className="text-sm font-normal text-blue-600">(Next 5)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dashboardData.upcomingBills.map((bill) => (
                <div key={bill.id} className="flex justify-between items-center p-3 bg-white rounded-lg shadow-sm">
                  <div>
                    <div className="font-medium text-gray-900">{bill.ai_merchant_name}</div>
                    <div className="text-sm text-gray-500">{formatDate(bill.next_predicted_date)} • {bill.prediction_frequency}</div>
                  </div>
                  <div className="text-lg font-bold text-blue-600">${bill.expected_amount.toFixed(2)}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Activity Trending */}
        <Card className="bg-gradient-to-br from-green-50 to-emerald-100 border-green-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-green-800">📈 Activity Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
                             {dashboardData.activityTrend.map((day) => (
                 <div key={day.date} className="flex justify-between items-center">
                   <span className="text-sm text-gray-600">{formatDate(day.date)}</span>
                   <div className="flex items-center gap-2">
                     <div 
                       className="bg-green-500 h-2 rounded"
                       style={{ width: `${(day.transaction_count / 15) * 60}px` }}
                     ></div>
                     <span className="text-sm font-medium text-green-700">{day.transaction_count}</span>
                   </div>
                 </div>
               ))}
            </div>
          </CardContent>
        </Card>

        {/* Spending Trending */}
        <Card className="bg-gradient-to-br from-purple-50 to-violet-100 border-purple-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-purple-800">💰 Spend Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {dashboardData.spendingTrend.map((day) => (
                <div key={day.date} className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">{formatDate(day.date)}</span>
                  <div className="flex items-center gap-2">
                    <div 
                      className="bg-purple-500 h-2 rounded"
                      style={{ width: `${(day.total_amount / 500) * 60}px` }}
                    ></div>
                    <span className="text-sm font-medium text-purple-700">${day.total_amount.toFixed(0)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Merchant Pacing */}
        <Card className="bg-gradient-to-br from-orange-50 to-amber-100 border-orange-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-orange-800">🏪 Merchant Pacing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dashboardData.merchantPacing.map((merchant, index) => (
                <div key={index} className={`p-3 rounded-lg border ${getStatusBorder(merchant.status)}`}>
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-900">{merchant.ai_merchant_name}</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(merchant.status)}`}>
                      {merchant.percentage}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Category Pacing */}
        <Card className="bg-gradient-to-br from-teal-50 to-cyan-100 border-teal-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-teal-800">🗂️ Category Pacing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dashboardData.categoryPacing.map((category, index) => (
                <div key={index} className={`p-3 rounded-lg border ${getStatusBorder(category.status)}`}>
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-900">{category.category}</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(category.status)}`}>
                      {category.percentage}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Merchant Spending Pie Chart */}
        <Card className="bg-gradient-to-br from-rose-50 to-pink-100 border-rose-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-rose-800">🥧 Merchant Spending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {dashboardData.merchantSpending.map((merchant, index) => (
                <div key={index} className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div 
                      className={`w-3 h-3 rounded`}
                      style={{ backgroundColor: `hsl(${index * 60}, 70%, 60%)` }}
                    ></div>
                    <span className="text-sm text-gray-700">{merchant.ai_merchant_name}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">${merchant.total_amount.toFixed(0)}</div>
                    <div className="text-xs text-gray-500">{merchant.percentage}%</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Category Spending Pie Chart */}
        <Card className="bg-gradient-to-br from-slate-50 to-gray-100 border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-slate-800">📊 Category Spending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {dashboardData.categorySpending.map((category, index) => (
                <div key={index} className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div 
                      className={`w-3 h-3 rounded`}
                      style={{ backgroundColor: `hsl(${index * 90 + 180}, 70%, 60%)` }}
                    ></div>
                    <span className="text-sm text-gray-700">{category.category}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">${category.total_amount.toFixed(0)}</div>
                    <div className="text-xs text-gray-500">{category.percentage}%</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
} 