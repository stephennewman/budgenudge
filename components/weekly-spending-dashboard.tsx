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

interface WeekData {
  weekStart: string;
  weekEnd: string;
  weekNumber: number;
  year: number;
  amount: number;
  transactions: number;
}

interface MerchantSpending {
  merchant: string;
  totalSpent: number;
  transactionCount: number;
  averageWeeklySpending: number;
  weeksWithSpending: number;
  forecastedMonthlySpending: number;
  weeklyBreakdown: WeekData[];
}

interface WeeklyAnalysis {
  merchants: MerchantSpending[];
  totalSpending: number;
  totalTransactions: number;
  totalWeeksAnalyzed: number;
}

export default function WeeklySpendingDashboard() {
  const [weeklyAnalysis, setWeeklyAnalysis] = useState<WeeklyAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('12'); // weeks
  const supabase = createSupabaseClient();

  // Get the start of a week (Sunday = 0)
  function getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    const weekStart = new Date(d.setDate(diff));
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
  }

  // Get week number in year (ISO 8601 style)
  function getWeekNumber(date: Date): { week: number; year: number } {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const week1 = new Date(d.getFullYear(), 0, 4);
    const week = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    return { week, year: d.getFullYear() };
  }

  // Generate all weeks in the time range
  function generateAllWeeks(weeksCount: number): WeekData[] {
    const weeks: WeekData[] = [];
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - (weeksCount * 7));

    let currentWeekStart = getWeekStart(startDate);
    const endWeekStart = getWeekStart(endDate);

    while (currentWeekStart <= endWeekStart) {
      const weekEnd = new Date(currentWeekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const { week: weekNumber, year } = getWeekNumber(currentWeekStart);

      weeks.push({
        weekStart: currentWeekStart.toISOString().split('T')[0],
        weekEnd: weekEnd.toISOString().split('T')[0],
        weekNumber,
        year,
        amount: 0,
        transactions: 0
      });

      // Move to next week
      currentWeekStart = new Date(currentWeekStart);
      currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    }

    return weeks.sort((a, b) => new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime());
  }

  // Analyze spending by merchant with complete week coverage
  const analyzeWeeklySpending = useCallback((transactions: Transaction[]) => {
    const weeks = parseInt(timeRange);
    const allWeeks = generateAllWeeks(weeks);

    // Filter to spending transactions only (positive amounts)
    const spendingTransactions = transactions.filter(t => t.amount > 0);

    // Group transactions by merchant
    const merchantMap = new Map<string, Transaction[]>();
    
    spendingTransactions.forEach(transaction => {
      const merchant = transaction.merchant_name || transaction.name || 'Unknown Merchant';
      if (!merchantMap.has(merchant)) {
        merchantMap.set(merchant, []);
      }
      merchantMap.get(merchant)!.push(transaction);
    });

    // Analyze each merchant with complete week coverage
    const merchantAnalysis: MerchantSpending[] = Array.from(merchantMap.entries()).map(([merchant, transactions]) => {
      // Create a fresh copy of all weeks for this merchant
      const merchantWeeks = allWeeks.map(week => ({
        ...week,
        amount: 0,
        transactions: 0
      }));

      // Populate weeks with this merchant's transactions
      transactions.forEach(transaction => {
        const transactionDate = new Date(transaction.date);
        const transactionWeekStart = getWeekStart(transactionDate);
        const weekKey = transactionWeekStart.toISOString().split('T')[0];

        const weekData = merchantWeeks.find(w => w.weekStart === weekKey);
        if (weekData) {
          weekData.amount += transaction.amount;
          weekData.transactions += 1;
        }
      });

      // Calculate merchant statistics
      const totalSpent = merchantWeeks.reduce((sum, week) => sum + week.amount, 0);
      const transactionCount = merchantWeeks.reduce((sum, week) => sum + week.transactions, 0);
      const weeksWithSpending = merchantWeeks.filter(w => w.amount > 0).length;
      const averageWeeklySpending = merchantWeeks.length > 0 ? totalSpent / merchantWeeks.length : 0;
      const forecastedMonthlySpending = (averageWeeklySpending * 52) / 12;

      return {
        merchant,
        totalSpent,
        transactionCount,
        averageWeeklySpending,
        weeksWithSpending,
        forecastedMonthlySpending,
        weeklyBreakdown: merchantWeeks
      };
    });

    // Sort merchants by total spending (highest to lowest)
    merchantAnalysis.sort((a, b) => b.totalSpent - a.totalSpent);

    // Calculate overall statistics
    const totalSpending = merchantAnalysis.reduce((sum, merchant) => sum + merchant.totalSpent, 0);
    const totalTransactions = merchantAnalysis.reduce((sum, merchant) => sum + merchant.transactionCount, 0);

    const analysis: WeeklyAnalysis = {
      merchants: merchantAnalysis,
      totalSpending,
      totalTransactions,
      totalWeeksAnalyzed: allWeeks.length
    };

    setWeeklyAnalysis(analysis);
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

  function formatDateRange(startStr: string, endStr: string): string {
    const start = new Date(startStr);
    const end = new Date(endStr);
    const startFormatted = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endFormatted = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${startFormatted} - ${endFormatted}`;
  }

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading weekly spending analysis...</div>
      </div>
    );
  }

  if (!weeklyAnalysis) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Unable to load spending data</div>
      </div>
    );
  }

  const { merchants, totalSpending, totalTransactions, totalWeeksAnalyzed } = weeklyAnalysis;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">📊 Weekly Spending by Merchant</h1>
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
            <div className="text-2xl font-bold text-red-600">{formatCurrency(totalSpending)}</div>
            <p className="text-xs text-muted-foreground mt-1">Across {merchants.length} merchants</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Total Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTransactions}</div>
            <p className="text-xs text-muted-foreground mt-1">Over {totalWeeksAnalyzed} weeks</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Active Merchants</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{merchants.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Unique spending sources</p>
          </CardContent>
        </Card>
      </div>

      {/* Merchant Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>🏪 Merchants Ranked by Total Spending (Last {timeRange} weeks)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Each merchant shows complete weekly breakdown including $0 weeks
          </p>
        </CardHeader>
        <CardContent>
          {merchants.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No spending data found for the selected time period.
            </div>
          ) : (
            <div className="space-y-6">
              {merchants.map((merchant, index) => (
                <div key={merchant.merchant} className="border rounded-lg p-6 space-y-4">
                  {/* Merchant Header */}
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-10 h-10 bg-blue-100 text-blue-800 rounded-full font-bold">
                        #{index + 1}
                      </div>
                      <div>
                        <h3 className="font-semibold text-xl">{merchant.merchant}</h3>
                        <p className="text-sm text-muted-foreground">
                          {merchant.transactionCount} transaction{merchant.transactionCount !== 1 ? 's' : ''} • 
                          {merchant.weeksWithSpending} of {totalWeeksAnalyzed} weeks active
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-red-600">
                        {formatCurrency(merchant.totalSpent)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {((merchant.totalSpent / totalSpending) * 100).toFixed(1)}% of total spending
                      </div>
                    </div>
                  </div>

                  {/* Merchant Statistics */}
                  <div className="grid md:grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <div className="text-center">
                      <div className="text-lg font-semibold">{formatCurrency(merchant.averageWeeklySpending)}</div>
                      <div className="text-xs text-muted-foreground">Average per week</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-blue-600">{formatCurrency(merchant.forecastedMonthlySpending)}</div>
                      <div className="text-xs text-muted-foreground">Forecasted monthly</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold">{((merchant.weeksWithSpending / totalWeeksAnalyzed) * 100).toFixed(0)}%</div>
                      <div className="text-xs text-muted-foreground">Activity rate</div>
                    </div>
                  </div>
                  
                  {/* Weekly Chart */}
                  <div>
                    <h4 className="font-medium mb-3 text-sm">📈 Weekly Spending Pattern</h4>
                    <div className="relative h-32 bg-white dark:bg-gray-800 rounded-lg p-3 border">
                      <svg className="w-full h-full" viewBox="0 0 600 100">
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
                        
                        {/* Chart content */}
                        {(() => {
                          // Sort weeks chronologically for proper chart display
                          const sortedWeeks = [...merchant.weeklyBreakdown].sort((a, b) => 
                            new Date(a.weekStart).getTime() - new Date(b.weekStart).getTime()
                          );
                          
                          if (sortedWeeks.length === 0) return null;
                          
                          const maxAmount = Math.max(...sortedWeeks.map(w => w.amount), merchant.averageWeeklySpending * 1.5);
                          const range = maxAmount || 1;
                          
                          const points = sortedWeeks.map((week, weekIndex) => {
                            const x = (weekIndex / Math.max(sortedWeeks.length - 1, 1)) * 560 + 20;
                            const y = 80 - ((week.amount) / range) * 60;
                            return { x, y, week };
                          });
                          
                          const pathData = points.map((point, pointIndex) => 
                            `${pointIndex === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
                          ).join(' ');
                          
                          const areaData = `${pathData} L ${points[points.length - 1]?.x || 20} 80 L 20 80 Z`;
                          
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
                              />
                              {/* Points */}
                              {points.map((point, pointIndex) => (
                                <g key={pointIndex}>
                                  <circle 
                                    cx={point.x} 
                                    cy={point.y} 
                                    r={point.week.amount > 0 ? "4" : "2"} 
                                    fill={point.week.amount > 0 ? "#3b82f6" : "#e5e7eb"}
                                    stroke="white"
                                    strokeWidth="1"
                                  />
                                  <title>
                                    {formatDateRange(point.week.weekStart, point.week.weekEnd)}: {formatCurrency(point.week.amount)}
                                    {point.week.transactions > 0 && ` (${point.week.transactions} transactions)`}
                                  </title>
                                </g>
                              ))}
                              
                              {/* Average line */}
                              {(() => {
                                const avgY = 80 - (merchant.averageWeeklySpending / range) * 60;
                                return (
                                  <>
                                    <line 
                                      x1="20" 
                                      y1={avgY} 
                                      x2="580" 
                                      y2={avgY} 
                                      stroke="#ef4444" 
                                      strokeWidth="1" 
                                      strokeDasharray="3,3"
                                    />
                                    <text x="585" y={avgY + 3} fontSize="8" fill="#ef4444">
                                      Avg
                                    </text>
                                  </>
                                );
                              })()}
                              
                              {/* Y-axis labels */}
                              <text x="5" y="15" fontSize="10" fill="#6b7280">
                                {formatCurrency(maxAmount)}
                              </text>
                              <text x="5" y="85" fontSize="10" fill="#6b7280">
                                $0
                              </text>
                            </>
                          );
                        })()}
                      </svg>
                    </div>
                  </div>

                  {/* Weekly Breakdown - Show only non-zero weeks in summary */}
                  <div>
                    <h4 className="font-medium mb-2 text-sm">📋 Active Weeks Summary</h4>
                    <div className="grid gap-2 max-h-32 overflow-y-auto">
                      {merchant.weeklyBreakdown
                        .filter(week => week.amount > 0)
                        .sort((a, b) => new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime())
                        .slice(0, 8) // Show most recent 8 active weeks
                        .map((week) => (
                          <div key={week.weekStart} className="flex justify-between items-center text-sm py-1 px-2 hover:bg-white dark:hover:bg-gray-700 rounded">
                            <span className="text-muted-foreground">
                              {formatDateRange(week.weekStart, week.weekEnd)}
                            </span>
                            <div className="flex gap-4">
                              <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                                {week.transactions} txn{week.transactions !== 1 ? 's' : ''}
                              </span>
                              <span className="font-medium text-red-600 dark:text-red-400 min-w-[60px] text-right">
                                {formatCurrency(week.amount)}
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                    {merchant.weeksWithSpending > 8 && (
                      <div className="text-xs text-muted-foreground mt-2 text-center">
                        Showing most recent 8 active weeks of {merchant.weeksWithSpending} total
                      </div>
                    )}
                  </div>

                  {/* Forecasting Insight */}
                  <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      <strong>Forecasting:</strong> Based on {merchant.weeksWithSpending} active weeks out of {totalWeeksAnalyzed} analyzed, 
                      this merchant averages {formatCurrency(merchant.averageWeeklySpending)} per week, 
                      forecasting {formatCurrency(merchant.forecastedMonthlySpending)} monthly budget needed.
                    </p>
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