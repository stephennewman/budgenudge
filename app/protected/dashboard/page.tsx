'use client';

import { useState, useEffect } from 'react';
import { createSupabaseClient } from '@/utils/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BouncingMoneyLoader } from '@/components/ui/bouncing-money-loader';

interface DashboardData {
  upcomingBills: Array<{
    id: number;
    merchant_name: string;
    ai_merchant_name?: string;
    expected_amount: number;
    next_predicted_date: string;
    prediction_frequency: string;
  }>;
  recentTransactions: Array<{
    id: string;
    date: string;
    merchant_name: string;
    ai_merchant_name?: string;
    amount: number;
    ai_category_tag?: string;
  }>;
  monthlySpend: {
    current: number;
    lastMonth: number;
    change: number;
  };
  categoryPacing: Array<{
    category: string;
    current_spent: number;
    monthly_budget: number;
    status: 'green' | 'yellow' | 'red';
    percentage: number;
  }>;
  merchantPacing: Array<{
    merchant_name: string;
    ai_merchant_name?: string;
    current_spent: number;
    expected_amount: number;
    status: 'green' | 'yellow' | 'red';
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

      // Fetch upcoming bills (tagged merchants)
      const billsResponse = await fetch('/api/tagged-merchants');
      const billsData = await billsResponse.json();
      
      // Fetch recent transactions
      const transactionsResponse = await fetch('/api/plaid/transactions');
      const transactionsData = await transactionsResponse.json();
      
      // Fetch category pacing
      const categoryPacingResponse = await fetch('/api/category-pacing-tracking');
      const categoryPacingData = await categoryPacingResponse.json();

      // Fetch merchant pacing  
      const merchantPacingResponse = await fetch('/api/merchant-pacing-tracking');
      const merchantPacingData = await merchantPacingResponse.json();

      // Calculate monthly spend from recent transactions
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

             const allTransactions = transactionsData.transactions || [];
       
       const currentMonthSpend = allTransactions
         .filter((tx: { date: string; amount: number }) => new Date(tx.date) >= startOfMonth && tx.amount < 0)
         .reduce((sum: number, tx: { amount: number }) => sum + Math.abs(tx.amount), 0);
       
       const lastMonthSpend = allTransactions
         .filter((tx: { date: string; amount: number }) => {
           const txDate = new Date(tx.date);
           return txDate >= startOfLastMonth && txDate <= endOfLastMonth && tx.amount < 0;
         })
         .reduce((sum: number, tx: { amount: number }) => sum + Math.abs(tx.amount), 0);

      const spendChange = lastMonthSpend > 0 ? ((currentMonthSpend - lastMonthSpend) / lastMonthSpend) * 100 : 0;

             const processedData: DashboardData = {
         upcomingBills: (billsData.taggedMerchants || [])
           .filter((merchant: { is_active: boolean }) => merchant.is_active)
           .sort((a: { next_predicted_date: string }, b: { next_predicted_date: string }) => 
             new Date(a.next_predicted_date).getTime() - new Date(b.next_predicted_date).getTime())
           .slice(0, 3),
         recentTransactions: (allTransactions || [])
           .filter((tx: { amount: number }) => tx.amount < 0)
           .slice(0, 4),
        monthlySpend: {
          current: currentMonthSpend,
          lastMonth: lastMonthSpend,
          change: spendChange
        },
                 categoryPacing: (categoryPacingData.tracked_categories || [])
           .map((cat: { category: string; current_spent: number; monthly_budget: number }) => ({
             category: cat.category,
             current_spent: cat.current_spent || 0,
             monthly_budget: cat.monthly_budget || 0,
             percentage: cat.monthly_budget > 0 ? (cat.current_spent / cat.monthly_budget) * 100 : 0,
             status: cat.monthly_budget > 0 ? 
               (cat.current_spent / cat.monthly_budget > 1 ? 'red' as const : 
                cat.current_spent / cat.monthly_budget > 0.8 ? 'yellow' as const : 'green' as const) : 'green' as const
           }))
           .slice(0, 3),
         merchantPacing: (merchantPacingData.tracked_merchants || [])
           .map((merchant: { merchant_name: string; ai_merchant_name?: string; current_spent: number; expected_amount: number }) => ({
             merchant_name: merchant.merchant_name,
             ai_merchant_name: merchant.ai_merchant_name,
             current_spent: merchant.current_spent || 0,
             expected_amount: merchant.expected_amount || 0,
             percentage: merchant.expected_amount > 0 ? (merchant.current_spent / merchant.expected_amount) * 100 : 0,
             status: merchant.expected_amount > 0 ? 
               (merchant.current_spent / merchant.expected_amount > 1 ? 'red' as const : 
                merchant.current_spent / merchant.expected_amount > 0.8 ? 'yellow' as const : 'green' as const) : 'green' as const
           }))
           .slice(0, 3)
      };

      setDashboardData(processedData);
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
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">📊 Dashboard</h1>
        <p className="text-gray-600 text-sm">Your financial snapshot</p>
      </div>

      {/* Compact Grid Layout - Focus on Above the Fold */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Monthly Spend Summary */}
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-blue-800 text-sm">💰 This Month</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-xl font-bold text-blue-900">${dashboardData.monthlySpend.current.toFixed(0)}</div>
            <div className="text-xs text-blue-600">
              {dashboardData.monthlySpend.change > 0 ? '↗' : '↘'} {Math.abs(dashboardData.monthlySpend.change).toFixed(0)}% vs last month
            </div>
          </CardContent>
        </Card>

        {/* Next Bills */}
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-purple-800 text-sm">⭐ Next Bills</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
                         {dashboardData.upcomingBills.slice(0, 2).map((bill) => (
              <div key={bill.id} className="flex justify-between text-xs">
                <span className="truncate">{bill.ai_merchant_name || bill.merchant_name}</span>
                <span className="font-medium">${bill.expected_amount.toFixed(0)}</span>
              </div>
            ))}
            {dashboardData.upcomingBills.length === 0 && (
              <div className="text-xs text-gray-500">No upcoming bills</div>
            )}
          </CardContent>
        </Card>

        {/* Category Pacing */}
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-green-800 text-sm">🗂️ Category Pace</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
                         {dashboardData.categoryPacing.slice(0, 2).map((cat, index) => (
               <div key={`cat-${index}`} className="flex justify-between items-center text-xs">
                 <span className="truncate">{cat.category}</span>
                 <span className={`px-1 py-0.5 rounded text-xs ${getStatusColor(cat.status)}`}>
                   {cat.percentage.toFixed(0)}%
                 </span>
               </div>
             ))}
            {dashboardData.categoryPacing.length === 0 && (
              <div className="text-xs text-gray-500">No tracking active</div>
            )}
          </CardContent>
        </Card>

        {/* Merchant Pacing */}
        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-orange-800 text-sm">🏪 Merchant Pace</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
                         {dashboardData.merchantPacing.slice(0, 2).map((merchant, index) => (
               <div key={`merchant-${index}`} className="flex justify-between items-center text-xs">
                 <span className="truncate">{merchant.ai_merchant_name || merchant.merchant_name}</span>
                 <span className={`px-1 py-0.5 rounded text-xs ${getStatusColor(merchant.status)}`}>
                   {merchant.percentage.toFixed(0)}%
                 </span>
               </div>
             ))}
            {dashboardData.merchantPacing.length === 0 && (
              <div className="text-xs text-gray-500">No tracking active</div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* Recent Activity Section - More compact */}
      <div className="mt-6">
        <Card className="bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-gray-800 text-sm">📈 Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
                             {dashboardData.recentTransactions.map((tx) => (
                 <div key={tx.id} className="flex justify-between items-center text-xs py-1 border-b border-gray-200 last:border-b-0">
                  <div className="flex-1 truncate">
                    <span className="font-medium">{tx.ai_merchant_name || tx.merchant_name}</span>
                    {tx.ai_category_tag && (
                      <span className="ml-2 text-gray-500">• {tx.ai_category_tag}</span>
                    )}
                  </div>
                  <div className="text-right ml-2">
                    <div className="font-medium">${Math.abs(tx.amount).toFixed(2)}</div>
                    <div className="text-gray-500">{formatDate(tx.date)}</div>
                  </div>
                </div>
              ))}
              {dashboardData.recentTransactions.length === 0 && (
                <div className="text-xs text-gray-500 text-center py-2">No recent transactions</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 