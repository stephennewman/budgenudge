import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface TaggedMerchant {
  id: number;
  user_id: string | null;
  merchant_name: string;
  merchant_pattern: string | null;
  expected_amount: number;
  prediction_frequency: string;
  confidence_score: number;
  is_active: boolean;
  next_predicted_date: string | null;
  last_paid_date: string | null;
  last_transaction_date: string | null;
  status: string | null;
  account_identifier: string | null;
  interval_days: number | null;
  interval_std_dev: number | null;
  amount_std_dev: number | null;
  occurrence_count: number | null;
  streak_count: number | null;
}

interface Transaction {
  id: number;
  date: string;
  amount: number;
  merchant_name: string | null;
  name: string;
  ai_merchant_name: string | null;
}

export interface BillTimelineEntry {
  id: number;
  merchant_name: string;
  expected_amount: number;
  actual_amount?: number;
  predicted_date: string;
  actual_date?: string;
  status: 'paid' | 'upcoming' | 'overdue';
  confidence_score: number;
  prediction_frequency: string;
  days_off?: number;
  interval_days?: number;
}

export interface ReconciliationResult {
  paid: BillTimelineEntry[];
  upcoming: BillTimelineEntry[];
  overdue: BillTimelineEntry[];
  totalPaid: number;
  totalUpcoming: number;
  totalOverdue: number;
  reconciledCount: number;
}

export async function reconcileUserBills(userId: string): Promise<ReconciliationResult> {
  const { data: merchants, error: mErr } = await supabase
    .from('tagged_merchants')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (mErr || !merchants || merchants.length === 0) {
    return emptyResult();
  }

  const { data: userItems } = await supabase
    .from('items')
    .select('plaid_item_id')
    .eq('user_id', userId)
    .is('deleted_at', null);

  if (!userItems || userItems.length === 0) {
    return emptyResult();
  }

  const itemIds = userItems.map(i => i.plaid_item_id);

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const { data: transactions } = await supabase
    .from('transactions')
    .select('id, date, amount, merchant_name, name, ai_merchant_name')
    .in('plaid_item_id', itemIds)
    .gt('amount', 0)
    .gte('date', ninetyDaysAgo.toISOString().split('T')[0])
    .order('date', { ascending: false });

  if (!transactions) {
    return buildTimeline(merchants as TaggedMerchant[], []);
  }

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  let reconciledCount = 0;

  for (const merchant of merchants as TaggedMerchant[]) {
    const predictedDate = merchant.next_predicted_date;
    if (!predictedDate) continue;

    const sinceDate = merchant.last_paid_date || ninetyDaysAgo.toISOString().split('T')[0];

    const matchingTx = findMatchingTransaction(
      merchant.merchant_name,
      transactions as Transaction[],
      sinceDate
    );

    if (!matchingTx) {
      if (predictedDate < todayStr) {
        const rolledDate = rollDateForward(predictedDate, merchant, todayStr);
        if (rolledDate !== predictedDate) {
          await supabase
            .from('tagged_merchants')
            .update({
              next_predicted_date: rolledDate,
              status: 'predicted',
              updated_at: new Date().toISOString()
            })
            .eq('id', merchant.id);
          merchant.next_predicted_date = rolledDate;
          merchant.status = 'predicted';
        }
      }
      continue;
    }

    const txDate = matchingTx.date;
    const txAmount = matchingTx.amount;

    const newConfidence = computeConfidence(merchant, predictedDate, txDate, txAmount);
    const newStreak = computeStreak(merchant, predictedDate, txDate, txAmount);

    const nextDate = advanceByInterval(txDate, merchant);
    const rolledNext = rollDateForward(nextDate, merchant, todayStr);

    const drift = txAmount - merchant.expected_amount;

    await supabase
      .from('tagged_merchants')
      .update({
        status: 'paid',
        last_paid_date: txDate,
        paid_date: txDate,
        last_transaction_date: txDate,
        next_predicted_date: rolledNext,
        expected_amount: txAmount,
        confidence_score: newConfidence,
        amount_drift: drift !== 0 ? drift : 0,
        streak_count: newStreak,
        last_status_check: new Date().toISOString(),
        merchant_pattern: merchant.merchant_pattern || merchant.merchant_name.toLowerCase(),
        updated_at: new Date().toISOString()
      })
      .eq('id', merchant.id);

    merchant.last_paid_date = txDate;
    merchant.next_predicted_date = rolledNext;
    merchant.expected_amount = txAmount;
    merchant.confidence_score = newConfidence;
    merchant.streak_count = newStreak;
    merchant.status = 'paid';
    reconciledCount++;
  }

  const result = buildTimeline(merchants as TaggedMerchant[], transactions as Transaction[]);
  result.reconciledCount = reconciledCount;
  return result;
}

