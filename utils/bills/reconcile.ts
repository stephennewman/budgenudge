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

  // Fetch 90 days of transactions to cover multiple billing cycles
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

    // Find matching transactions after last_paid_date (or from 90 days ago)
    const sinceDate = merchant.last_paid_date || ninetyDaysAgo.toISOString().split('T')[0];

    const matchingTx = findMatchingTransaction(
      merchant.merchant_name,
      transactions as Transaction[],
      sinceDate
    );

    if (!matchingTx) {
      // No new matching transaction — just ensure next_predicted_date rolls forward if stale
      if (predictedDate < todayStr) {
        const rolledDate = rollDateForward(predictedDate, merchant.prediction_frequency, todayStr);
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

    // We found a matching transaction — reconcile
    const txDate = matchingTx.date;
    const txAmount = matchingTx.amount;

    // Calculate confidence adjustments
    const daysDiff = Math.abs(daysBetween(predictedDate, txDate));
    const amountDiffPct = merchant.expected_amount > 0
      ? Math.abs(txAmount - merchant.expected_amount) / merchant.expected_amount * 100
      : 0;

    let newConfidence = merchant.confidence_score;
    if (daysDiff === 0) {
      newConfidence = Math.min(99, newConfidence + 2);
    } else {
      newConfidence -= daysDiff * 3;
    }
    newConfidence -= Math.round(amountDiffPct);
    newConfidence = Math.max(20, Math.min(99, newConfidence));

    // Roll next_predicted_date forward from the actual transaction date
    const nextDate = advanceByFrequency(txDate, merchant.prediction_frequency);
    const rolledNext = rollDateForward(nextDate, merchant.prediction_frequency, todayStr);

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
        last_status_check: new Date().toISOString(),
        merchant_pattern: merchant.merchant_pattern || merchant.merchant_name.toLowerCase(),
        updated_at: new Date().toISOString()
      })
      .eq('id', merchant.id);

    // Update local object for timeline building
    merchant.last_paid_date = txDate;
    merchant.next_predicted_date = rolledNext;
    merchant.expected_amount = txAmount;
    merchant.confidence_score = newConfidence;
    merchant.status = 'paid';
    reconciledCount++;
  }

  const result = buildTimeline(merchants as TaggedMerchant[], transactions as Transaction[]);
  result.reconciledCount = reconciledCount;
  return result;
}

function findMatchingTransaction(
  merchantName: string,
  transactions: Transaction[],
  sinceDate: string
): Transaction | null {
  const needle = merchantName.toLowerCase().trim();

  // Build search variants: split on common separators for partial matching
  const needleWords = needle.split(/[\s\-_]+/).filter(w => w.length > 2);

  for (const tx of transactions) {
    if (tx.date <= sinceDate) continue;

    const candidates = [
      tx.ai_merchant_name?.toLowerCase().trim(),
      tx.merchant_name?.toLowerCase().trim(),
      tx.name?.toLowerCase().trim()
    ].filter(Boolean) as string[];

    for (const candidate of candidates) {
      // Direct substring match (either direction)
      if (candidate.includes(needle) || needle.includes(candidate)) {
        return tx;
      }
      // Word-level match: if most words in the needle appear in the candidate
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

function advanceByFrequency(dateStr: string, frequency: string): string {
  const d = new Date(dateStr + 'T12:00:00');
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
    default:
      d.setMonth(d.getMonth() + 1);
  }
  return d.toISOString().split('T')[0];
}

function rollDateForward(dateStr: string, frequency: string, todayStr: string): string {
  let current = dateStr;
  // Keep advancing until the date is in the future (or today)
  while (current < todayStr) {
    current = advanceByFrequency(current, frequency);
  }
  return current;
}

function buildTimeline(merchants: TaggedMerchant[], transactions: Transaction[]): ReconciliationResult {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const monthStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthStart = monthStartDate.toISOString().split('T')[0];
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  // Day before monthStart so findMatchingTransaction includes the 1st
  const dayBeforeMonthStart = new Date(monthStartDate.getTime() - 86400000).toISOString().split('T')[0];

  const paid: BillTimelineEntry[] = [];
  const upcoming: BillTimelineEntry[] = [];
  const overdue: BillTimelineEntry[] = [];

  for (const m of merchants) {
    // Check if paid this month
    if (m.last_paid_date && m.last_paid_date >= monthStart && m.last_paid_date <= monthEnd) {
      // Find the actual transaction to get the real amount
      const matchTx = findMatchingTransaction(m.merchant_name, transactions, dayBeforeMonthStart);
      const actualAmount = matchTx ? matchTx.amount : m.expected_amount;

      // Calculate predicted date for this billing cycle (the one before the current next_predicted_date)
      const predictedForThisCycle = m.next_predicted_date
        ? rewindByFrequency(m.next_predicted_date, m.prediction_frequency)
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
        days_off: daysOff
      });
    }

    // Upcoming: next_predicted_date is this month and in the future
    if (m.next_predicted_date && m.next_predicted_date >= todayStr && m.next_predicted_date <= monthEnd) {
      upcoming.push({
        id: m.id,
        merchant_name: m.merchant_name,
        expected_amount: m.expected_amount,
        predicted_date: m.next_predicted_date,
        status: 'upcoming',
        confidence_score: m.confidence_score,
        prediction_frequency: m.prediction_frequency
      });
    }
  }

  // Sort by date
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

function rewindByFrequency(dateStr: string, frequency: string): string {
  const d = new Date(dateStr + 'T12:00:00');
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
    default:
      d.setMonth(d.getMonth() - 1);
  }
  return d.toISOString().split('T')[0];
}

function emptyResult(): ReconciliationResult {
  return { paid: [], upcoming: [], overdue: [], totalPaid: 0, totalUpcoming: 0, totalOverdue: 0, reconciledCount: 0 };
}
