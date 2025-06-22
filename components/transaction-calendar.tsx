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

interface PredictedTransaction {
  merchant: string;
  predictedDate: Date;
  averageAmount: number;
  confidence: number;
  cadence: 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly' | 'irregular';
  intervalDays: number;
  lastTransactionDate: Date;
  isUpcoming: boolean;
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  actualTransactions: Transaction[];
  predictedTransactions: PredictedTransaction[];
}

interface MerchantSpending {
  name: string;
  totalSpent: number;
  transactionCount: number;
  averageAmount: number;
}

export default function TransactionCalendar() {
  const [predictions, setPredictions] = useState<PredictedTransaction[]>([]);
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [merchantSpendingRanked, setMerchantSpendingRanked] = useState<MerchantSpending[]>([]);
  const [totalSpending, setTotalSpending] = useState(0);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createSupabaseClient();

  // Detect transaction cadence for a merchant (reusing from weekly dashboard)
  function detectMerchantCadence(transactions: Transaction[]): {
    cadence: 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly' | 'irregular';
    intervalDays: number;
    confidence: number;
  } {
    if (transactions.length < 2) {
      return { cadence: 'irregular', intervalDays: 0, confidence: 0 };
    }

    const sortedTransactions = [...transactions].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const intervals: number[] = [];
    for (let i = 1; i < sortedTransactions.length; i++) {
      const prevDate = new Date(sortedTransactions[i - 1].date);
      const currDate = new Date(sortedTransactions[i].date);
      const daysDiff = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
      intervals.push(daysDiff);
    }

    const intervalCounts = new Map<number, number>();
    const tolerance = 3;

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

    let mostCommonInterval = 0;
    let maxCount = 0;
    for (const [interval, count] of intervalCounts) {
      if (count > maxCount) {
        maxCount = count;
        mostCommonInterval = interval;
      }
    }

    const confidence = maxCount / intervals.length;

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

  // Predict next transaction dates based on cadence
  function predictNextTransactions(
    merchant: string,
    transactions: Transaction[],
    cadenceInfo: ReturnType<typeof detectMerchantCadence>
  ): PredictedTransaction[] {
    if (cadenceInfo.confidence < 0.6 || cadenceInfo.cadence === 'irregular') {
      return []; // Only predict for reliable patterns
    }

    const sortedTransactions = [...transactions].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const lastTransaction = sortedTransactions[0];
    const lastDate = new Date(lastTransaction.date);
    const averageAmount = transactions.reduce((sum, t) => sum + t.amount, 0) / transactions.length;

    const predictions: PredictedTransaction[] = [];
    const today = new Date();
    const maxPredictionDate = new Date(today);
    maxPredictionDate.setMonth(maxPredictionDate.getMonth() + 6); // Predict up to 6 months ahead

    let nextDate = new Date(lastDate);
    nextDate.setDate(nextDate.getDate() + cadenceInfo.intervalDays);

    while (nextDate <= maxPredictionDate) {
      const isUpcoming = nextDate >= today;
      
      predictions.push({
        merchant,
        predictedDate: new Date(nextDate),
        averageAmount,
        confidence: cadenceInfo.confidence,
        cadence: cadenceInfo.cadence,
        intervalDays: cadenceInfo.intervalDays,
        lastTransactionDate: lastDate,
        isUpcoming
      });

      // Add next occurrence
      nextDate = new Date(nextDate);
      nextDate.setDate(nextDate.getDate() + cadenceInfo.intervalDays);
    }

    return predictions;
  }

  // Generate calendar days for the current month
  function generateCalendarDays(date: Date, actualTransactions: Transaction[], predictions: PredictedTransaction[]): CalendarDay[] {
    const year = date.getFullYear();
    const month = date.getMonth();
    
    // Get first day of month and start from the beginning of that week
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    
    // Start from the Sunday of the week containing the first day
    const startDate = new Date(firstDayOfMonth);
    startDate.setDate(startDate.getDate() - firstDayOfMonth.getDay());
    
    // End on the Saturday of the week containing the last day
    const endDate = new Date(lastDayOfMonth);
    endDate.setDate(endDate.getDate() + (6 - lastDayOfMonth.getDay()));

    const days: CalendarDay[] = [];
    const currentDate = new Date(startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    while (currentDate <= endDate) {
      const dayKey = currentDate.toISOString().split('T')[0];
      
      // Find actual transactions for this day
      const dayActualTransactions = actualTransactions.filter(t => 
        t.date === dayKey && t.amount > 0 // Only spending transactions
      );

      // Find predicted transactions for this day
      const dayPredictedTransactions = predictions.filter(p => {
        const predictionDateKey = p.predictedDate.toISOString().split('T')[0];
        return predictionDateKey === dayKey;
      });

      days.push({
        date: new Date(currentDate),
        isCurrentMonth: currentDate.getMonth() === month,
        isToday: currentDate.getTime() === today.getTime(),
        actualTransactions: dayActualTransactions,
        predictedTransactions: dayPredictedTransactions
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return days;
  }

  const analyzePredictions = useCallback(async () => {
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
        const spendingTransactions = transactions.filter((t: Transaction) => t.amount > 0);

        // Group by merchant
        const merchantMap = new Map<string, Transaction[]>();
        spendingTransactions.forEach((transaction: Transaction) => {
          const merchant = transaction.merchant_name || transaction.name || 'Unknown Merchant';
          if (!merchantMap.has(merchant)) {
            merchantMap.set(merchant, []);
          }
          merchantMap.get(merchant)!.push(transaction);
        });

        // Generate predictions for each merchant
        const allPredictions: PredictedTransaction[] = [];
        merchantMap.forEach((merchantTransactions, merchant) => {
          if (merchantTransactions.length >= 3) { // Need at least 3 transactions for reliable prediction
            const cadenceInfo = detectMerchantCadence(merchantTransactions);
            const merchantPredictions = predictNextTransactions(merchant, merchantTransactions, cadenceInfo);
            allPredictions.push(...merchantPredictions);
          }
        });

        // Sort predictions by confidence and date
        allPredictions.sort((a, b) => {
          if (a.confidence !== b.confidence) return b.confidence - a.confidence;
          return a.predictedDate.getTime() - b.predictedDate.getTime();
        });

        setPredictions(allPredictions);

        // Calculate merchant spending rankings
        const merchantSpendingData: MerchantSpending[] = [];
        let totalSpent = 0;

        merchantMap.forEach((merchantTransactions, merchant) => {
          const merchantTotal = merchantTransactions.reduce((sum, t) => sum + t.amount, 0);
          const merchantAverage = merchantTotal / merchantTransactions.length;
          
          totalSpent += merchantTotal;
          
          merchantSpendingData.push({
            name: merchant,
            totalSpent: merchantTotal,
            transactionCount: merchantTransactions.length,
            averageAmount: merchantAverage
          });
        });

        // Sort by total spending (highest to lowest)
        merchantSpendingData.sort((a, b) => b.totalSpent - a.totalSpent);
        
        setMerchantSpendingRanked(merchantSpendingData);
        setTotalSpending(totalSpent);

        // Generate calendar days
        const calendarDays = generateCalendarDays(currentDate, transactions, allPredictions);
        setCalendarDays(calendarDays);
      }
    } catch (error) {
      console.error('Error analyzing predictions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [supabase.auth, currentDate]);

  useEffect(() => {
    analyzePredictions();
  }, [analyzePredictions]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1));
    setCurrentDate(newDate);
  };

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  function getCadenceColor(cadence: string): string {
    switch (cadence) {
      case 'monthly': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'weekly': return 'bg-green-100 text-green-800 border-green-200';
      case 'bi-weekly': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'quarterly': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Analyzing transaction patterns...</div>
      </div>
    );
  }

  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const upcomingPredictions = predictions.filter(p => p.isUpcoming).slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">📅 Predictive Transaction Calendar</h1>
        <div className="text-right">
          <div className="text-lg font-semibold text-red-600">
            {formatCurrency(totalSpending)} Total Spending
          </div>
          <div className="text-sm text-muted-foreground">
            {predictions.length} predictions from {merchantSpendingRanked.length} merchants
          </div>
        </div>
      </div>

      {/* Stack Ranked Spending Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>📊 Top Spending Merchants</CardTitle>
          </CardHeader>
          <CardContent>
            {merchantSpendingRanked.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                No spending data available.
              </div>
            ) : (
              <div className="space-y-3">
                {merchantSpendingRanked.slice(0, 8).map((merchant, index) => (
                  <div key={index} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        index === 0 ? 'bg-yellow-100 text-yellow-800' :
                        index === 1 ? 'bg-gray-100 text-gray-800' :
                        index === 2 ? 'bg-orange-100 text-orange-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        #{index + 1}
                      </div>
                      <div>
                        <div className="font-medium">{merchant.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {merchant.transactionCount} transaction{merchant.transactionCount !== 1 ? 's' : ''} • 
                          Avg: {formatCurrency(merchant.averageAmount)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-red-600 text-lg">{formatCurrency(merchant.totalSpent)}</div>
                      <div className="text-xs text-muted-foreground">
                        {((merchant.totalSpent / totalSpending) * 100).toFixed(1)}% of total
                      </div>
                    </div>
                  </div>
                ))}
                {merchantSpendingRanked.length > 8 && (
                  <div className="text-center text-sm text-muted-foreground pt-2 border-t">
                    +{merchantSpendingRanked.length - 8} more merchants
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>🔮 Upcoming Predictions</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingPredictions.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                No upcoming predictions found. Need more transaction history for reliable patterns.
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingPredictions.map((prediction, index) => (
                  <div key={index} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium border ${getCadenceColor(prediction.cadence)}`}>
                        {prediction.cadence}
                      </span>
                      <div>
                        <div className="font-medium">{prediction.merchant}</div>
                        <div className="text-xs text-muted-foreground">
                          {Math.round(prediction.confidence * 100)}% confidence
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-red-600">{formatCurrency(prediction.averageAmount)}</div>
                      <div className="text-xs text-muted-foreground">
                        {prediction.predictedDate.toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Calendar */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>{monthName}</CardTitle>
            <div className="flex gap-2">
              <button
                onClick={() => navigateMonth('prev')}
                className="px-3 py-1 border rounded hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                ← Prev
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-3 py-1 border rounded hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Today
              </button>
              <button
                onClick={() => navigateMonth('next')}
                className="px-3 py-1 border rounded hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Next →
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Day headers */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">
                {day}
              </div>
            ))}
            
            {/* Calendar days */}
            {calendarDays.map((day, index) => (
              <div
                key={index}
                className={`min-h-[100px] p-1 border rounded ${
                  !day.isCurrentMonth ? 'bg-gray-50 dark:bg-gray-900 opacity-50' :
                  day.isToday ? 'bg-blue-50 dark:bg-blue-950 border-blue-200' :
                  'bg-white dark:bg-gray-800'
                }`}
              >
                <div className={`text-sm font-medium mb-1 ${
                  day.isToday ? 'text-blue-600' : 
                  !day.isCurrentMonth ? 'text-gray-400' : 'text-gray-900 dark:text-gray-100'
                }`}>
                  {day.date.getDate()}
                </div>
                
                {/* Actual transactions */}
                {day.actualTransactions.map((transaction, tIndex) => (
                  <div
                    key={tIndex}
                    className="text-xs p-1 mb-1 bg-red-100 text-red-800 rounded border border-red-200"
                    title={`${transaction.merchant_name || transaction.name}: ${formatCurrency(transaction.amount)}`}
                  >
                    💳 {formatCurrency(transaction.amount)}
                  </div>
                ))}
                
                {/* Predicted transactions */}
                {day.predictedTransactions.map((prediction, pIndex) => (
                  <div
                    key={pIndex}
                    className={`text-xs p-1 mb-1 rounded border ${getCadenceColor(prediction.cadence)} opacity-80`}
                    title={`Predicted: ${prediction.merchant} - ${formatCurrency(prediction.averageAmount)} (${Math.round(prediction.confidence * 100)}% confidence)`}
                  >
                    🔮 {formatCurrency(prediction.averageAmount)}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="mt-4 pt-4 border-t">
            <div className="text-sm font-medium mb-2">Legend:</div>
            <div className="flex flex-wrap gap-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-red-100 border border-red-200 rounded"></div>
                <span>💳 Actual transactions</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-blue-100 border border-blue-200 rounded"></div>
                <span>🔮 Monthly predictions</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-100 border border-green-200 rounded"></div>
                <span>🔮 Weekly predictions</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-yellow-100 border border-yellow-200 rounded"></div>
                <span>🔮 Bi-weekly predictions</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 