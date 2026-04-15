import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
});

interface RecurringPattern {
  merchant: string;
  transactions: Array<{
    id: string;
    amount: number;
    date: string;
  }>;
  averageAmount: number;
  amountStdDev: number;
  frequency: string;
  intervalDays: number;
  intervalStdDev: number;
  confidence: number;
  occurrenceCount: number;
  streakCount: number;
  lastDate: string;
  nextPredictedDate: string;
}

interface MultiPatternMerchant {
  merchant: string;
  patterns: Array<{
    averageAmount: number;
    frequency: string;
    transactionCount: number;
    description: string; // AI-generated description of what this pattern is
  }>;
  shouldSplit: boolean;
  aiReasoning: string;
}

export async function POST(request: NextRequest) {
  try {
    const { userId, scanAllUsers = false } = await request.json();
    
    if (!scanAllUsers && !userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    let userIds: string[] = [];
    
    if (scanAllUsers) {
      // Get all active users with connected accounts
      const { data: activeUsers } = await supabase
        .from('items')
        .select('user_id')
        .is('deleted_at', null);
      
      if (activeUsers) {
        userIds = [...new Set(activeUsers.map(item => item.user_id))];
      }
    } else {
      userIds = [userId];
    }

    const results = {
      totalUsers: userIds.length,
      processedUsers: 0,
      newBillsDetected: 0,
      billsMarkedPaid: 0,
      billsMarkedDormant: 0,
      amountChangesDetected: 0,
      multiPatternMerchantsDetected: 0,
      errors: [] as string[]
    };

    // Process each user
    for (const currentUserId of userIds) {
      try {
        const userResult = await processUserExpenses(currentUserId);
        results.processedUsers++;
        results.newBillsDetected += userResult.newBills;
        results.billsMarkedPaid += userResult.paidBills;
        results.billsMarkedDormant += userResult.dormantBills;
        results.amountChangesDetected += userResult.amountChanges;
        results.multiPatternMerchantsDetected += userResult.multiPatternSplits;
      } catch (error) {
        console.error(`❌ Error processing user ${currentUserId}:`, error);
        results.errors.push(`User ${currentUserId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json({
      success: true,
      results
    });

  } catch (error) {
    console.error('❌ AI Lifecycle scan error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function processUserExpenses(userId: string): Promise<{
  newBills: number;
  paidBills: number;
  dormantBills: number;
  amountChanges: number;
  multiPatternSplits: number;
}> {
  // Get user's items
  const { data: userItems } = await supabase
    .from('items')
    .select('plaid_item_id')
    .eq('user_id', userId)
    .is('deleted_at', null);

  if (!userItems || userItems.length === 0) {
    return { newBills: 0, paidBills: 0, dormantBills: 0, amountChanges: 0, multiPatternSplits: 0 };
  }

  const itemIds = userItems.map(item => item.plaid_item_id);

  // Get last 6 months of transactions (positive = expenses)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const { data: transactions } = await supabase
    .from('transactions')
    .select('id, amount, date, merchant_name, name, ai_merchant_name, ai_category_tag')
    .in('plaid_item_id', itemIds)
    .gt('amount', 0) // Only expenses
    .gte('date', sixMonthsAgo.toISOString().split('T')[0])
    .order('date', { ascending: false });

  if (!transactions || transactions.length === 0) {
    return { newBills: 0, paidBills: 0, dormantBills: 0, amountChanges: 0, multiPatternSplits: 0 };
  }

  // Step 1: Detect recurring patterns
  const recurringPatterns = await detectRecurringPatterns(transactions);
  // Step 2: Detect multi-pattern merchants with AI
  const multiPatternMerchants = await detectMultiPatternMerchants(transactions, recurringPatterns);
  // Step 3: Get existing tagged merchants
  const { data: existingBills } = await supabase
    .from('tagged_merchants')
    .select('*')
    .eq('user_id', userId);

  const existingBillsMap = new Map(
    (existingBills || []).map(bill => [bill.merchant_name.toLowerCase(), bill])
  );

  const stats = {
    newBills: 0,
    paidBills: 0,
    dormantBills: 0,
    amountChanges: 0,
    multiPatternSplits: 0
  };

  // Step 4: Process multi-pattern merchants (auto-split)
  for (const multiMerchant of multiPatternMerchants) {
    if (multiMerchant.shouldSplit) {
      await createSplitBills(userId, multiMerchant, itemIds[0]);
      stats.multiPatternSplits += multiMerchant.patterns.length;
    }
  }

  // Step 5: Process new bills
  for (const pattern of recurringPatterns) {
    const merchantKey = pattern.merchant.toLowerCase();
    const existingBill = existingBillsMap.get(merchantKey);

    if (!existingBill) {
      // New bill detected - auto-add
      await createNewBill(userId, pattern, itemIds[0]);
      stats.newBills++;
    } else {
      // Existing bill - check for updates
      const updateStats = await updateExistingBill(existingBill, pattern, transactions);
      stats.paidBills += updateStats.paid ? 1 : 0;
      stats.amountChanges += updateStats.amountChanged ? 1 : 0;
    }
  }

  // Step 6: Check for dormant bills
  for (const [, existingBill] of existingBillsMap) {
    const matchingPattern = recurringPatterns.find(
      p => p.merchant.toLowerCase() === existingBill.merchant_name.toLowerCase()
    );

    if (!matchingPattern && existingBill.is_active) {
      // Bill hasn't occurred in 6 months - mark as dormant
      await markBillAsDormant(existingBill.id);
      stats.dormantBills++;
    }
  }

  return stats;
}

// Detect recurring transaction patterns using interval-based analysis
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function detectRecurringPatterns(transactions: any[]): RecurringPattern[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const merchantGroups = new Map<string, any[]>();

  transactions.forEach(tx => {
    const merchant = (tx.ai_merchant_name || tx.merchant_name || tx.name || '').trim();
    if (!merchant) return;

    const key = merchant.toLowerCase();
    if (!merchantGroups.has(key)) {
      merchantGroups.set(key, []);
    }
    merchantGroups.get(key)!.push({
      id: tx.id,
      amount: parseFloat(tx.amount),
      date: tx.date
    });
  });

  const patterns: RecurringPattern[] = [];

  for (const [merchant, txs] of merchantGroups) {
    if (txs.length < 3) continue;

    txs.sort((a: { date: string }, b: { date: string }) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const intervals: number[] = [];
    for (let i = 1; i < txs.length; i++) {
      const days = Math.abs(
        (new Date(txs[i].date).getTime() - new Date(txs[i - 1].date).getTime()) /
        (1000 * 60 * 60 * 24)
      );
      intervals.push(days);
    }

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const intervalStdDev = Math.sqrt(calculateVariance(intervals));
    const intervalCV = avgInterval > 0 ? intervalStdDev / avgInterval : 999;

    // Filter: interval must have reasonable consistency (CV < 0.5)
    // and average interval must be >= 5 days (skip daily purchases like coffee)
    if (intervalCV > 0.5 || avgInterval < 5) continue;

    const amounts = txs.map((tx: { amount: number }) => tx.amount);
    const averageAmount = amounts.reduce((a: number, b: number) => a + b, 0) / amounts.length;
    const amountStdDev = Math.sqrt(calculateVariance(amounts));
    const amountCV = averageAmount > 0 ? amountStdDev / averageAmount : 999;

    // Filter out high-frequency variable spending (grocery stores, gas, etc.)
    // A true bill has either: consistent amounts (amountCV < 0.3) OR a clear interval pattern (intervalCV < 0.2)
    if (amountCV > 0.3 && intervalCV > 0.2) continue;

    // Calculate streak: consecutive intervals within 20% of mean
    let streak = 0;
    for (let i = intervals.length - 1; i >= 0; i--) {
      if (Math.abs(intervals[i] - avgInterval) / avgInterval <= 0.2) {
        streak++;
      } else {
        break;
      }
    }

    // Confidence formula based on historical profile
    // Base: start at 50, build up from consistency metrics
    const intervalScore = Math.max(0, (1 - intervalCV) * 40); // 0-40 pts
    const amountScore = Math.max(0, (1 - amountCV) * 30);     // 0-30 pts
    const countScore = Math.min(20, txs.length * 3);            // 0-20 pts (capped)
    const streakBonus = Math.min(10, streak * 2);               // 0-10 pts
    const confidence = Math.round(Math.min(99, intervalScore + amountScore + countScore + streakBonus));

    if (confidence < 40) continue;

    // Derive human-readable frequency label from interval_days
    const frequency = deriveFrequencyLabel(avgInterval);

    const lastDate = new Date(txs[txs.length - 1].date);
    const nextDate = new Date(lastDate);
    nextDate.setDate(nextDate.getDate() + Math.round(avgInterval));

    patterns.push({
      merchant,
      transactions: txs,
      averageAmount,
      amountStdDev,
      frequency,
      intervalDays: Math.round(avgInterval),
      intervalStdDev: Math.round(intervalStdDev * 10) / 10,
      confidence,
      occurrenceCount: txs.length,
      streakCount: streak,
      lastDate: txs[txs.length - 1].date,
      nextPredictedDate: nextDate.toISOString().split('T')[0]
    });
  }

  return patterns;
}

function deriveFrequencyLabel(intervalDays: number): string {
  if (intervalDays <= 9) return 'weekly';
  if (intervalDays <= 16) return 'bi-weekly';
  if (intervalDays >= 25 && intervalDays <= 35) return 'monthly';
  if (intervalDays >= 55 && intervalDays <= 65) return 'bi-monthly';
  if (intervalDays >= 85 && intervalDays <= 95) return 'quarterly';
  if (intervalDays >= 170 && intervalDays <= 200) return 'semi-annual';
  if (intervalDays >= 350 && intervalDays <= 380) return 'annual';
  return `every ${intervalDays} days`;
}

// AI-powered multi-pattern detection
async function detectMultiPatternMerchants(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _transactions: any[],
  patterns: RecurringPattern[]
): Promise<MultiPatternMerchant[]> {
  const merchantPatternMap = new Map<string, RecurringPattern[]>();

  // Group patterns by merchant
  patterns.forEach(pattern => {
    const key = pattern.merchant.toLowerCase();
    if (!merchantPatternMap.has(key)) {
      merchantPatternMap.set(key, []);
    }
    merchantPatternMap.get(key)!.push(pattern);
  });

  const multiPatternMerchants: MultiPatternMerchant[] = [];

  // Check for merchants with multiple patterns
  for (const [merchant, merchantPatterns] of merchantPatternMap) {
    if (merchantPatterns.length < 2) continue;

    // Use AI to determine if these should be split
    const aiAnalysis = await analyzeMultiPatternWithAI(merchant, merchantPatterns);
    
    if (aiAnalysis.shouldSplit) {
      multiPatternMerchants.push(aiAnalysis);
    }
  }

  return multiPatternMerchants;
}

// AI analysis of multi-pattern merchants
async function analyzeMultiPatternWithAI(
  merchant: string,
  patterns: RecurringPattern[]
): Promise<MultiPatternMerchant> {
  const prompt = `Analyze this merchant's recurring transaction patterns and determine if they represent distinct bill types that should be tracked separately:

Merchant: ${merchant}

Patterns:
${patterns.map((p, i) => `${i + 1}. $${p.averageAmount.toFixed(2)} every ${p.frequency} (${p.transactions.length} occurrences)`).join('\n')}

Should these patterns be split into separate bills? Consider:
- Do the amounts suggest different services? (e.g., phone plan vs device payment)
- Are the amounts consistent enough to track separately?
- Would splitting provide better tracking value?

Respond in JSON format:
{
  "shouldSplit": true/false,
  "reasoning": "brief explanation",
  "patterns": [
    {
      "description": "what this pattern represents (e.g., 'Device Payment', 'Monthly Plan')",
      "averageAmount": number,
      "frequency": "weekly/monthly/quarterly"
    }
  ]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a financial expense analyzer. Determine if merchants with multiple recurring patterns should be split into separate trackable bills. Return valid JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 500
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('No AI response');

    const aiResult = JSON.parse(content);

    return {
      merchant,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      patterns: aiResult.patterns.map((p: any, i: number) => ({
        averageAmount: p.averageAmount || patterns[i].averageAmount,
        frequency: p.frequency || patterns[i].frequency,
        transactionCount: patterns[i].transactions.length,
        description: p.description || `Pattern ${i + 1}`
      })),
      shouldSplit: aiResult.shouldSplit,
      aiReasoning: aiResult.reasoning
    };
  } catch (error) {
    console.error('AI multi-pattern analysis failed:', error);
    
    // Fallback: Only split if amounts differ by > 50%
    const amounts = patterns.map(p => p.averageAmount);
    const maxAmount = Math.max(...amounts);
    const minAmount = Math.min(...amounts);
    const shouldSplit = (maxAmount - minAmount) / minAmount > 0.5;

    return {
      merchant,
      patterns: patterns.map((p, i) => ({
        averageAmount: p.averageAmount,
        frequency: p.frequency,
        transactionCount: p.transactions.length,
        description: `Pattern ${i + 1}`
      })),
      shouldSplit,
      aiReasoning: 'Fallback: Amount variance analysis'
    };
  }
}

// Create split bills for multi-pattern merchant
async function createSplitBills(
  userId: string,
  multiMerchant: MultiPatternMerchant,
  accountIdentifier: string
) {
  const splitGroupId = `split_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  for (const pattern of multiMerchant.patterns) {
    const merchantName = `${multiMerchant.merchant} - ${pattern.description}`;
    
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + getIntervalDays(pattern.frequency));

    await supabase
      .from('tagged_merchants')
      .insert({
        user_id: userId,
        merchant_name: merchantName,
        merchant_pattern: multiMerchant.merchant,
        expected_amount: pattern.averageAmount,
        prediction_frequency: pattern.frequency,
        confidence_score: 80,
        is_active: true,
        auto_detected: true,
        account_identifier: accountIdentifier,
        next_predicted_date: nextDate.toISOString().split('T')[0],
        split_group_id: splitGroupId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

  }
}

async function createNewBill(
  userId: string,
  pattern: RecurringPattern,
  accountIdentifier: string
) {
  await supabase
    .from('tagged_merchants')
    .insert({
      user_id: userId,
      merchant_name: pattern.merchant,
      merchant_pattern: pattern.merchant,
      expected_amount: pattern.averageAmount,
      prediction_frequency: pattern.frequency,
      confidence_score: pattern.confidence,
      is_active: true,
      auto_detected: true,
      account_identifier: accountIdentifier,
      next_predicted_date: pattern.nextPredictedDate,
      last_transaction_date: pattern.lastDate,
      interval_days: pattern.intervalDays,
      interval_std_dev: pattern.intervalStdDev,
      amount_std_dev: pattern.amountStdDev,
      occurrence_count: pattern.occurrenceCount,
      streak_count: pattern.streakCount,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
}

async function updateExistingBill(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  existingBill: any,
  pattern: RecurringPattern,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
  _transactions: any[]
): Promise<{ paid: boolean; amountChanged: boolean }> {
  let paid = false;
  let amountChanged = false;

  const recentTx = pattern.transactions.find(tx => {
    const txDate = new Date(tx.date);
    const predictedDate = new Date(existingBill.next_predicted_date);
    const daysDiff = Math.abs((txDate.getTime() - predictedDate.getTime()) / (1000 * 60 * 60 * 24));
    return daysDiff <= 3 && Math.abs(tx.amount - existingBill.expected_amount) / existingBill.expected_amount < 0.1;
  });

  if (recentTx) {
    const nextDate = new Date(recentTx.date);
    nextDate.setDate(nextDate.getDate() + pattern.intervalDays);

    await supabase
      .from('tagged_merchants')
      .update({
        status: 'paid',
        last_paid_date: recentTx.date,
        next_predicted_date: nextDate.toISOString().split('T')[0],
        last_status_check: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', existingBill.id);

    paid = true;
  }

  // Always update the interval-based stats from the latest pattern analysis
  const updatePayload: Record<string, unknown> = {
    interval_days: pattern.intervalDays,
    interval_std_dev: pattern.intervalStdDev,
    amount_std_dev: pattern.amountStdDev,
    occurrence_count: pattern.occurrenceCount,
    streak_count: pattern.streakCount,
    prediction_frequency: pattern.frequency,
    confidence_score: pattern.confidence,
    updated_at: new Date().toISOString()
  };

  if (Math.abs(pattern.averageAmount - existingBill.expected_amount) / existingBill.expected_amount > 0.1) {
    updatePayload.expected_amount = pattern.averageAmount;
    updatePayload.amount_drift = pattern.averageAmount - existingBill.expected_amount;
    amountChanged = true;
  }

  await supabase
    .from('tagged_merchants')
    .update(updatePayload)
    .eq('id', existingBill.id);

  return { paid, amountChanged };
}

// Mark bill as dormant
async function markBillAsDormant(billId: number) {
  await supabase
    .from('tagged_merchants')
    .update({
      lifecycle_state: 'dormant',
      is_active: false,
      updated_at: new Date().toISOString()
    })
    .eq('id', billId);

}

// Helper functions
function calculateVariance(numbers: number[]): number {
  const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
  const squaredDiffs = numbers.map(n => Math.pow(n - mean, 2));
  return squaredDiffs.reduce((a, b) => a + b, 0) / numbers.length;
}

function getIntervalDays(frequency: string): number {
  switch (frequency) {
    case 'weekly': return 7;
    case 'bi-weekly': return 14;
    case 'monthly': return 30;
    case 'bi-monthly': return 60;
    case 'quarterly': return 90;
    case 'semi-annual': return 182;
    case 'annual': return 365;
    default: {
      const match = frequency.match(/every (\d+) days/);
      return match ? parseInt(match[1], 10) : 30;
    }
  }
}

