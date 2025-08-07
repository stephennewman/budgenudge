import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create Supabase client for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// TypeScript interfaces for the data
interface RecurringPattern {
  merchant_name: string;
  avg_amount: number;
  recurring_likelihood: number;
  frequency_pattern: string;
  next_predicted_date: string;
}

interface TransactionPattern {
  name: string;
  merchant_name?: string;
  amount: number;
  date: string;
}

export async function POST(request: NextRequest) {
  try {
    const { user_id, confidence_threshold = 85 } = await request.json();
    
    if (!user_id) {
      return NextResponse.json({ 
        success: false, 
        error: 'user_id is required' 
      }, { status: 400 });
    }

    console.log(`💳 Starting automatic recurring bill detection for user: ${user_id}`);
    
    // Get user's items to filter transactions
    const { data: items } = await supabase
      .from('items')
      .select('plaid_item_id')
      .eq('user_id', user_id);

    if (!items || items.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No connected accounts found',
        bills_detected: 0
      });
    }

    const itemIds = items.map(item => item.plaid_item_id);

    // Analyze transactions for recurring patterns (last 90 days minimum)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { data: transactions, error: transError } = await supabase
      .rpc('analyze_recurring_patterns', {
        p_user_id: user_id,
        p_item_ids: itemIds,
        p_min_frequency: 2,
        p_confidence_threshold: confidence_threshold
      });

    if (transError) {
      console.error('Error analyzing recurring patterns:', transError);
      // Fallback to manual analysis if function doesn't exist
      return await fallbackRecurringAnalysis(user_id, itemIds, confidence_threshold);
    }

        const billsToInsert = (transactions as RecurringPattern[])?.filter(t =>
      t.recurring_likelihood >= confidence_threshold
    ) || [];

    let billsDetected = 0;
    let totalMonthlyAmount = 0;

    // Insert detected bills into tagged_merchants
    for (const bill of billsToInsert) {
      try {
        const { error: insertError } = await supabase
          .from('tagged_merchants')
          .insert({
            user_id: user_id,
            merchant_name: bill.merchant_name,
            expected_amount: bill.avg_amount,
            next_predicted_date: bill.next_predicted_date,
            confidence_score: bill.recurring_likelihood,
            prediction_frequency: bill.frequency_pattern,
            is_active: true,
            auto_detected: true
          });

        if (!insertError) {
          billsDetected++;
          totalMonthlyAmount += parseFloat(bill.avg_amount);
          console.log(`✅ Auto-detected recurring bill: ${bill.merchant_name} - $${bill.avg_amount}`);
        }
      } catch {
        console.log(`⚠️ Skipped duplicate or invalid bill: ${bill.merchant_name}`);
      }
    }

    console.log(`🎯 Auto-detection complete: ${billsDetected} bills detected, $${totalMonthlyAmount.toFixed(2)} monthly total`);

    return NextResponse.json({
      success: true,
      bills_detected: billsDetected,
      total_monthly_amount: totalMonthlyAmount,
      confidence_threshold: confidence_threshold,
      analysis_period: '90 days',
      message: `Auto-detected ${billsDetected} recurring bills`
    });

  } catch (error) {
    console.error('❌ Auto-detect recurring bills error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      bills_detected: 0
    }, { status: 500 });
  }
}

// Fallback analysis using direct SQL queries
async function fallbackRecurringAnalysis(userId: string, itemIds: string[], confidenceThreshold: number) {
  try {
    console.log('🔄 Using fallback recurring bill analysis...');

    // Manual analysis query for recurring patterns
    const { data: patterns } = await supabase
      .from('transactions')
      .select('name, merchant_name, amount, date')
      .in('plaid_item_id', itemIds)
      .gt('amount', 5) // Minimum $5 transactions
      .eq('pending', false)
      .gte('date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (!patterns || patterns.length === 0) {
      return NextResponse.json({ 
        success: true, 
        bills_detected: 0,
        message: 'No transaction patterns found'
      });
    }

    // Group by merchant and analyze patterns
    const merchantGroups = new Map<string, TransactionPattern[]>();
    patterns.forEach((t: TransactionPattern) => {
      const key = t.merchant_name || t.name;
      if (!merchantGroups.has(key)) {
        merchantGroups.set(key, []);
      }
      merchantGroups.get(key)!.push(t);
    });

    let billsDetected = 0;
    let totalMonthlyAmount = 0;

    for (const [merchant, transactions] of merchantGroups) {
      if (transactions.length >= 2) {
        const amounts = transactions.map(t => t.amount);
        const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
        const stdDev = Math.sqrt(amounts.reduce((sq, n) => sq + Math.pow(n - avgAmount, 2), 0) / amounts.length);
        const consistency = stdDev === 0 ? 100 : Math.max(60, 100 - (stdDev / avgAmount) * 100);

        // Check for regular timing
        const dates = transactions.map(t => new Date(t.date)).sort((a, b) => a.getTime() - b.getTime());
        const daysBetween = dates.length > 1 ? 
          (dates[dates.length - 1].getTime() - dates[0].getTime()) / (1000 * 60 * 60 * 24) / (dates.length - 1) : 0;

        let frequency = 'irregular';
        if (daysBetween >= 25 && daysBetween <= 35) frequency = 'monthly';
        else if (daysBetween >= 12 && daysBetween <= 16) frequency = 'bi-weekly';
        else if (daysBetween >= 6 && daysBetween <= 8) frequency = 'weekly';

        const confidence = Math.min(100, consistency + (transactions.length * 5) + (frequency !== 'irregular' ? 15 : 0));

        if (confidence >= confidenceThreshold && avgAmount >= 10) {
          try {
            const nextDate = new Date();
            nextDate.setDate(nextDate.getDate() + Math.round(daysBetween));

            const { error: insertError } = await supabase
              .from('tagged_merchants')
              .insert({
                user_id: userId,
                merchant_name: merchant,
                expected_amount: avgAmount,
                next_predicted_date: nextDate.toISOString().split('T')[0],
                confidence_score: Math.round(confidence),
                prediction_frequency: frequency,
                is_active: true,
                auto_detected: true
              });

            if (!insertError) {
              billsDetected++;
              totalMonthlyAmount += avgAmount;
              console.log(`✅ Fallback auto-detected: ${merchant} - $${avgAmount.toFixed(2)} (${confidence.toFixed(0)}% confidence)`);
            }
          } catch {
            console.log(`⚠️ Skipped duplicate bill: ${merchant}`);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      bills_detected: billsDetected,
      total_monthly_amount: totalMonthlyAmount,
      confidence_threshold: confidenceThreshold,
      analysis_method: 'fallback',
      message: `Auto-detected ${billsDetected} recurring bills using fallback analysis`
    });

  } catch (error) {
    console.error('❌ Fallback analysis error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Fallback analysis failed',
      bills_detected: 0
    }, { status: 500 });
  }
}
