'use client';

import { useState, useEffect } from 'react';
import { createSupabaseClient } from '@/utils/supabase/client';

interface Transaction {
  id: string;
  name: string;
  merchant_name: string | null;
  amount: number;
  date: string;
  category: string[];
}

interface BillPrediction {
  merchant: string;
  datePrection: string;
  amountPrediction: string;
  confidence: string;
}

export default function UpcomingBillsTable() {
  const [predictions, setPredictions] = useState<BillPrediction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createSupabaseClient();

  // Detect recurring bills (same logic as webhook)
  function findUpcomingBills(transactions: Transaction[]): BillPrediction[] {
    // Group transactions by merchant
    const merchantGroups: { [key: string]: Transaction[] } = {};
    transactions.forEach(t => {
      const merchant = (t.merchant_name || t.name || '').toLowerCase();
      if (!merchantGroups[merchant]) merchantGroups[merchant] = [];
      merchantGroups[merchant].push(t);
    });
    
    const bills: BillPrediction[] = [];
    const now = new Date();
    
    // Look for recurring patterns
    Object.entries(merchantGroups).forEach(([merchant, merchantTransactions]) => {
      if (merchantTransactions.length < 2) return;
      
      // Sort by date
      merchantTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      // Check for monthly recurring bills (Netflix, utilities, etc.)
      const intervals: number[] = [];
      for (let i = 0; i < merchantTransactions.length - 1; i++) {
        const date1 = new Date(merchantTransactions[i].date);
        const date2 = new Date(merchantTransactions[i + 1].date);
        const diffDays = Math.abs((date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24));
        intervals.push(diffDays);
      }
      
      // Check if intervals suggest monthly billing (25-35 days)
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      if (avgInterval >= 25 && avgInterval <= 35 && intervals.length >= 2) {
        const lastTransaction = merchantTransactions[0];
        const lastDate = new Date(lastTransaction.date);
        const predictedNext = new Date(lastDate);
        predictedNext.setDate(predictedNext.getDate() + Math.round(avgInterval));
        
        // Only include if predicted date is in future
        if (predictedNext > now) {
          const confidence = calculateConfidence(intervals, avgInterval);
          bills.push({
            merchant: merchant.charAt(0).toUpperCase() + merchant.slice(1),
            datePrection: formatDate(predictedNext),
            amountPrediction: `$${Math.abs(lastTransaction.amount).toFixed(2)}`,
            confidence: `${Math.round(confidence * 100)}%`
          });
        }
      }
    });
    
    // Sort by predicted date (soonest first)
    return bills.sort((a, b) => {
      const dateA = new Date(a.datePrection);
      const dateB = new Date(b.datePrection);
      return dateA.getTime() - dateB.getTime();
    });
  }

  function calculateConfidence(intervals: number[], avgInterval: number): number {
    if (intervals.length === 0) return 0;
    
    const variance = intervals.reduce((sum, interval) => {
      return sum + Math.pow(interval - avgInterval, 2);
    }, 0) / intervals.length;
    
    const standardDeviation = Math.sqrt(variance);
    const coefficientOfVariation = standardDeviation / avgInterval;
    
    // Lower variation = higher confidence
    return Math.max(0, Math.min(1, 1 - coefficientOfVariation));
  }

  function formatDate(date: Date): string {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = dayNames[date.getDay()];
    return `${month}/${day} (${dayName})`;
  }

  async function loadPredictions() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Use the transactions API route which properly filters by user
      const response = await fetch('/api/plaid/transactions', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
      const data = await response.json();
      
      if (response.ok && data.transactions) {
        const billPredictions = findUpcomingBills(data.transactions);
        setPredictions(billPredictions);
      }
    } catch (error) {
      console.error('Error loading predictions:', error);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadPredictions();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading predictions...</div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <table className="w-full border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-50">
            <th className="border border-gray-300 px-4 py-2 text-left font-medium">Merchant</th>
            <th className="border border-gray-300 px-4 py-2 text-left font-medium">Date Prediction</th>
            <th className="border border-gray-300 px-4 py-2 text-left font-medium">Amount Prediction</th>
            <th className="border border-gray-300 px-4 py-2 text-left font-medium">Confidence</th>
          </tr>
        </thead>
        <tbody>
          {predictions.length === 0 ? (
            <tr>
              <td colSpan={4} className="border border-gray-300 px-4 py-8 text-center text-muted-foreground">
                No recurring bill patterns detected
              </td>
            </tr>
          ) : (
            predictions.map((prediction, index) => (
              <tr key={`prediction-${prediction.merchant}-${index}`} className="border-b">
                <td className="border border-gray-300 px-4 py-2">{prediction.merchant}</td>
                <td className="border border-gray-300 px-4 py-2">{prediction.datePrection}</td>
                <td className="border border-gray-300 px-4 py-2">{prediction.amountPrediction}</td>
                <td className="border border-gray-300 px-4 py-2">{prediction.confidence}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
} 