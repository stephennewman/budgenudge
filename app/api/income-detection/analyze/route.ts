import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface IncomePattern {
  source_name: string;
  pattern: string;
  frequency: 'weekly' | 'bi-weekly' | 'bi-monthly' | 'monthly' | 'irregular';
  expected_amount: number;
  confidence_score: number;
  intervals: number[];
  dates: string[];
  amounts: number[];
  account_id: string;
}

interface AnalysisResult {
  user_id: string;
  patterns_detected: IncomePattern[];
  total_transactions_analyzed: number;
  lookback_months: number;
  analysis_confidence: number;
}

export async function POST(request: NextRequest) {
  try {
    const { user_id, lookback_months = 6 } = await request.json();
    
    if (!user_id) {
      return NextResponse.json({ 
        success: false, 
        error: 'user_id is required' 
      }, { status: 400 });
    }

    console.log(`🔍 Starting income detection analysis for user: ${user_id}`);
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Calculate date range for analysis
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(endDate.getMonth() - lookback_months);
    
    console.log(`📅 Analyzing transactions from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
    
    // Get user's items to ensure proper access
    const { data: userItems, error: itemsError } = await supabase
      .from('items')
      .select('plaid_item_id, plaid_access_token')
      .eq('user_id', user_id);
    
    if (itemsError || !userItems || userItems.length === 0) {
      console.error('❌ Error fetching user items:', itemsError);
      return NextResponse.json({ 
        success: false, 
        error: 'No connected accounts found for user' 
      }, { status: 404 });
    }
    
    // Fetch negative transactions (income/paychecks) within date range
    const { data: transactions, error: transError } = await supabase
      .from('transactions')
      .select('*')
      .in('plaid_item_id', userItems.map(item => item.plaid_item_id))
      .lt('amount', -100) // Only significant negative amounts (income/paychecks)
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0])
      .eq('pending', false) // Only confirmed transactions
      .order('date', { ascending: true });
    
    if (transError) {
      console.error('❌ Error fetching transactions:', transError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch transaction data' 
      }, { status: 500 });
    }
    
    console.log(`💰 Found ${transactions?.length || 0} negative transactions (potential income) to analyze`);
    
    if (!transactions || transactions.length === 0) {
      return NextResponse.json({
        success: true,
        result: {
          user_id,
          patterns_detected: [],
          total_transactions_analyzed: 0,
          lookback_months,
          analysis_confidence: 0
        }
      });
    }
    
    // Group transactions by similar patterns (name/merchant similarity)
    const incomeGroups = groupTransactionsByIncomeSource(transactions);
    
    // Analyze each group for recurring patterns
    const detectedPatterns: IncomePattern[] = [];
    
    for (const [sourcePattern, groupTransactions] of incomeGroups.entries()) {
      const pattern = analyzeIncomePattern(sourcePattern, groupTransactions);
      if (pattern && pattern.confidence_score >= 60) { // Only high-confidence patterns
        detectedPatterns.push(pattern);
      }
    }
    
    // Calculate overall analysis confidence
    const totalConfidence = detectedPatterns.length > 0 
      ? detectedPatterns.reduce((sum, p) => sum + p.confidence_score, 0) / detectedPatterns.length
      : 0;
    
    const result: AnalysisResult = {
      user_id,
      patterns_detected: detectedPatterns.sort((a, b) => b.confidence_score - a.confidence_score),
      total_transactions_analyzed: transactions.length,
      lookback_months,
      analysis_confidence: Math.round(totalConfidence)
    };
    
    // Log the analysis
    await logIncomeAnalysis(supabase, user_id, result);
    
    console.log(`✅ Income detection completed. Found ${detectedPatterns.length} patterns with ${Math.round(totalConfidence)}% confidence`);
    
    return NextResponse.json({
      success: true,
      result
    });
    
  } catch (error) {
    console.error('❌ Income detection analysis failed:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

interface TransactionData {
  name: string;
  amount: number;
  date: string;
  account_id: string;
  [key: string]: unknown;
}

function groupTransactionsByIncomeSource(transactions: TransactionData[]): Map<string, TransactionData[]> {
  const groups = new Map<string, TransactionData[]>();
  
  for (const transaction of transactions) {
    // Create a pattern key from transaction name (remove common variations)
    const pattern = normalizeIncomeSourceName(transaction.name);
    
    if (!groups.has(pattern)) {
      groups.set(pattern, []);
    }
    groups.get(pattern)!.push(transaction);
  }
  
  // Filter out groups with too few transactions (need at least 3 for pattern detection)
  const filteredGroups = new Map<string, TransactionData[]>();
  for (const [pattern, txns] of groups.entries()) {
    if (txns.length >= 3) {
      filteredGroups.set(pattern, txns);
    }
  }
  
  return filteredGroups;
}

function normalizeIncomeSourceName(name: string): string {
  return name
    .replace(/\d{4}-\d{2}-\d{2}/g, '') // Remove dates
    .replace(/\b(payroll|deposit|direct|payment|transfer)\b/gi, '') // Remove common payroll terms
    .replace(/[^\w\s]/g, ' ') // Replace special chars with spaces
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim()
    .toLowerCase();
}

function analyzeIncomePattern(sourcePattern: string, transactions: TransactionData[]): IncomePattern | null {
  if (transactions.length < 3) return null;
  
  // Sort by date
  transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  // Calculate intervals between transactions (in days)
  const intervals: number[] = [];
  for (let i = 1; i < transactions.length; i++) {
    const prev = new Date(transactions[i-1].date);
    const curr = new Date(transactions[i].date);
    const daysDiff = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
    intervals.push(daysDiff);
  }
  
  // Analyze frequency pattern
  const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
  const intervalVariance = calculateVariance(intervals);
  
  // Determine frequency category
  let frequency: IncomePattern['frequency'] = 'irregular';
  let expectedInterval = avgInterval;
  
  if (Math.abs(avgInterval - 7) <= 2 && intervalVariance < 4) {
    frequency = 'weekly';
    expectedInterval = 7;
  } else if (Math.abs(avgInterval - 14) <= 3 && intervalVariance < 9) {
    frequency = 'bi-weekly';
    expectedInterval = 14;
  } else if (Math.abs(avgInterval - 15) <= 4 && intervalVariance < 16) {
    frequency = 'bi-monthly';
    expectedInterval = 15;
  } else if (Math.abs(avgInterval - 30) <= 5 && intervalVariance < 25) {
    frequency = 'monthly';
    expectedInterval = 30;
  }
  
  // Calculate amount consistency (use absolute values for income amounts)
  const amounts = transactions.map(t => Math.abs(t.amount));
  const avgAmount = amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length;
  const amountVariance = calculateVariance(amounts);
  const amountConsistency = Math.max(0, 100 - (amountVariance / avgAmount) * 100);
  
  // Calculate confidence score
  let confidenceScore = 0;
  
  // Frequency consistency (40% of score)
  const frequencyConsistency = Math.max(0, 100 - (intervalVariance / expectedInterval) * 10);
  confidenceScore += frequencyConsistency * 0.4;
  
  // Amount consistency (30% of score)
  confidenceScore += amountConsistency * 0.3;
  
  // Transaction count bonus (20% of score)
  const countBonus = Math.min(100, (transactions.length - 3) * 10 + 60);
  confidenceScore += countBonus * 0.2;
  
  // Regularity bonus (10% of score)
  const regularityBonus = frequency !== 'irregular' ? 100 : 0;
  confidenceScore += regularityBonus * 0.1;
  
  confidenceScore = Math.round(confidenceScore);
  
  // Get the most common account for this income source
  const accountCounts = new Map<string, number>();
  transactions.forEach((t: TransactionData) => {
    accountCounts.set(t.account_id, (accountCounts.get(t.account_id) || 0) + 1);
  });
  const primaryAccount = Array.from(accountCounts.entries())
    .sort((a, b) => b[1] - a[1])[0][0];
  
  return {
    source_name: sourcePattern,
    pattern: sourcePattern,
    frequency,
    expected_amount: Math.round(avgAmount * 100) / 100, // Already absolute value
    confidence_score: confidenceScore,
    intervals,
    dates: transactions.map(t => t.date),
    amounts,
    account_id: primaryAccount
  };
}

function calculateVariance(numbers: number[]): number {
  const mean = numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
  const squaredDiffs = numbers.map(num => Math.pow(num - mean, 2));
  return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / numbers.length;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function logIncomeAnalysis(supabase: any, userId: string, result: AnalysisResult) {
  try {
    await supabase
      .from('income_detection_log')
      .insert({
        user_id: userId,
        lookback_months: result.lookback_months,
        transactions_analyzed: result.total_transactions_analyzed,
        patterns_detected: result.patterns_detected.length,
        detection_results: result,
        confidence_average: result.analysis_confidence,
        status: 'completed'
      });
  } catch (error) {
    console.error('Failed to log income analysis:', error);
  }
} 