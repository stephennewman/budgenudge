'use client';

import { useState, useEffect, useCallback } from 'react';
import { createSupabaseClient } from '@/utils/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Transaction {
  id: string;
  name: string;
  merchant_name: string | null;
  amount: number;
  date: string;
  category: string[];
  pending: boolean;
}

interface WeeklySpending {
  merchant: string;
  totalSpent: number;
  transactionCount: number;
  weeklyBreakdown: {
    weekStart: string;
    weekEnd: string;
    amount: number;
    transactions: number;
  }[];
}

export default function WeeklySpendingDashboard() {
  const [weeklySpending, setWeeklySpending] = useState<WeeklySpending[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('12'); // weeks
  const supabase = createSupabaseClient();

  function getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day; // First day of week (Sunday = 0)
    return new Date(d.setDate(diff));
  }

  function formatDateRange(start: Date, end: Date): string {
    const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${startStr} - ${endStr}`;
  }

  const analyzeWeeklySpending = useCallback((transactions: Transaction[]) => {
    const weeks = parseInt(timeRange);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - (weeks * 7));

    // Filter transactions to only include spending (positive amounts) within time range
    const spendingTransactions = transactions.filter(t => {
      const transactionDate = new Date(t.date);
      return t.amount > 0 && transactionDate >= cutoffDate;
    });

    // Group by merchant
    const merchantData = new Map<string, {
      totalSpent: number;
      transactionCount: number;
      weeklyBreakdown: Map<string, { amount: number; transactions: number; weekStart: Date; weekEnd: Date }>;
    }>();

    spendingTransactions.forEach(transaction => {
      const merchant = transaction.merchant_name || transaction.name || 'Unknown Merchant';
      const transactionDate = new Date(transaction.date);
      const weekStart = getWeekStart(transactionDate);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const weekKey = weekStart.toISOString().split('T')[0];

      if (!merchantData.has(merchant)) {
        merchantData.set(merchant, {
          totalSpent: 0,
          transactionCount: 0,
          weeklyBreakdown: new Map()
        });
      }

      const data = merchantData.get(merchant)!;
      data.totalSpent += transaction.amount;
      data.transactionCount += 1;

      if (!data.weeklyBreakdown.has(weekKey)) {
        data.weeklyBreakdown.set(weekKey, {
          amount: 0,
          transactions: 0,
          weekStart,
          weekEnd
        });
      }

      const weekData = data.weeklyBreakdown.get(weekKey)!;
      weekData.amount += transaction.amount;
      weekData.transactions += 1;
    });

    // Convert to array and sort by total spending (highest to lowest)
    const result: WeeklySpending[] = Array.from(merchantData.entries())
      .map(([merchant, data]) => ({
        merchant,
        totalSpent: data.totalSpent,
        transactionCount: data.transactionCount,
        weeklyBreakdown: Array.from(data.weeklyBreakdown.values())
          .map(week => ({
            weekStart: week.weekStart.toISOString().split('T')[0],
            weekEnd: week.weekEnd.toISOString().split('T')[0],
            amount: week.amount,
            transactions: week.transactions
          }))
          .sort((a, b) => new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime())
      }))
      .sort((a, b) => b.totalSpent - a.totalSpent);

    setWeeklySpending(result);
  }, [timeRange]);

  const fetchTransactions = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/plaid/transactions', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        analyzeWeeklySpending(data.transactions || []);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [supabase.auth, analyzeWeeklySpending]);

  useEffect(() => {
    fetchTransactions();
  }, [timeRange, fetchTransactions]);

  const totalSpending = weeklySpending.reduce((sum, merchant) => sum + merchant.totalSpent, 0);
  const totalTransactions = weeklySpending.reduce((sum, merchant) => sum + merchant.transactionCount, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading weekly spending analysis...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">📊 Weekly Spending Analysis</h1>
        <select 
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          className="px-3 py-2 border rounded-md bg-background"
        >
          <option value="4">Last 4 weeks</option>
          <option value="8">Last 8 weeks</option>
          <option value="12">Last 12 weeks</option>
          <option value="24">Last 6 months</option>
          <option value="52">Last year</option>
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Total Spending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">${totalSpending.toFixed(2)}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Total Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTransactions}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Unique Merchants</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{weeklySpending.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Merchant Rankings */}
      <Card>
        <CardHeader>
          <CardTitle>Merchants Ranked by Total Spending (Last {timeRange} weeks)</CardTitle>
        </CardHeader>
        <CardContent>
          {weeklySpending.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No spending data found for the selected time period.
            </div>
          ) : (
            <div className="space-y-4">
              {weeklySpending.map((merchant, index) => (
                <div key={merchant.merchant} className="border rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-800 rounded-full font-bold text-sm">
                        #{index + 1}
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{merchant.merchant}</h3>
                        <p className="text-sm text-muted-foreground">
                          {merchant.transactionCount} transaction{merchant.transactionCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-red-600">
                        ${merchant.totalSpent.toFixed(2)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {((merchant.totalSpent / totalSpending) * 100).toFixed(1)}% of total
                      </div>
                    </div>
                  </div>
                  
                  {/* Weekly Chart and Breakdown */}
                  <div className="bg-gray-50 dark:bg-gray-900 rounded p-4 space-y-4">
                    {merchant.weeklyBreakdown.length === 0 ? (
                      <div className="text-sm text-muted-foreground">No transactions this period</div>
                    ) : (
                      <>
                        {/* Weekly Spending Chart */}
                        <div>
                          <h4 className="font-medium mb-3 text-sm">📈 Weekly Spending Trend</h4>
                          <div className="relative h-32 bg-white dark:bg-gray-800 rounded-lg p-3 border">
                            <svg className="w-full h-full" viewBox="0 0 400 100">
                              {/* Chart background grid */}
                              <defs>
                                <pattern id={`grid-${index}`} width="50" height="25" patternUnits="userSpaceOnUse">
                                  <path d="M 50 0 L 0 0 0 25" fill="none" stroke="#e5e7eb" strokeWidth="0.5"/>
                                </pattern>
                                <linearGradient id={`gradient-${index}`} x1="0%" y1="0%" x2="0%" y2="100%">
                                  <stop offset="0%" style={{stopColor: '#3b82f6', stopOpacity: 0.3}} />
                                  <stop offset="100%" style={{stopColor: '#3b82f6', stopOpacity: 0}} />
                                </linearGradient>
                              </defs>
                              <rect width="100%" height="100%" fill={`url(#grid-${index})`} />
                              
                              {/* Chart line and area */}
                              {(() => {
                                // Sort weeks chronologically for proper chart display
                                const sortedWeeks = [...merchant.weeklyBreakdown].sort((a, b) => 
                                  new Date(a.weekStart).getTime() - new Date(b.weekStart).getTime()
                                );
                                
                                if (sortedWeeks.length === 0) return null;
                                
                                const maxAmount = Math.max(...sortedWeeks.map(w => w.amount));
                                const minAmount = Math.min(...sortedWeeks.map(w => w.amount));
                                const range = maxAmount - minAmount || maxAmount || 1;
                                
                                const points = sortedWeeks.map((week, index) => {
                                  const x = (index / Math.max(sortedWeeks.length - 1, 1)) * 360 + 20;
                                  const y = 80 - ((week.amount - minAmount) / range) * 60;
                                  return { x, y, amount: week.amount, week };
                                });
                                
                                const pathData = points.map((point, index) => 
                                  `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
                                ).join(' ');
                                
                                const areaData = `${pathData} L ${points[points.length - 1]?.x || 0} 80 L 20 80 Z`;
                                
                                return (
                                  <>
                                    {/* Area fill */}
                                    <path 
                                      d={areaData} 
                                      fill={`url(#gradient-${index})`}
                                    />
                                    {/* Line */}
                                    <path 
                                      d={pathData} 
                                      fill="none" 
                                      stroke="#3b82f6" 
                                      strokeWidth="2"
                                      className="drop-shadow-sm"
                                    />
                                    {/* Points */}
                                    {points.map((point, pointIndex) => (
                                      <g key={pointIndex}>
                                        <circle 
                                          cx={point.x} 
                                          cy={point.y} 
                                          r="3" 
                                          fill="#3b82f6"
                                          stroke="white"
                                          strokeWidth="1"
                                          className="drop-shadow-sm"
                                        />
                                        <title>${point.amount.toFixed(2)} - Week of {new Date(point.week.weekStart).toLocaleDateString()}</title>
                                      </g>
                                    ))}
                                    
                                    {/* Y-axis labels */}
                                    <text x="5" y="15" fontSize="10" fill="#6b7280" textAnchor="start">
                                      ${maxAmount.toFixed(0)}
                                    </text>
                                    <text x="5" y="85" fontSize="10" fill="#6b7280" textAnchor="start">
                                      ${minAmount.toFixed(0)}
                                    </text>
                                  </>
                                );
                              })()}
                            </svg>
                          </div>
                        </div>

                        {/* Weekly Breakdown Table */}
                        <div>
                          <h4 className="font-medium mb-2 text-sm">📋 Weekly Breakdown</h4>
                          <div className="grid gap-2 max-h-40 overflow-y-auto">
                            {merchant.weeklyBreakdown.map((week) => (
                              <div key={week.weekStart} className="flex justify-between items-center text-sm py-1 px-2 hover:bg-white dark:hover:bg-gray-700 rounded">
                                <span className="text-muted-foreground">
                                  {formatDateRange(new Date(week.weekStart), new Date(week.weekEnd))}
                                </span>
                                <div className="flex gap-4">
                                  <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                                    {week.transactions} txn{week.transactions !== 1 ? 's' : ''}
                                  </span>
                                  <span className="font-medium text-red-600 dark:text-red-400 min-w-[60px] text-right">
                                    ${week.amount.toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 