function computeConfidence(
  merchant: TaggedMerchant,
  predictedDate: string,
  actualDate: string,
  actualAmount: number
): number {
  const intervalDays = merchant.interval_days || 30;
  const intervalStdDev = merchant.interval_std_dev || 5;
  const amountStdDev = merchant.amount_std_dev || 0;
  const occurrences = merchant.occurrence_count || 3;
  const currentStreak = merchant.streak_count || 0;

  // Interval consistency: CV = std_dev / mean (lower = more predictable)
  const intervalCV = intervalDays > 0 ? intervalStdDev / intervalDays : 0.5;
  // Amount consistency: CV = std_dev / mean
  const amountCV = merchant.expected_amount > 0 ? amountStdDev / merchant.expected_amount : 0;

  // Base score from historical consistency (0-40)
  const intervalScore = Math.max(0, (1 - intervalCV) * 40);
  // Amount consistency (0-30)
  const amountScore = Math.max(0, (1 - amountCV) * 30);
  // Occurrence depth (0-15, grows slowly)
  const countScore = Math.min(15, occurrences * 2);
  // Streak bonus (0-15)
  const streakScore = Math.min(15, currentStreak * 3);

  let baseConfidence = intervalScore + amountScore + countScore + streakScore;

  // Penalize this specific reconciliation if it deviated from prediction
  const daysDiff = Math.abs(daysBetween(predictedDate, actualDate));
  // 3% per day off for date variance (as user requested)
  const datePenalty = daysDiff * 3;

  const amountDiffPct = merchant.expected_amount > 0
    ? Math.abs(actualAmount - merchant.expected_amount) / merchant.expected_amount * 100
    : 0;

  baseConfidence -= datePenalty;
  baseConfidence -= amountDiffPct;

  // Boost if exact match on date
  if (daysDiff === 0) baseConfidence += 3;
  // Boost if exact match on amount (within $0.50)
  if (Math.abs(actualAmount - merchant.expected_amount) < 0.5) baseConfidence += 2;

  return Math.round(Math.max(20, Math.min(99, baseConfidence)));
}

function computeStreak(
  merchant: TaggedMerchant,
  predictedDate: string,
  actualDate: string,
  actualAmount: number
): number {
  const currentStreak = merchant.streak_count || 0;
  const intervalDays = merchant.interval_days || 30;
  const daysDiff = Math.abs(daysBetween(predictedDate, actualDate));
  const amountDiffPct = merchant.expected_amount > 0
    ? Math.abs(actualAmount - merchant.expected_amount) / merchant.expected_amount
    : 0;

  // "On target" = within 20% of interval for date, and within 10% for amount
  const dateOnTarget = daysDiff <= Math.max(2, intervalDays * 0.2);
  const amountOnTarget = amountDiffPct <= 0.1;

  if (dateOnTarget && amountOnTarget) {
    return currentStreak + 1;
  }
  return 0;
}

function findMatchingTransaction(
  merchantName: string,
  transactions: Transaction[],
  sinceDate: string
): Transaction | null {
  const needle = merchantName.toLowerCase().trim();
  const needleWords = needle.split(/[\s\-_]+/).filter(w => w.length > 2);

  for (const tx of transactions) {
    if (tx.date <= sinceDate) continue;

    const candidates = [
      tx.ai_merchant_name?.toLowerCase().trim(),
      tx.merchant_name?.toLowerCase().trim(),
      tx.name?.toLowerCase().trim()
    ].filter(Boolean) as string[];

    for (const candidate of candidates) {
      if (candidate.includes(needle) || needle.includes(candidate)) {
        return tx;
      }
      if (needleWords.length >= 2) {
        const matchedWords = needleWords.filter(w => candidate.includes(w));
        if (matchedWords.length >= Math.ceil(needleWords.length * 0.6)) {
          return tx;
        }
      }
    }
  }
  return null;
}

function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA + 'T12:00:00');
  const b = new Date(dateB + 'T12:00:00');
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function advanceByInterval(dateStr: string, merchant: TaggedMerchant): string {
  const d = new Date(dateStr + 'T12:00:00');

  if (merchant.interval_days && merchant.interval_days > 0) {
    d.setDate(d.getDate() + Math.round(merchant.interval_days));
    return d.toISOString().split('T')[0];
  }

  return advanceByFrequency(dateStr, merchant.prediction_frequency);
}

function advanceByFrequency(dateStr: string, frequency: string): string {
  const d = new Date(dateStr + 'T12:00:00');

  const daysMatch = frequency.match(/every (\d+) days/);
  if (daysMatch) {
    d.setDate(d.getDate() + parseInt(daysMatch[1], 10));
    return d.toISOString().split('T')[0];
  }

  switch (frequency) {
    case 'weekly':
      d.setDate(d.getDate() + 7);
      break;
    case 'bi-weekly':
      d.setDate(d.getDate() + 14);
      break;
    case 'monthly':
      d.setMonth(d.getMonth() + 1);
      break;
    case 'bi-monthly':
      d.setMonth(d.getMonth() + 2);
      break;
    case 'quarterly':
      d.setMonth(d.getMonth() + 3);
      break;
    case 'semi-annual':
      d.setMonth(d.getMonth() + 6);
      break;
    case 'annual':
      d.setMonth(d.getMonth() + 12);
      break;
    default:
      d.setMonth(d.getMonth() + 1);
  }
  return d.toISOString().split('T')[0];
}

