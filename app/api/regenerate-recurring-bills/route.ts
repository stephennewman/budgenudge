import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const maxDuration = 30;

const TARGET_USER_ID = 'bc474c8b-4b47-4c7d-b202-f469330af2a2';

// Categories that are NOT bills/subscriptions — they're regular spending
const NON_BILL_CATEGORIES = new Set([
  'dining', 'restaurants', 'fast food', 'food & drink', 'food and drink',
  'groceries', 'grocery', 'supermarkets',
  'gas', 'gas stations', 'fuel',
  'shopping', 'retail', 'clothing', 'apparel',
  'recreation',
  'travel', 'transportation', 'rideshare',
  'personal care', 'beauty',
  'coffee shops', 'coffee',
  'home improvement',
  'gifts',
]);

// Known restaurant/dining chains — catch even if ai_category_tag is missing
const KNOWN_RESTAURANTS = new Set([
  'chick-fil-a', "wendy's", "mcdonald's", 'taco bell', "dunkin' donuts",
  'starbucks', 'shogun japanese', 'china 1', "zacadoo's grille", "zaxby's",
  'metro diner', 'the local brewing', 'domoishi', 'cantina viajero',
  'tropical smoothie cafe', 'little caesar\'s', 'kiwicup coffee',
  'ellianos coffee', 'ellianos coffee co',
]);

// ── Types ───────────────────────────────────────────────────────────
interface TxRecord {
  date: string;
  amount: number;
  merchant_name: string;
  name: string;
  ai_merchant_name: string | null;
  ai_category_tag: string | null;
}

interface MerchantStats {
  merchant: string;
  occurrences: number;
  firstSeen: string;
  lastSeen: string;
  avgAmount: number;
  minAmount: number;
  maxAmount: number;
  stddev: number;
  avgDaysBetween: number | null;
  amounts: number[];
  dates: string[];
  categories: Set<string>;
}

interface DetectedBill {
  merchant_name: string;
  expected_amount: number;
  prediction_frequency: string;
  next_predicted_date: string;
  last_transaction_date: string;
  confidence_score: number;
  is_active: boolean;
  auto_detected: boolean;
  lifecycle_state: string;
  type: string;
  user_id: string;
}

