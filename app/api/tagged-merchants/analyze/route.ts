import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { merchant_name } = body;

    if (!merchant_name) {
      return NextResponse.json({ error: 'merchant_name is required' }, { status: 400 });
    }

    // Check if merchant is already tagged
    const { data: existingMerchant } = await supabase
      .from('tagged_merchants')
      .select('*')
      .eq('user_id', user.id)
      .ilike('merchant_name', merchant_name)
      .single();

    if (existingMerchant) {
      return NextResponse.json({ 
        error: 'Merchant is already in your recurring bills list',
        merchant: existingMerchant
      }, { status: 409 });
    }

    // Analyze merchant's transaction history
    const { data: transactions } = await supabase
      .from('transactions')
      .select('*')
      .or(`merchant_name.ilike.%${merchant_name}%,name.ilike.%${merchant_name}%`)
      .order('date', { ascending: false })
      .limit(50);

    if (!transactions || transactions.length < 2) {
      return NextResponse.json({ 
        error: 'Not enough transaction history to analyze this merchant (minimum 2 transactions required)' 
      }, { status:400 });
    }

    // Analyze transaction patterns
    const analysis = analyzeTransactionPattern(transactions);
    
    if (analysis.confidence_score < 60) {
      return NextResponse.json({ 
        error: `Transaction pattern not consistent enough for prediction (${analysis.confidence_score}% confidence)`,
        analysis
      }, { status:400 });
    }

    // Calculate next predicted date
    const lastTransaction = new Date(transactions[0].date);
    let nextPredictedDate: Date;
    
    switch (analysis.frequency) {
      case 'weekly':
        nextPredictedDate = new Date(lastTransaction.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        nextPredictedDate = new Date(lastTransaction.getFullYear(), lastTransaction.getMonth() + 1, lastTransaction.getDate());
        break;
      case 'quarterly':
        nextPredictedDate = new Date(lastTransaction.getFullYear(), lastTransaction.getMonth() + 3, lastTransaction.getDate());
        break;
      default:
        nextPredictedDate = new Date(lastTransaction.getFullYear(), lastTransaction.getMonth() + 1, lastTransaction.getDate());
    }

    // Add to tagged merchants
    const { data: newMerchant, error: insertError } = await supabase
      .from('tagged_merchants')
      .insert({
        user_id: user.id,
        merchant_name: merchant_name,
        merchant_pattern: merchant_name,
        expected_amount: analysis.expected_amount,
        prediction_frequency: analysis.frequency,
        confidence_score: analysis.confidence_score,
        auto_detected: false, // User-triggered analysis
        last_transaction_date: lastTransaction.toISOString().split('T')[0],
        next_predicted_date: nextPredictedDate.toISOString().split('T')[0],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting tagged merchant:', insertError);
      return NextResponse.json({ error: 'Failed to add merchant to recurring bills' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Successfully added ${merchant_name} to recurring bills`,
      merchant: newMerchant,
      analysis: {
        transaction_count: transactions.length,
        confidence_score: analysis.confidence_score,
        frequency: analysis.frequency,
        expected_amount: analysis.expected_amount,
        date_range: `${transactions[transactions.length - 1].date} to ${transactions[0].date}`
      }
    });

  } catch (error) {
    console.error('Merchant analysis error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

interface TransactionAnalysis {
  frequency: 'weekly' | 'monthly' | 'quarterly';
  expected_amount: number;
  confidence_score: number;
}

interface Transaction {
  id: string;
  amount: number;
  date: string;
  merchant_name?: string;
  name: string;
}

function analyzeTransactionPattern(transactions: Transaction[]): TransactionAnalysis {
  // Sort transactions by date (oldest first for interval calculation)
  const sortedTransactions = transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  // Calculate intervals between transactions
  const intervals: number[] = [];
  for (let i = 1; i < sortedTransactions.length; i++) {
    const date1 = new Date(sortedTransactions[i - 1].date);
    const date2 = new Date(sortedTransactions[i].date);
    const diffDays = Math.abs((date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24));
    intervals.push(diffDays);
  }

  // Calculate average interval
  const avgInterval = intervals.length > 0 ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 0;
  
  // Calculate amount consistency
  const amounts = sortedTransactions.map(t => Math.abs(t.amount));
  const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  const amountVariance = amounts.reduce((acc, amount) => acc + Math.pow(amount - avgAmount, 2), 0) / amounts.length;
  const amountStdDev = Math.sqrt(amountVariance);
  
  // Determine frequency based on average interval
  let frequency: 'weekly' | 'monthly' | 'quarterly';
  if (avgInterval <= 10) {
    frequency = 'weekly';
  } else if (avgInterval <= 40) {
    frequency = 'monthly';
  } else if (avgInterval <= 120) {
    frequency = 'quarterly';
  } else {
    frequency = 'monthly'; // Default
  }

  // Calculate confidence score
  let confidence = 75; // Base confidence
  
  // Boost confidence for more transactions
  if (transactions.length >= 5) confidence += 10;
  if (transactions.length >= 10) confidence += 5;
  
  // Boost confidence for consistent amounts (low standard deviation)
  const amountConsistency = Math.max(0, 100 - (amountStdDev / avgAmount * 100));
  confidence = Math.min(100, confidence + (amountConsistency * 0.2));
  
  // Boost confidence for consistent intervals
  if (intervals.length > 0) {
    const intervalVariance = intervals.reduce((acc, interval) => acc + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
    const intervalConsistency = Math.max(0, 100 - (Math.sqrt(intervalVariance) / avgInterval * 100));
    confidence = Math.min(100, confidence + (intervalConsistency * 0.15));
  }

  return {
    frequency,
    expected_amount: parseFloat(avgAmount.toFixed(2)),
    confidence_score: Math.round(confidence)
  };
} 