function rollDateForward(dateStr: string, merchant: TaggedMerchant, todayStr: string): string {
  let current = dateStr;
  let safety = 0;
  while (current < todayStr && safety < 50) {
    current = advanceByInterval(current, merchant);
    safety++;
  }
  return current;
}

function buildTimeline(merchants: TaggedMerchant[], transactions: Transaction[]): ReconciliationResult {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const monthStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthStart = monthStartDate.toISOString().split('T')[0];
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  const dayBeforeMonthStart = new Date(monthStartDate.getTime() - 86400000).toISOString().split('T')[0];

  const paid: BillTimelineEntry[] = [];
  const upcoming: BillTimelineEntry[] = [];
  const overdue: BillTimelineEntry[] = [];

  for (const m of merchants) {
    if (m.last_paid_date && m.last_paid_date >= monthStart && m.last_paid_date <= monthEnd) {
      const matchTx = findMatchingTransaction(m.merchant_name, transactions, dayBeforeMonthStart);
      const actualAmount = matchTx ? matchTx.amount : m.expected_amount;

      const predictedForThisCycle = m.next_predicted_date
        ? rewindByInterval(m.next_predicted_date, m)
        : m.last_paid_date;

      const daysOff = predictedForThisCycle
        ? Math.abs(daysBetween(predictedForThisCycle, m.last_paid_date))
        : 0;

      paid.push({
        id: m.id,
        merchant_name: m.merchant_name,
        expected_amount: m.expected_amount,
        actual_amount: actualAmount,
        predicted_date: predictedForThisCycle || m.last_paid_date,
        actual_date: m.last_paid_date,
        status: 'paid',
        confidence_score: m.confidence_score,
        prediction_frequency: m.prediction_frequency,
        days_off: daysOff,
        interval_days: m.interval_days || undefined
      });
    }

    if (m.next_predicted_date && m.next_predicted_date >= todayStr && m.next_predicted_date <= monthEnd) {
      upcoming.push({
        id: m.id,
        merchant_name: m.merchant_name,
        expected_amount: m.expected_amount,
        predicted_date: m.next_predicted_date,
        status: 'upcoming',
        confidence_score: m.confidence_score,
        prediction_frequency: m.prediction_frequency,
        interval_days: m.interval_days || undefined
      });
    }
  }

  paid.sort((a, b) => (a.actual_date || a.predicted_date).localeCompare(b.actual_date || b.predicted_date));
  upcoming.sort((a, b) => a.predicted_date.localeCompare(b.predicted_date));

  return {
    paid,
    upcoming,
    overdue,
    totalPaid: paid.reduce((s, e) => s + (e.actual_amount || e.expected_amount), 0),
    totalUpcoming: upcoming.reduce((s, e) => s + e.expected_amount, 0),
    totalOverdue: 0,
    reconciledCount: 0
  };
}

function rewindByInterval(dateStr: string, merchant: TaggedMerchant): string {
  const d = new Date(dateStr + 'T12:00:00');

  if (merchant.interval_days && merchant.interval_days > 0) {
    d.setDate(d.getDate() - Math.round(merchant.interval_days));
    return d.toISOString().split('T')[0];
  }

  return rewindByFrequency(dateStr, merchant.prediction_frequency);
}

function rewindByFrequency(dateStr: string, frequency: string): string {
  const d = new Date(dateStr + 'T12:00:00');

  const daysMatch = frequency.match(/every (\d+) days/);
  if (daysMatch) {
    d.setDate(d.getDate() - parseInt(daysMatch[1], 10));
    return d.toISOString().split('T')[0];
  }

  switch (frequency) {
    case 'weekly':
      d.setDate(d.getDate() - 7);
      break;
    case 'bi-weekly':
      d.setDate(d.getDate() - 14);
      break;
    case 'monthly':
      d.setMonth(d.getMonth() - 1);
      break;
    case 'bi-monthly':
      d.setMonth(d.getMonth() - 2);
      break;
    case 'quarterly':
      d.setMonth(d.getMonth() - 3);
      break;
    case 'semi-annual':
      d.setMonth(d.getMonth() - 6);
      break;
    case 'annual':
      d.setMonth(d.getMonth() - 12);
      break;
    default:
      d.setMonth(d.getMonth() - 1);
  }
  return d.toISOString().split('T')[0];
}

function emptyResult(): ReconciliationResult {
  return { paid: [], upcoming: [], overdue: [], totalPaid: 0, totalUpcoming: 0, totalOverdue: 0, reconciledCount: 0 };
}