// ── Entry ───────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = request.headers.get('x-vercel-cron');
  if (!cronSecret && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await regenerateRecurringBills(TARGET_USER_ID);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Regeneration error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const dryRun = url.searchParams.get('dry_run') !== 'false';

  const authHeader = request.headers.get('authorization');
  const cronSecret = request.headers.get('x-vercel-cron');
  if (!cronSecret && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await regenerateRecurringBills(TARGET_USER_ID, dryRun);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Regeneration error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// ── Core logic ──────────────────────────────────────────────────────
async function regenerateRecurringBills(userId: string, dryRun = false) {
  // 1. Get all user transactions (paginated)
  const { data: userItems } = await supabase
    .from('items')
    .select('plaid_item_id')
    .eq('user_id', userId)
    .is('deleted_at', null);

  if (!userItems?.length) {
    return { success: false, error: 'No connected accounts found' };
  }

  const plaidItemIds = userItems.map(i => i.plaid_item_id);
  const transactions: TxRecord[] = [];
  const PAGE_SIZE = 1000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data: page, error: txError } = await supabase
      .from('transactions')
      .select('date, amount, merchant_name, name, ai_merchant_name, ai_category_tag')
      .in('plaid_item_id', plaidItemIds)
      .gt('amount', 0)
      .order('date', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (txError) {
      return { success: false, error: 'Failed to fetch transactions: ' + txError.message };
    }
    if (page && page.length > 0) {
      transactions.push(...page);
      offset += page.length;
      hasMore = page.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }

  if (transactions.length === 0) {
    return { success: false, error: 'No transactions found' };
  }

  // 2. Group by normalized merchant name
  const merchantGroups = new Map<string, MerchantStats>();

  for (const tx of transactions) {
    const raw = tx.ai_merchant_name || tx.merchant_name || tx.name || 'Unknown';
    const merchant = normalizeMerchant(raw);
    if (!merchant || merchant.toLowerCase() === 'unknown') continue;

    const existing = merchantGroups.get(merchant);
    const cat = (tx.ai_category_tag || '').toLowerCase().trim();

    if (existing) {
      existing.occurrences++;
      existing.amounts.push(tx.amount);
      existing.dates.push(tx.date);
      if (cat) existing.categories.add(cat);
      if (tx.date < existing.firstSeen) existing.firstSeen = tx.date;
      if (tx.date > existing.lastSeen) existing.lastSeen = tx.date;
    } else {
      const cats = new Set<string>();
      if (cat) cats.add(cat);
      merchantGroups.set(merchant, {
        merchant,
        occurrences: 1,
        firstSeen: tx.date,
        lastSeen: tx.date,
        avgAmount: 0, minAmount: 0, maxAmount: 0, stddev: 0,
        avgDaysBetween: null,
        amounts: [tx.amount],
        dates: [tx.date],
        categories: cats,
      });
    }
  }

  // 3. Dedup nearby dates (handles dual-account charges for the same bill)
  //    If same merchant has transactions with similar amounts within 5 days, keep one per cycle
  for (const [, stats] of merchantGroups) {
    if (stats.dates.length < 2) continue;

    const paired = stats.dates.map((d, i) => ({ date: d, amount: stats.amounts[i] }));
    paired.sort((a, b) => a.date.localeCompare(b.date));

    const deduped: typeof paired = [paired[0]];
    for (let i = 1; i < paired.length; i++) {
      const prev = deduped[deduped.length - 1];
      const prevDate = new Date(prev.date + 'T12:00:00');
      const currDate = new Date(paired[i].date + 'T12:00:00');
      const daysDiff = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));

      // Within 5 days AND similar amount (within 20% or $5) → likely dual-account charge
      const amountClose = Math.abs(paired[i].amount - prev.amount) < Math.max(prev.amount * 0.2, 5);
      if (daysDiff <= 5 && amountClose) {
        // Skip duplicate, keep the first
        continue;
      }
      deduped.push(paired[i]);
    }

    stats.dates = deduped.map(d => d.date);
    stats.amounts = deduped.map(d => d.amount);
    stats.occurrences = deduped.length;
    if (deduped.length > 0) {
      stats.firstSeen = deduped[0].date;
      stats.lastSeen = deduped[deduped.length - 1].date;
    }
  }

  // 4. Compute stats for each merchant (after dedup)
  for (const [, stats] of merchantGroups) {
    const amounts = stats.amounts;
    stats.avgAmount = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    stats.minAmount = Math.min(...amounts);
    stats.maxAmount = Math.max(...amounts);
    stats.stddev = computeStddev(amounts);

    if (stats.dates.length >= 2) {
      const sortedDates = [...stats.dates].sort();
      const intervals: number[] = [];
      for (let i = 1; i < sortedDates.length; i++) {
        const d1 = new Date(sortedDates[i - 1] + 'T12:00:00');
        const d2 = new Date(sortedDates[i] + 'T12:00:00');
        const daysDiff = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff > 0) intervals.push(daysDiff);
      }
      if (intervals.length > 0) {
        stats.avgDaysBetween = intervals.reduce((s, d) => s + d, 0) / intervals.length;
      }
    }
  }

  // 5. Detect recurring bills
  const now = new Date();
  const cutoffActive = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000); // 60 days
  const cutoffActiveStr = cutoffActive.toISOString().split('T')[0];

  const detectedBills: DetectedBill[] = [];
  const rejected: Array<{ merchant: string; reason: string; occurrences?: number }> = [];

  for (const [, stats] of merchantGroups) {
    // Need at least 3 occurrences after dedup
    if (stats.occurrences < 3) continue;

    // Need a measurable interval
    if (stats.avgDaysBetween === null || stats.avgDaysBetween < 3) continue;

    // Filter out non-bill categories (restaurants, grocery, gas, etc.)
    // BUT override if the amount is very consistent (CV < 0.10) — it's a real subscription
    const cv_precheck = stats.avgAmount > 0 ? stats.stddev / stats.avgAmount : 999;
    const isLikelySubscription = cv_precheck < 0.10;

    // Check known restaurant names
    if (KNOWN_RESTAURANTS.has(stats.merchant.toLowerCase())) {
      rejected.push({
        merchant: stats.merchant,
        reason: `Known restaurant/dining establishment`,
        occurrences: stats.occurrences,
      });
      continue;
    }

    const primaryCategory = getMostCommonCategory(stats.categories);
    if (primaryCategory && NON_BILL_CATEGORIES.has(primaryCategory) && !isLikelySubscription) {
      rejected.push({
        merchant: stats.merchant,
        reason: `Category "${primaryCategory}" is not a bill/subscription`,
        occurrences: stats.occurrences,
      });
      continue;
    }

    // Classify frequency
    const frequency = classifyFrequency(stats.avgDaysBetween);
    if (!frequency) {
      rejected.push({
        merchant: stats.merchant,
        reason: `Interval ${stats.avgDaysBetween.toFixed(1)}d doesn't match known frequency`,
        occurrences: stats.occurrences,
      });
      continue;
    }

    // Check amount consistency — coefficient of variation (stddev/mean)
    const cv = stats.avgAmount > 0 ? stats.stddev / stats.avgAmount : 999;

    const isConsistentAmount = cv < 0.35;
    const isModerateVariation = cv < 0.55 && stats.occurrences >= 5;

    if (!isConsistentAmount && !isModerateVariation) {
      rejected.push({
        merchant: stats.merchant,
        reason: `Amount too variable (CV=${cv.toFixed(2)}, avg=$${stats.avgAmount.toFixed(2)}, std=$${stats.stddev.toFixed(2)})`,
        occurrences: stats.occurrences,
      });
      continue;
    }

    // Check if interval is consistent
    const intervalRegularity = checkIntervalRegularity(stats.dates, frequency);
    if (!intervalRegularity.isRegular) {
      rejected.push({
        merchant: stats.merchant,
        reason: `Irregular intervals: ${intervalRegularity.reason}`,
        occurrences: stats.occurrences,
      });
      continue;
    }

    // Determine if active or dormant
    const isActive = stats.lastSeen >= cutoffActiveStr;

    // Calculate confidence score
    let confidence = 50;
    if (cv < 0.05) confidence += 25;
    else if (cv < 0.15) confidence += 20;
    else if (cv < 0.25) confidence += 10;
    if (stats.occurrences >= 8) confidence += 10;
    else if (stats.occurrences >= 5) confidence += 5;
    if (intervalRegularity.score > 0.8) confidence += 10;
    confidence = Math.min(confidence, 99);

    // Calculate next predicted date
    const lastDate = new Date(stats.lastSeen + 'T12:00:00');
    const intervalDays = getFrequencyDays(frequency);
    let nextDate = new Date(lastDate.getTime() + intervalDays * 24 * 60 * 60 * 1000);

    while (nextDate < now) {
      nextDate = new Date(nextDate.getTime() + intervalDays * 24 * 60 * 60 * 1000);
    }

    // Use median of last 3 transactions as expected amount
    const recentAmounts = stats.amounts.slice(-3).sort((a, b) => a - b);
    const expectedAmount = recentAmounts[Math.floor(recentAmounts.length / 2)];

    detectedBills.push({
      merchant_name: stats.merchant,
      expected_amount: Math.round(expectedAmount * 100) / 100,
      prediction_frequency: frequency,
      next_predicted_date: nextDate.toISOString().split('T')[0],
      last_transaction_date: stats.lastSeen,
      confidence_score: confidence,
      is_active: isActive,
      auto_detected: true,
      lifecycle_state: isActive ? 'active' : 'dormant',
      type: 'expense',
      user_id: userId,
    });
  }

  // Sort by confidence then amount
  detectedBills.sort((a, b) => b.confidence_score - a.confidence_score || b.expected_amount - a.expected_amount);

  const summaryObj = {
    totalTransactions: transactions.length,
    totalMerchants: merchantGroups.size,
    activeBills: detectedBills.filter(b => b.is_active).length,
    dormantBills: detectedBills.filter(b => !b.is_active).length,
    monthlyTotal: detectedBills
      .filter(b => b.is_active)
      .reduce((s, b) => {
        const days = getFrequencyDays(b.prediction_frequency);
        return s + (b.expected_amount * 30 / days);
      }, 0)
      .toFixed(2),
  };

  if (dryRun) {
    return {
      success: true,
      dryRun: true,
      detected: detectedBills.length,
      bills: detectedBills,
      rejected: rejected, // Return all for debugging
      summary: summaryObj,
    };
  }

  // 6. Write to database — clear old data and insert fresh
  const { error: deleteError } = await supabase
    .from('tagged_merchants')
    .delete()
    .eq('user_id', userId);

  if (deleteError) {
    return { success: false, error: 'Failed to clear old data: ' + deleteError.message };
  }

  if (detectedBills.length > 0) {
    const { error: insertError } = await supabase
      .from('tagged_merchants')
      .insert(detectedBills);

    if (insertError) {
      return { success: false, error: 'Failed to insert new bills: ' + insertError.message };
    }
  }

  return {
    success: true,
    dryRun: false,
    detected: detectedBills.length,
    bills: detectedBills,
    summary: { ...summaryObj, oldRecordsCleared: true },
  };
}

