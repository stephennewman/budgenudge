'use client';

import { useState, useEffect, useCallback } from 'react';
import { createSupabaseClient } from '@/utils/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ContentAreaLoader } from '@/components/ui/content-area-loader';

interface TimeSeriesData {
  period: string; // "2025-02-01" or "2025-W06"
  amount: number;
  transactionCount: number;
  merchants: Array<{name: string; amount: number; count: number}>;
  categories: Array<{name: string; amount: number; count: number}>;
}

interface HistoricalTrendsData {
  weeklyData: TimeSeriesData[];
  monthlyData: TimeSeriesData[];
  firstTransactionDate: string;
  lastTransactionDate: string;
}

export default function TrendsPage() {
  const [trendsData, setTrendsData] = useState<HistoricalTrendsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('weekly-chart');

  const supabase = createSupabaseClient();

  const fetchTrendsData = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/trends', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setTrendsData(data);
      } else {
        console.error('Failed to fetch trends data');
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
          <TabsTrigger value="weekly-chart">Weekly Chart</TabsTrigger>
          <TabsTrigger value="monthly-chart">Monthly Chart</TabsTrigger>
          <TabsTrigger value="weekly-details">Weekly Details</TabsTrigger>
          <TabsTrigger value="monthly-details">Monthly Details</TabsTrigger>
        </TabsList>

        <TabsContent value="weekly-chart" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Weekly Spending Over Time</CardTitle>
              <p className="text-sm text-muted-foreground">
                Historical weekly spending patterns
              </p>
            </CardHeader>
            <CardContent>
              <HistoricalChart 
                data={trendsData.weeklyData} 
                formatCurrency={formatCurrency}
                type="weekly"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monthly-chart" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Spending Over Time</CardTitle>
              <p className="text-sm text-muted-foreground">
                Historical monthly spending patterns
              </p>
            </CardHeader>
            <CardContent>
              <HistoricalChart 
                data={trendsData.monthlyData} 
                formatCurrency={formatCurrency}
                type="monthly"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="weekly-details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Weekly Spending Details</CardTitle>
              <p className="text-sm text-muted-foreground">
                Week-by-week breakdown with top merchants and categories
              </p>
            </CardHeader>
            <CardContent>
              <HistoricalDetails 
                data={trendsData.weeklyData} 
                formatCurrency={formatCurrency}
                type="weekly"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monthly-details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Spending Details</CardTitle>
              <p className="text-sm text-muted-foreground">
                Month-by-month breakdown with top merchants and categories
              </p>
            </CardHeader>
            <CardContent>
              <HistoricalDetails 
                data={trendsData.monthlyData} 
                formatCurrency={formatCurrency}
                type="monthly"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface HistoricalChartProps {
  data: TimeSeriesData[];
  formatCurrency: (amount: number) => string;
  type: 'weekly' | 'monthly';
}

function HistoricalChart({ data, formatCurrency, type }: HistoricalChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">No data available</div>
      </div>
    );
  }

  const maxAmount = Math.max(...data.map(d => d.amount));
  const maxHeight = 200;

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        {type === 'weekly' ? 'Weekly' : 'Monthly'} spending from {data[0]?.period} to {data[data.length - 1]?.period}
      </div>
      
      <div className="flex items-end space-x-1 h-48 border-b border-l">
        {data.map((period) => {
          const height = maxAmount > 0 ? (period.amount / maxAmount) * maxHeight : 0;
          const isSpike = period.amount > 0 && period.amount > (maxAmount * 0.5);
          
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
                title={`${period.period}: ${formatCurrency(period.amount)} (${period.transactionCount} transactions)`}
              />
              
              {/* Period label */}
              <div className="text-xs text-muted-foreground mt-1 transform -rotate-45 origin-left">
                {type === 'weekly' 
                  ? period.period.split('-W')[1] 
                  : period.period.split('-')[1]
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
      
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>${formatCurrency(0)}</span>
        <span>{formatCurrency(maxAmount)}</span>
      </div>
    </div>
  );
}

interface HistoricalDetailsProps {
  data: TimeSeriesData[];
  formatCurrency: (amount: number) => string;
  type: 'weekly' | 'monthly';
}

function HistoricalDetails({ data, formatCurrency }: HistoricalDetailsProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">No data available</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {data.map((period) => (
        <div key={period.period} className="border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">{period.period}</h3>
            <div className="text-right">
              <div className="font-medium">{formatCurrency(period.amount)}</div>
              <div className="text-sm text-muted-foreground">
                {period.transactionCount} transaction{period.transactionCount !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
          
          {period.amount > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Top Merchants */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Top Merchants</h4>
                <div className="space-y-1">
                  {period.merchants.slice(0, 3).map((merchant) => (
                    <div key={merchant.name} className="flex justify-between text-sm">
                      <span className="truncate">{merchant.name}</span>
                      <span className="font-medium">{formatCurrency(merchant.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Top Categories */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Top Categories</h4>
                <div className="space-y-1">
                  {period.categories.slice(0, 3).map((category) => (
                    <div key={category.name} className="flex justify-between text-sm">
                      <span className="truncate">{category.name}</span>
                      <span className="font-medium">{formatCurrency(category.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
