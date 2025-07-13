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

interface MonthData {
  month: string;
  year: number;
  monthName: string;
  amount: number;
  transactions: number;
  daysInMonth: number;
  currentDay?: number; // For current month tracking
}

interface MerchantSpending {
  merchant: string;
  totalSpent: number;
  transactionCount: number;
  averageWeeklySpending: number;
  weeksWithSpending: number;
  forecastedMonthlySpending: number;
  weeklyBreakdown: WeekData[];
  cadence: 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly' | 'irregular';
  cadenceConfidence: number;
  intervalDays: number;
}

interface MerchantMonthlySpending {
  merchant: string;
  totalSpent: number;
  transactionCount: number;
  averageMonthlySpending: number;
  monthsWithSpending: number;
  monthlyBreakdown: MonthData[];
  // Current month pacing data
  currentMonthSpent: number;
  currentMonthDays: number;
  expectedPaceAmount: number;
  dailyPace: number;
  expectedDailyPace: number;
  paceVariance: number;
  projectedMonthEnd: number;
  paceStatus: 'ahead' | 'behind' | 'on-track';
  // Cadence detection
  cadence: 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly' | 'irregular';
  cadenceConfidence: number;
  intervalDays: number;
}

interface WeeklyAnalysis {
  merchants: MerchantSpending[];
  totalSpending: number;
  totalTransactions: number;
  totalWeeksAnalyzed: number;
}

interface MonthlyAnalysis {
  merchants: MerchantMonthlySpending[];
  totalSpending: number;
  totalTransactions: number;
  totalMonthsAnalyzed: number;
  currentMonthTotalSpent: number;
  currentMonthProjectedTotal: number;
}

