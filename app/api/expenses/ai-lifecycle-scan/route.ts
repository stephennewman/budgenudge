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
  frequency: 'weekly' | 'monthly' | 'quarterly';
  intervalDays: number;
  confidence: number;
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

// Detect recurring transaction patterns
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function detectRecurringPatterns(transactions: any[]): RecurringPattern[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const merchantGroups = new Map<string, any[]>();

  // Group by merchant
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

  // Analyze each merchant for recurring patterns
  for (const [merchant, txs] of merchantGroups) {
    if (txs.length < 3) continue; // Need at least 3 transactions

    // Sort by date
    txs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate intervals between transactions
    const intervals: number[] = [];
    for (let i = 1; i < txs.length; i++) {
      const days = Math.abs(
        (new Date(txs[i].date).getTime() - new Date(txs[i - 1].date).getTime()) /
        (1000 * 60 * 60 * 24)
      );
      intervals.push(days);
    }

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const intervalVariance = calculateVariance(intervals);
    
    // Determine frequency
    let frequency: 'weekly' | 'monthly' | 'quarterly' = 'monthly';
    if (avgInterval >= 5 && avgInterval <= 9) frequency = 'weekly';
    else if (avgInterval >= 25 && avgInterval <= 35) frequency = 'monthly';
    else if (avgInterval >= 80 && avgInterval <= 100) frequency = 'quarterly';
    else continue; // Not a clear pattern

    // Calculate confidence based on interval consistency
    const confidence = Math.max(0, 100 - (intervalVariance / avgInterval) * 100);
    if (confidence < 60) continue; // Too inconsistent

    // Calculate average amount
    const amounts = txs.map(tx => tx.amount);
    const averageAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;

    // Predict next date
    const lastDate = new Date(txs[txs.length - 1].date);
    const nextDate = new Date(lastDate);
    nextDate.setDate(nextDate.getDate() + Math.round(avgInterval));

    patterns.push({
      merchant,
      transactions: txs,
      averageAmount,
      frequency,
      intervalDays: Math.round(avgInterval),
      confidence: Math.round(confidence),
      lastDate: txs[txs.length - 1].date,
      nextPredictedDate: nextDate.toISOString().split('T')[0]
    });
  }

  return patterns;
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

// Create new bill from pattern
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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
}

// Update existing bill with new transaction data
async function updateExistingBill(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  existingBill: any,
  pattern: RecurringPattern,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
  _transactions: any[]
): Promise<{ paid: boolean; amountChanged: boolean }> {
  let paid = false;
  let amountChanged = false;

  // Check if there's a recent transaction matching this bill
  const recentTx = pattern.transactions.find(tx => {
    const txDate = new Date(tx.date);
    const predictedDate = new Date(existingBill.next_predicted_date);
    const daysDiff = Math.abs((txDate.getTime() - predictedDate.getTime()) / (1000 * 60 * 60 * 24));
    return daysDiff <= 3 && Math.abs(tx.amount - existingBill.expected_amount) / existingBill.expected_amount < 0.1;
  });

  if (recentTx) {
    // Mark as paid and roll forward
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

  // Check for amount change (>10% difference)
  if (Math.abs(pattern.averageAmount - existingBill.expected_amount) / existingBill.expected_amount > 0.1) {
    await supabase
      .from('tagged_merchants')
      .update({
        expected_amount: pattern.averageAmount,
        amount_drift: pattern.averageAmount - existingBill.expected_amount,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingBill.id);

    amountChanged = true;
  }

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
    case 'monthly': return 30;
    case 'quarterly': return 90;
    default: return 30;
  }
}

