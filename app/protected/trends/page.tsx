'use client';

import { useState, useEffect, useCallback } from 'react';
import { createSupabaseClient } from '@/utils/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ContentAreaLoader } from '@/components/ui/content-area-loader';

interface MerchantTimeSeries {
  name: string;
  weeklyData: Array<{period: string; amount: number; count: number}>;
  monthlyData: Array<{period: string; amount: number; count: number}>;
  totalAmount: number;
  totalTransactions: number;
}

interface CategoryTimeSeries {
  name: string;
  weeklyData: Array<{period: string; amount: number; count: number}>;
  monthlyData: Array<{period: string; amount: number; count: number}>;
  totalAmount: number;
  totalTransactions: number;
}

interface HistoricalTrendsData {
  merchants: MerchantTimeSeries[];
  categories: CategoryTimeSeries[];
  firstTransactionDate: string;
  lastTransactionDate: string;
}

export default function TrendsPage() {
  const [trendsData, setTrendsData] = useState<HistoricalTrendsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('weekly-merchants');

  const supabase = createSupabaseClient();

  const fetchTrendsData = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log('No session found');
        return;
      }

      console.log('Fetching trends data...');
      const response = await fetch('/api/trends', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Trends data received:', data);
        setTrendsData(data);
      } else {
        const errorData = await response.json();
        console.error('Failed to fetch trends data:', response.status, errorData);
      }
    } catch (error) {
      console.error('Error fetching trends data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchTrendsData();
  }, [fetchTrendsData]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatWeekLabel = (period: string) => {
    // Convert "2025-03-24" to "Mar 24" or "W12"
    const date = new Date(period);
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();
    return `${month} ${day}`;
  };

  const formatMonthLabel = (period: string) => {
    // Convert "2025-03" to "Mar" or "Mar 2025"
    const [year, month] = period.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { month: 'short' });
  };


  if (isLoading) {
    return (
      <div className="relative min-h-[600px]">
        <ContentAreaLoader />
      </div>
    );
  }

  if (!trendsData) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Failed to load trends data</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <h1 className="text-2xl font-medium text-left">📈 Trends</h1>
            <p className="text-muted-foreground text-left">
              Track your spending patterns over time
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="weekly-merchants">Weekly Merchants</TabsTrigger>
          <TabsTrigger value="monthly-merchants">Monthly Merchants</TabsTrigger>
          <TabsTrigger value="weekly-categories">Weekly Categories</TabsTrigger>
          <TabsTrigger value="monthly-categories">Monthly Categories</TabsTrigger>
        </TabsList>

        <TabsContent value="weekly-merchants" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Weekly Merchant Trends</CardTitle>
              <p className="text-sm text-muted-foreground">
                Individual spending charts for each merchant over time
              </p>
            </CardHeader>
            <CardContent>
              <MerchantCharts 
                merchants={trendsData.merchants} 
                formatCurrency={formatCurrency}
                formatWeekLabel={formatWeekLabel}
                formatMonthLabel={formatMonthLabel}
                type="weekly"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monthly-merchants" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Merchant Trends</CardTitle>
              <p className="text-sm text-muted-foreground">
                Individual spending charts for each merchant over time
              </p>
            </CardHeader>
            <CardContent>
              <MerchantCharts 
                merchants={trendsData.merchants} 
                formatCurrency={formatCurrency}
                formatWeekLabel={formatWeekLabel}
                formatMonthLabel={formatMonthLabel}
                type="monthly"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="weekly-categories" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Weekly Category Trends</CardTitle>
              <p className="text-sm text-muted-foreground">
                Individual spending charts for each category over time
              </p>
            </CardHeader>
            <CardContent>
              <CategoryCharts 
                categories={trendsData.categories} 
                formatCurrency={formatCurrency}
                formatWeekLabel={formatWeekLabel}
                formatMonthLabel={formatMonthLabel}
                type="weekly"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monthly-categories" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Category Trends</CardTitle>
              <p className="text-sm text-muted-foreground">
                Individual spending charts for each category over time
              </p>
            </CardHeader>
            <CardContent>
              <CategoryCharts 
                categories={trendsData.categories} 
                formatCurrency={formatCurrency}
                formatWeekLabel={formatWeekLabel}
                formatMonthLabel={formatMonthLabel}
                type="monthly"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface MerchantChartsProps {
  merchants: MerchantTimeSeries[];
  formatCurrency: (amount: number) => string;
  formatWeekLabel: (period: string) => string;
  formatMonthLabel: (period: string) => string;
  type: 'weekly' | 'monthly';
}