export default function WeeklySpendingDashboard() {
  const [activeTab, setActiveTab] = useState<'weekly' | 'monthly'>('weekly');
  const [weeklyAnalysis, setWeeklyAnalysis] = useState<WeeklyAnalysis | null>(null);
  const [monthlyAnalysis, setMonthlyAnalysis] = useState<MonthlyAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('12'); // weeks/months
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

  // Get month info
  function getMonthInfo(date: Date): { month: string; year: number; monthName: string; daysInMonth: number } {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const daysInMonth = new Date(year, date.getMonth() + 1, 0).getDate();
    return { month: `${year}-${month}`, year, monthName, daysInMonth };
  }

  // Generate all weeks in the time range
  const generateAllWeeks = useCallback((weeksCount: number): WeekData[] => {
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
  }, []);

  // Generate all months in the time range
  const generateAllMonths = useCallback((monthsCount: number): MonthData[] => {
    const months: MonthData[] = [];
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(endDate.getMonth() - monthsCount);

    const startMonth = startDate.getMonth();
    const startYear = startDate.getFullYear();
    const endMonth = endDate.getMonth();
    const endYear = endDate.getFullYear();

    let currentYear = startYear;
    let currentMonth = startMonth;

    while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) {
      const currentDate = new Date(currentYear, currentMonth, 1);
      const { month, year, monthName, daysInMonth } = getMonthInfo(currentDate);
      const isCurrentMonth = currentYear === endDate.getFullYear() && 
                            currentMonth === endDate.getMonth();

      months.push({
        month,
        year,
        monthName,
        amount: 0,
        transactions: 0,
        daysInMonth,
        currentDay: isCurrentMonth ? endDate.getDate() : undefined
      });

      // Move to next month
      currentMonth++;
      if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
      }
    }

    return months.sort((a, b) => b.year - a.year || parseInt(b.month.split('-')[1]) - parseInt(a.month.split('-')[1]));
  }, []);

  // Detect transaction cadence for a merchant
  function detectMerchantCadence(transactions: Transaction[]): {
    cadence: 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly' | 'irregular';
    intervalDays: number;
    confidence: number;
  } {
    if (transactions.length < 2) {
      return { cadence: 'irregular', intervalDays: 0, confidence: 0 };
    }

    // Sort transactions by date
    const sortedTransactions = [...transactions].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Calculate intervals between consecutive transactions
    const intervals: number[] = [];
    for (let i = 1; i < sortedTransactions.length; i++) {
      const prevDate = new Date(sortedTransactions[i - 1].date);
      const currDate = new Date(sortedTransactions[i].date);
      const daysDiff = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
      intervals.push(daysDiff);
    }

    // Find the most common interval (with tolerance)
    const intervalCounts = new Map<number, number>();
    const tolerance = 3; // ±3 days tolerance

    intervals.forEach(interval => {
      let matched = false;
      for (const [existingInterval, count] of intervalCounts) {
        if (Math.abs(interval - existingInterval) <= tolerance) {
          intervalCounts.set(existingInterval, count + 1);
          matched = true;
          break;
        }
      }
      if (!matched) {
        intervalCounts.set(interval, 1);
      }
    });

    // Find the most frequent interval
    let mostCommonInterval = 0;
    let maxCount = 0;
    for (const [interval, count] of intervalCounts) {
      if (count > maxCount) {
        maxCount = count;
        mostCommonInterval = interval;
      }
    }

    const confidence = maxCount / intervals.length;

    // Classify the cadence based on interval
    let cadence: 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly' | 'irregular';
    
    if (Math.abs(mostCommonInterval - 7) <= 2) {
      cadence = 'weekly';
    } else if (Math.abs(mostCommonInterval - 14) <= 3) {
      cadence = 'bi-weekly';
    } else if (mostCommonInterval >= 28 && mostCommonInterval <= 35) {
      cadence = 'monthly';
    } else if (mostCommonInterval >= 85 && mostCommonInterval <= 95) {
      cadence = 'quarterly';
    } else {
      cadence = 'irregular';
    }

    return { cadence, intervalDays: mostCommonInterval, confidence };
  }

  // Check if a period is complete for a given merchant cadence
  function isPeriodCompleteForCadence(
    periodStart: string, 
    periodEnd: string, 
    cadence: 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly' | 'irregular',
    transactions: Transaction[]
  ): boolean {
    if (cadence === 'irregular') {
      return true; // Include all periods for irregular merchants
    }

    const startDate = new Date(periodStart);
    const endDate = new Date(periodEnd);
    const today = new Date();

    // Don't include current periods
    if (endDate >= today) {
      return false;
    }

    // Check if there are transactions in this period
    const periodTransactions = transactions.filter(t => {
      const tDate = new Date(t.date);
      return tDate >= startDate && tDate <= endDate;
    });

    if (periodTransactions.length === 0) {
      return true; // Empty periods are complete
    }

    // For cadence-based merchants, check if we have the expected pattern
    switch (cadence) {
      case 'weekly':
        // For weekly cadence, any week with transactions should be complete
        return true;
      
      case 'bi-weekly':
        // For bi-weekly, check if it's been at least 14 days since period end
        const daysSincePeriodEnd = Math.round((today.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));
        return daysSincePeriodEnd >= 14;
      
      case 'monthly':
        // For monthly cadence, only include complete months
        return true; // Month periods are already complete by definition
      
      case 'quarterly':
        // For quarterly, ensure full quarter has passed
        const monthsSincePeriodEnd = (today.getFullYear() - endDate.getFullYear()) * 12 + 
                                   (today.getMonth() - endDate.getMonth());
        return monthsSincePeriodEnd >= 3;
      
      default:
        return true;
    }
  }

  // Analyze spending by merchant with cadence-aware complete period detection
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

    // Analyze each merchant with cadence-aware complete period detection
    const merchantAnalysis: MerchantSpending[] = Array.from(merchantMap.entries()).map(([merchant, transactions]) => {
      // Detect merchant's transaction cadence
      const cadenceInfo = detectMerchantCadence(transactions);

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

      // Filter to complete weeks based on merchant's cadence
      const completeWeeks = merchantWeeks.filter(w => 
        isPeriodCompleteForCadence(w.weekStart, w.weekEnd, cadenceInfo.cadence, transactions)
      );

      // Calculate merchant statistics using ONLY cadence-appropriate complete weeks
      const totalSpentComplete = completeWeeks.reduce((sum, week) => sum + week.amount, 0);
      const averageWeeklySpending = completeWeeks.length > 0 ? totalSpentComplete / completeWeeks.length : 0;
      const forecastedMonthlySpending = (averageWeeklySpending * 52) / 12;

      // Total includes all weeks for display purposes
      const totalSpent = merchantWeeks.reduce((sum, week) => sum + week.amount, 0);
      const transactionCount = merchantWeeks.reduce((sum, week) => sum + week.transactions, 0);
      const weeksWithSpending = merchantWeeks.filter(w => w.amount > 0).length;

      return {
        merchant,
        totalSpent,
        transactionCount,
        averageWeeklySpending,
        weeksWithSpending,
        forecastedMonthlySpending,
        weeklyBreakdown: merchantWeeks,
        cadence: cadenceInfo.cadence,
        cadenceConfidence: cadenceInfo.confidence,
        intervalDays: cadenceInfo.intervalDays
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
  }, [timeRange, generateAllWeeks]);

  // Analyze monthly spending with pacing
  const analyzeMonthlySpending = useCallback((transactions: Transaction[]) => {
    const months = parseInt(timeRange);
    const allMonths = generateAllMonths(months);
    const today = new Date();
    const currentMonthKey = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}`;

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

    // Analyze each merchant with cadence-aware complete period detection
    const merchantAnalysis: MerchantMonthlySpending[] = Array.from(merchantMap.entries()).map(([merchant, transactions]) => {
      // Detect merchant's transaction cadence
      const cadenceInfo = detectMerchantCadence(transactions);

      // Create a fresh copy of all months for this merchant
      const merchantMonths = allMonths.map(month => ({
        ...month,
        amount: 0,
        transactions: 0
      }));

      // Populate months with this merchant's transactions
      transactions.forEach(transaction => {
        const transactionDate = new Date(transaction.date);
        const { month: monthKey } = getMonthInfo(transactionDate);

        const monthData = merchantMonths.find(m => m.month === monthKey);
        if (monthData) {
          monthData.amount += transaction.amount;
          monthData.transactions += 1;
        }
      });

      // Filter to complete months based on merchant's cadence
      const completeMonths = merchantMonths.filter(m => {
        const monthStart = new Date(m.year, parseInt(m.month.split('-')[1]) - 1, 1);
        const monthEnd = new Date(m.year, parseInt(m.month.split('-')[1]), 0);
        return isPeriodCompleteForCadence(
          monthStart.toISOString().split('T')[0], 
          monthEnd.toISOString().split('T')[0], 
          cadenceInfo.cadence, 
          transactions
        );
      });
      
      const currentMonth = merchantMonths.find(m => m.month === currentMonthKey);

      // Calculate basic merchant statistics using ONLY cadence-appropriate complete months
      const totalSpentComplete = completeMonths.reduce((sum, month) => sum + month.amount, 0);
      const averageMonthlySpending = completeMonths.length > 0 ? totalSpentComplete / completeMonths.length : 0;

      // Total includes all months for display purposes
      const totalSpent = merchantMonths.reduce((sum, month) => sum + month.amount, 0);
      const transactionCount = merchantMonths.reduce((sum, month) => sum + month.transactions, 0);
      const monthsWithSpending = merchantMonths.filter(m => m.amount > 0).length;

      // Calculate current month pacing
      const currentMonthSpent = currentMonth?.amount || 0;
      const currentMonthDays = currentMonth?.currentDay || today.getDate();
      const currentMonthTotalDays = currentMonth?.daysInMonth || 30;

      // Pacing calculations using cadence-appropriate complete month averages
      const expectedDailyPace = averageMonthlySpending / 30; // Use 30 as standard month for comparison
      const dailyPace = currentMonthDays > 0 ? currentMonthSpent / currentMonthDays : 0;
      const expectedPaceAmount = expectedDailyPace * currentMonthDays;
      const paceVariance = currentMonthSpent - expectedPaceAmount;
      const projectedMonthEnd = dailyPace * currentMonthTotalDays;

      let paceStatus: 'ahead' | 'behind' | 'on-track' = 'on-track';
      if (Math.abs(paceVariance) > expectedDailyPace * 2) { // More than 2 days variance
        paceStatus = paceVariance > 0 ? 'ahead' : 'behind';
      }

      return {
        merchant,
        totalSpent,
        transactionCount,
        averageMonthlySpending,
        monthsWithSpending,
        monthlyBreakdown: merchantMonths,
        currentMonthSpent,
        currentMonthDays,
        expectedPaceAmount,
        dailyPace,
        expectedDailyPace,
        paceVariance,
        projectedMonthEnd,
        paceStatus,
        cadence: cadenceInfo.cadence,
        cadenceConfidence: cadenceInfo.confidence,
        intervalDays: cadenceInfo.intervalDays
      };
    });

    // Sort merchants by total spending (highest to lowest)
    merchantAnalysis.sort((a, b) => b.totalSpent - a.totalSpent);

    // Calculate overall statistics
    const totalSpending = merchantAnalysis.reduce((sum, merchant) => sum + merchant.totalSpent, 0);
    const totalTransactions = merchantAnalysis.reduce((sum, merchant) => sum + merchant.transactionCount, 0);
    const currentMonthTotalSpent = merchantAnalysis.reduce((sum, merchant) => sum + merchant.currentMonthSpent, 0);
    const currentMonthProjectedTotal = merchantAnalysis.reduce((sum, merchant) => sum + merchant.projectedMonthEnd, 0);

    const analysis: MonthlyAnalysis = {
      merchants: merchantAnalysis,
      totalSpending,
      totalTransactions,
      totalMonthsAnalyzed: allMonths.length,
      currentMonthTotalSpent,
      currentMonthProjectedTotal
    };

    setMonthlyAnalysis(analysis);
  }, [timeRange, generateAllMonths]);

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
        const transactions = data.transactions || [];
        analyzeWeeklySpending(transactions);
        analyzeMonthlySpending(transactions);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [supabase.auth, analyzeWeeklySpending, analyzeMonthlySpending]);

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

  function getPaceStatusColor(status: 'ahead' | 'behind' | 'on-track'): string {
    switch (status) {
      case 'ahead': return 'text-red-600'; // Red for overspending
      case 'behind': return 'text-green-600'; // Green for under budget
      case 'on-track': return 'text-blue-600'; // Blue for on track
    }
  }

  function getPaceStatusText(status: 'ahead' | 'behind' | 'on-track'): string {
    switch (status) {
      case 'ahead': return 'Ahead of Pace';
      case 'behind': return 'Behind Pace';
      case 'on-track': return 'On Track';
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading spending analysis...</div>
      </div>
    );
  }

  const currentAnalysis = activeTab === 'weekly' ? weeklyAnalysis : monthlyAnalysis;

  if (!currentAnalysis) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Unable to load spending data</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold">📊 Spending Analysis</h1>
          
          {/* Tabs */}
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('weekly')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'weekly'
                  ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              📅 Weekly
            </button>
            <button
              onClick={() => setActiveTab('monthly')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'monthly'
                  ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              📈 Monthly
            </button>
          </div>
        </div>

        <select 
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          className="px-3 py-2 border rounded-md bg-background"
        >
          <option value="4">Last 4 {activeTab === 'weekly' ? 'weeks' : 'months'}</option>
          <option value="8">Last 8 {activeTab === 'weekly' ? 'weeks' : 'months'}</option>
          <option value="12">Last 12 {activeTab === 'weekly' ? 'weeks' : 'months'}</option>
          <option value="24">Last {activeTab === 'weekly' ? '6 months' : '2 years'}</option>
          <option value="52">Last {activeTab === 'weekly' ? 'year' : '4+ years'}</option>
        </select>
      </div>

      {/* Summary Cards */}
      {activeTab === 'weekly' && weeklyAnalysis && (
        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground">Total Spending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{formatCurrency(weeklyAnalysis.totalSpending)}</div>
              <p className="text-xs text-muted-foreground mt-1">Across {weeklyAnalysis.merchants.length} merchants</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground">Total Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{weeklyAnalysis.totalTransactions}</div>
              <p className="text-xs text-muted-foreground mt-1">Over {weeklyAnalysis.totalWeeksAnalyzed} weeks</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground">Active Merchants</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{weeklyAnalysis.merchants.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Unique spending sources</p>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'monthly' && monthlyAnalysis && (
        <div className="grid md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground">Month So Far</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{formatCurrency(monthlyAnalysis.currentMonthTotalSpent)}</div>
              <p className="text-xs text-muted-foreground mt-1">Current month spending</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground">Projected Month-End</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{formatCurrency(monthlyAnalysis.currentMonthProjectedTotal)}</div>
              <p className="text-xs text-muted-foreground mt-1">Based on current pace</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground">Historical Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{formatCurrency(monthlyAnalysis.totalSpending)}</div>
              <p className="text-xs text-muted-foreground mt-1">Over {monthlyAnalysis.totalMonthsAnalyzed} months</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground">Active Merchants</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{monthlyAnalysis.merchants.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Spending sources</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Weekly Analysis */}
      {activeTab === 'weekly' && weeklyAnalysis && (
        <Card>
          <CardHeader>
            <CardTitle>🏪 Merchants Ranked by Total Spending (Last {timeRange} weeks)</CardTitle>
            <p className="text-sm text-muted-foreground">
              Each merchant shows complete weekly breakdown including $0 weeks
            </p>
          </CardHeader>
          <CardContent>
            {weeklyAnalysis.merchants.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No spending data found for the selected time period.
              </div>
            ) : (
              <div className="space-y-6">
                {weeklyAnalysis.merchants.map((merchant, index) => (
                  <div key={`merchant-${merchant.merchant}-${index}`} className="border rounded-lg p-4 bg-white">
                    {/* Merchant Header */}
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-10 h-10 bg-blue-100 text-blue-800 rounded-full font-bold">
                          #{index + 1}
                        </div>
                        <div>
                          <h3 className="font-semibold text-xl">{merchant.merchant}</h3>
                          <div className="flex items-center gap-3 text-sm">
                            <span className="text-muted-foreground">
                              {merchant.transactionCount} transaction{merchant.transactionCount !== 1 ? 's' : ''} • 
                              {merchant.weeksWithSpending} of {weeklyAnalysis.totalWeeksAnalyzed} weeks active
                            </span>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              merchant.cadence === 'monthly' ? 'bg-blue-100 text-blue-800' :
                              merchant.cadence === 'weekly' ? 'bg-green-100 text-green-800' :
                              merchant.cadence === 'bi-weekly' ? 'bg-yellow-100 text-yellow-800' :
                              merchant.cadence === 'quarterly' ? 'bg-purple-100 text-purple-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {merchant.cadence} ({Math.round(merchant.cadenceConfidence * 100)}% confidence)
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-red-600">
                          {formatCurrency(merchant.totalSpent)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {((merchant.totalSpent / weeklyAnalysis.totalSpending) * 100).toFixed(1)}% of total spending
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
                        <div className="text-lg font-semibold">{((merchant.weeksWithSpending / weeklyAnalysis.totalWeeksAnalyzed) * 100).toFixed(0)}%</div>
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
                                  <g key={`point-${merchant.merchant}-${pointIndex}`}>
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
                            <div key={`week-${merchant.merchant}-${week.weekStart}`} className="flex justify-between items-center text-sm py-1 px-2 hover:bg-white dark:hover:bg-gray-700 rounded">
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
                        <strong>Smart Forecasting:</strong> Detected <strong>{merchant.cadence}</strong> spending pattern 
                        ({merchant.intervalDays} day intervals, {Math.round(merchant.cadenceConfidence * 100)}% confidence). 
                        Using only complete {merchant.cadence} cycles for accurate averaging: {formatCurrency(merchant.averageWeeklySpending)} per week, 
                        forecasting {formatCurrency(merchant.forecastedMonthlySpending)} monthly budget needed.
                      </p>
                      {merchant.cadence === 'monthly' && (
                        <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                          💡 Monthly merchants: Weekly analysis may not be meaningful. Consider monthly view for better insights.
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Monthly Analysis with Pacing */}
      {activeTab === 'monthly' && monthlyAnalysis && (
        <Card>
          <CardHeader>
            <CardTitle>📈 Monthly Pacing Analysis</CardTitle>
            <p className="text-sm text-muted-foreground">
              Current month progress vs historical averages with month-end projections
            </p>
          </CardHeader>
          <CardContent>
            {monthlyAnalysis.merchants.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No spending data found for the selected time period.
              </div>
            ) : (
              <div className="space-y-6">
                {monthlyAnalysis.merchants.map((merchant, index) => (
                  <div key={`monthly-merchant-${merchant.merchant}-${index}`} className="border rounded-lg p-4 bg-white">
                    {/* Merchant Header with Pacing Status */}
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-10 h-10 bg-blue-100 text-blue-800 rounded-full font-bold">
                          #{index + 1}
                        </div>
                        <div>
                          <h3 className="font-semibold text-xl">{merchant.merchant}</h3>
                          <div className="flex items-center gap-3 text-sm">
                            <span className="text-muted-foreground">
                              Day {merchant.currentMonthDays} • {merchant.transactionCount} transaction{merchant.transactionCount !== 1 ? 's' : ''} • 
                              {merchant.monthsWithSpending} of {monthlyAnalysis.totalMonthsAnalyzed} months active
                            </span>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              merchant.cadence === 'monthly' ? 'bg-blue-100 text-blue-800' :
                              merchant.cadence === 'weekly' ? 'bg-green-100 text-green-800' :
                              merchant.cadence === 'bi-weekly' ? 'bg-yellow-100 text-yellow-800' :
                              merchant.cadence === 'quarterly' ? 'bg-purple-100 text-purple-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {merchant.cadence} ({Math.round(merchant.cadenceConfidence * 100)}% confidence)
                            </span>
                            <span className={`font-medium ${getPaceStatusColor(merchant.paceStatus)}`}>
                              {getPaceStatusText(merchant.paceStatus)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-red-600">
                          {formatCurrency(merchant.currentMonthSpent)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          This month so far
                        </div>
                      </div>
                    </div>

                    {/* Pacing Statistics */}
                    <div className="grid md:grid-cols-4 gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <div className="text-center">
                        <div className="text-lg font-semibold">{formatCurrency(merchant.expectedPaceAmount)}</div>
                        <div className="text-xs text-muted-foreground">Expected by day {merchant.currentMonthDays}</div>
                      </div>
                      <div className="text-center">
                        <div className={`text-lg font-semibold ${merchant.paceVariance >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {merchant.paceVariance >= 0 ? '+' : ''}{formatCurrency(merchant.paceVariance)}
                        </div>
                        <div className="text-xs text-muted-foreground">Pace variance</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-purple-600">{formatCurrency(merchant.projectedMonthEnd)}</div>
                        <div className="text-xs text-muted-foreground">Projected month-end</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold">{formatCurrency(merchant.averageMonthlySpending)}</div>
                        <div className="text-xs text-muted-foreground">Historical average</div>
                      </div>
                    </div>

                    {/* Daily Pace Breakdown */}
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border">
                        <h5 className="font-medium text-sm mb-2">📊 Daily Pace Comparison</h5>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Current daily pace:</span>
                            <span className="font-medium">{formatCurrency(merchant.dailyPace)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Expected daily pace:</span>
                            <span className="font-medium">{formatCurrency(merchant.expectedDailyPace)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Days remaining:</span>
                            <span className="font-medium">{(monthlyAnalysis.merchants[0]?.monthlyBreakdown[0]?.daysInMonth || 30) - merchant.currentMonthDays}</span>
                          </div>
                        </div>
                      </div>

                      <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                        <h5 className="font-medium text-sm mb-2 text-blue-800 dark:text-blue-200">🎯 Pacing Insight</h5>
                        <p className="text-sm text-blue-800 dark:text-blue-200">
                          {merchant.paceStatus === 'ahead' && (
                            <>You&apos;re spending {formatCurrency(Math.abs(merchant.paceVariance))} more than usual. 
                            At this pace, you&apos;ll spend {formatCurrency(merchant.projectedMonthEnd)} this month vs your typical {formatCurrency(merchant.averageMonthlySpending)}.</>
                          )}
                          {merchant.paceStatus === 'behind' && (
                            <>You&apos;re {formatCurrency(Math.abs(merchant.paceVariance))} under your typical pace. 
                            You&apos;ll likely spend {formatCurrency(merchant.projectedMonthEnd)} this month vs your usual {formatCurrency(merchant.averageMonthlySpending)}.</>
                          )}
                          {merchant.paceStatus === 'on-track' && (
                            <>You&apos;re tracking close to your typical spending pattern. 
                            Projected {formatCurrency(merchant.projectedMonthEnd)} vs usual {formatCurrency(merchant.averageMonthlySpending)}.</>
                          )}
                        </p>
                        <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                          <strong>Smart Analysis:</strong> Detected <strong>{merchant.cadence}</strong> spending pattern 
                          ({merchant.intervalDays} day intervals, {Math.round(merchant.cadenceConfidence * 100)}% confidence). 
                          Using only complete {merchant.cadence} cycles to calculate {formatCurrency(merchant.averageMonthlySpending)} monthly average.
                          {merchant.cadence !== 'monthly' && merchant.cadence !== 'irregular' && (
                            <span className="block mt-1">💡 This merchant may be better suited for {merchant.cadence} tracking rather than monthly analysis.</span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Recent Months Summary */}
                    <div>
                      <h4 className="font-medium mb-2 text-sm">📅 Recent Months</h4>
                      <div className="grid gap-2 max-h-32 overflow-y-auto">
                        {merchant.monthlyBreakdown
                          .filter(month => month.amount > 0)
                          .slice(0, 6) // Show most recent 6 months
                          .map((month) => (
                            <div key={`month-${merchant.merchant}-${month.month}`} className="flex justify-between items-center text-sm py-1 px-2 hover:bg-white dark:hover:bg-gray-700 rounded">
                              <span className="text-muted-foreground">
                                {month.monthName}
                              </span>
                              <div className="flex gap-4">
                                <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                                  {month.transactions} txn{month.transactions !== 1 ? 's' : ''}
                                </span>
                                <span className="font-medium text-red-600 dark:text-red-400 min-w-[60px] text-right">
                                  {formatCurrency(month.amount)}
                                </span>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
} 