// ── Helpers ─────────────────────────────────────────────────────────
function normalizeMerchant(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*#\d+.*$/, '')
    .replace(/\s*\d{4,}$/, '')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function computeStddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function classifyFrequency(avgDays: number): string | null {
  if (avgDays >= 5 && avgDays <= 10) return 'weekly';
  if (avgDays >= 11 && avgDays <= 19) return 'bi-weekly';
  if (avgDays >= 20 && avgDays <= 40) return 'monthly';
  if (avgDays >= 41 && avgDays <= 75) return 'bi-monthly';
  if (avgDays >= 76 && avgDays <= 120) return 'quarterly';
  return null;
}

function getFrequencyDays(frequency: string): number {
  switch (frequency) {
    case 'weekly': return 7;
    case 'bi-weekly': return 14;
    case 'monthly': return 30;
    case 'bi-monthly': return 60;
    case 'quarterly': return 90;
    default: return 30;
  }
}

function getMostCommonCategory(categories: Set<string>): string | null {
  if (categories.size === 0) return null;
  // Return first one (most categories are consistent per merchant)
  return [...categories][0];
}

function checkIntervalRegularity(dates: string[], frequency: string): { isRegular: boolean; score: number; reason: string } {
  if (dates.length < 3) return { isRegular: true, score: 0.5, reason: 'Too few data points' };

  const sortedDates = [...dates].sort();
  const intervals: number[] = [];
  for (let i = 1; i < sortedDates.length; i++) {
    const d1 = new Date(sortedDates[i - 1] + 'T12:00:00');
    const d2 = new Date(sortedDates[i] + 'T12:00:00');
    const daysDiff = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 0) intervals.push(daysDiff);
  }

  if (intervals.length === 0) return { isRegular: false, score: 0, reason: 'All same day' };

  const expectedDays = getFrequencyDays(frequency);
  const tolerance = expectedDays * 0.5; // 50% tolerance

  const matchingIntervals = intervals.filter(d => Math.abs(d - expectedDays) <= tolerance);
  const score = matchingIntervals.length / intervals.length;

  if (score < 0.4) {
    return {
      isRegular: false,
      score,
      reason: `Only ${Math.round(score * 100)}% of intervals match ${frequency} (expected ~${expectedDays}d)`,
    };
  }

  return { isRegular: true, score, reason: 'OK' };
}