function MerchantCharts({ merchants, formatCurrency, formatWeekLabel, formatMonthLabel, type }: MerchantChartsProps) {
  if (merchants.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">No merchant data available</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {merchants.map((merchant) => (
        <IndividualChart
          key={merchant.name}
          name={merchant.name}
          data={type === 'weekly' ? merchant.weeklyData : merchant.monthlyData}
          totalAmount={merchant.totalAmount}
          totalTransactions={merchant.totalTransactions}
          formatCurrency={formatCurrency}
          formatWeekLabel={formatWeekLabel}
          formatMonthLabel={formatMonthLabel}
          type={type}
        />
      ))}
    </div>
  );
}

interface CategoryChartsProps {
  categories: CategoryTimeSeries[];
  formatCurrency: (amount: number) => string;
  formatWeekLabel: (period: string) => string;
  formatMonthLabel: (period: string) => string;
  type: 'weekly' | 'monthly';
}

function CategoryCharts({ categories, formatCurrency, formatWeekLabel, formatMonthLabel, type }: CategoryChartsProps) {
  if (categories.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">No category data available</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {categories.map((category) => (
        <IndividualChart
          key={category.name}
          name={category.name}
          data={type === 'weekly' ? category.weeklyData : category.monthlyData}
          totalAmount={category.totalAmount}
          totalTransactions={category.totalTransactions}
          formatCurrency={formatCurrency}
          formatWeekLabel={formatWeekLabel}
          formatMonthLabel={formatMonthLabel}
          type={type}
        />
      ))}
    </div>
  );
}

interface IndividualChartProps {
  name: string;
  data: Array<{period: string; amount: number; count: number}>;
  totalAmount: number;
  totalTransactions: number;
  formatCurrency: (amount: number) => string;
  formatWeekLabel: (period: string) => string;
  formatMonthLabel: (period: string) => string;
  type: 'weekly' | 'monthly';
}

function IndividualChart({ name, data, totalAmount, totalTransactions, formatCurrency, formatWeekLabel, formatMonthLabel, type }: IndividualChartProps) {
  if (data.length === 0) {
    return null;
  }

  const maxAmount = Math.max(...data.map(d => d.amount));
  const maxHeight = 120;

  return (
    <div className="border rounded-lg p-6">
      <div className="mb-4">
        <h3 className="font-medium text-xl">{name}</h3>
        <div className="text-sm text-muted-foreground">
          Total: {formatCurrency(totalAmount)} • {totalTransactions} transactions
        </div>
      </div>
      
      <div className="flex items-end space-x-1 h-40 border-b border-l">
        {data.map((period) => {
          const height = maxAmount > 0 ? (period.amount / maxAmount) * maxHeight : 0;
          const isSpike = period.amount > 0 && period.amount > (maxAmount * 0.7);
          
          return (
            <div key={period.period} className="flex-1 flex flex-col items-center group relative">
              <div 
                className={`w-full rounded-t transition-all duration-200 ${
                  isSpike 
                    ? 'bg-red-500 hover:bg-red-600' 
                    : period.amount > 0 
                      ? 'bg-blue-500 hover:bg-blue-600' 
                      : 'bg-gray-200'
                }`}
                style={{ height: `${height}px` }}
                title={`${period.period}: ${formatCurrency(period.amount)} (${period.count} transactions)`}
              />
              
              {/* Period label */}
              <div className="text-xs text-muted-foreground mt-1 transform -rotate-45 origin-left">
                {type === 'weekly' 
                  ? formatWeekLabel(period.period)
                  : formatMonthLabel(period.period)
                }
              </div>
              
              {/* Tooltip on hover */}
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                {period.period}: {formatCurrency(period.amount)}
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="flex justify-between text-xs text-muted-foreground mt-2">
        <span>$0</span>
        <span>{formatCurrency(maxAmount)}</span>
      </div>
    </div>
  );
}
