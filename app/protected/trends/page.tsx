'use client';

import { useState, useEffect, useCallback } from 'react';
import { createSupabaseClient } from '@/utils/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ContentAreaLoader } from '@/components/ui/content-area-loader';

interface TrendData {
  name: string;
  amount: number;
  change?: number;
  transactionCount: number;
}

interface TrendsData {
  weeklyMerchants: TrendData[];
  monthlyMerchants: TrendData[];
  weeklyCategories: TrendData[];
  monthlyCategories: TrendData[];
}

export default function TrendsPage() {
  const [trendsData, setTrendsData] = useState<TrendsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('weekly-merchants');

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

  const formatChange = (change?: number) => {
    if (change === undefined) return '';
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(1)}%`;
  };

  const getChangeColor = (change?: number) => {
    if (change === undefined) return 'text-muted-foreground';
    return change >= 0 ? 'text-red-600' : 'text-green-600';
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
          <TabsTrigger value="weekly-merchants">Weekly by Merchant</TabsTrigger>
          <TabsTrigger value="monthly-merchants">Monthly by Merchant</TabsTrigger>
          <TabsTrigger value="weekly-categories">Weekly by Category</TabsTrigger>
          <TabsTrigger value="monthly-categories">Monthly by Category</TabsTrigger>
        </TabsList>

        <TabsContent value="weekly-merchants" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Weekly Spending by Merchant</CardTitle>
              <p className="text-sm text-muted-foreground">
                Top merchants by spending this week
              </p>
            </CardHeader>
            <CardContent>
              <TrendsList 
                data={trendsData.weeklyMerchants} 
                formatCurrency={formatCurrency}
                formatChange={formatChange}
                getChangeColor={getChangeColor}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monthly-merchants" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Spending by Merchant</CardTitle>
              <p className="text-sm text-muted-foreground">
                Top merchants by spending this month
              </p>
            </CardHeader>
            <CardContent>
              <TrendsList 
                data={trendsData.monthlyMerchants} 
                formatCurrency={formatCurrency}
                formatChange={formatChange}
                getChangeColor={getChangeColor}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="weekly-categories" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Weekly Spending by Category</CardTitle>
              <p className="text-sm text-muted-foreground">
                Top categories by spending this week
              </p>
            </CardHeader>
            <CardContent>
              <TrendsList 
                data={trendsData.weeklyCategories} 
                formatCurrency={formatCurrency}
                formatChange={formatChange}
                getChangeColor={getChangeColor}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monthly-categories" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Spending by Category</CardTitle>
              <p className="text-sm text-muted-foreground">
                Top categories by spending this month
              </p>
            </CardHeader>
            <CardContent>
              <TrendsList 
                data={trendsData.monthlyCategories} 
                formatCurrency={formatCurrency}
                formatChange={formatChange}
                getChangeColor={getChangeColor}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface TrendsListProps {
  data: TrendData[];
  formatCurrency: (amount: number) => string;
  formatChange: (change?: number) => string;
  getChangeColor: (change?: number) => string;
}

function TrendsList({ data, formatCurrency, formatChange, getChangeColor }: TrendsListProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">No data available</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((item, index) => (
        <div key={item.name} className="flex items-center justify-between p-3 rounded-lg border">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-medium text-sm">
              {index + 1}
            </div>
            <div>
              <div className="font-medium">{item.name}</div>
              <div className="text-sm text-muted-foreground">
                {item.transactionCount} transaction{item.transactionCount !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="font-medium">{formatCurrency(item.amount)}</div>
            {item.change !== undefined && (
              <div className={`text-sm ${getChangeColor(item.change)}`}>
                {formatChange(item.change)}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
