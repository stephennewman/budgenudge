import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY);

const TARGET_USER_ID = 'bc474c8b-4b47-4c7d-b202-f469330af2a2';
const TARGET_EMAIL = 'stephen@krezzo.com';

export const maxDuration = 30;

// ── Types ───────────────────────────────────────────────────────────
interface Expense { merchant: string; amount: number; date: string }
interface PredictedExpense { merchant: string; predictedDate: string; amount: number; monthsMatched: number }
interface CategorySpend { category: string; total: number; count: number }
interface MerchantSpend { merchant: string; total: number; count: number }
interface Alert {
  type: 'new_bill' | 'amount_change' | 'dormant';
  merchant: string;
  detail: string;
}
interface WeekBucket {
  label: string;
  current: number;
  avgHist: number;
}
interface WeeklyBreakdown {
  label: string;
  buckets: WeekBucket[];
  currentTotal: number;
  avgHistTotal: number;
}

// Week-of-month buckets
const WEEK_BUCKETS = [
  { label: 'Days 1–7',   start: 1,  end: 7 },
  { label: 'Days 8–14',  start: 8,  end: 14 },
  { label: 'Days 15–21', start: 15, end: 21 },
  { label: 'Days 22–31', start: 22, end: 31 },
];

// Key merchants & categories to track
const KEY_MERCHANTS = ['Publix', 'Amazon'];
const KEY_CATEGORIES = ['Groceries', 'Restaurants'];

// ── Entry point ─────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  // Auth: allow Vercel cron or Bearer token
  const authHeader = request.headers.get('authorization');
  const cronSecret = request.headers.get('x-vercel-cron');
  if (!cronSecret && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const data = await gatherInsights(TARGET_USER_ID);
    const html = buildEmailHtml(data);
    const subject = buildSubject(data);

    const { error } = await resend.emails.send({
      from: 'Krezzo <insights@krezzo.com>',
      to: TARGET_EMAIL,
      subject,
      html,
    });

    if (error) {
      console.error('Resend error:', error);
      return NextResponse.json({ success: false, error }, { status: 500 });
    }

    return NextResponse.json({ success: true, subject });
  } catch (error) {
    console.error('Daily email error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// ── Data gathering ──────────────────────────────────────────────────
async function gatherInsights(userId: string) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Get user's plaid items
  const { data: userItems } = await supabase
    .from('items')
    .select('id, plaid_item_id, institution_name')
    .eq('user_id', userId)
    .is('deleted_at', null);

  const plaidItemIds = userItems?.map(i => i.plaid_item_id) || [];
  const itemDbIds = userItems?.map(i => i.id) || [];

  // Parallel data fetches
  const [
    accountsResult,
    monthTransactionsResult,
    last7dTransactionsResult,
    last30dTransactionsResult,
    historicalResult,
    upcomingBills,
    alertsData,
  ] = await Promise.all([
    // Account balances
    supabase
      .from('accounts')
      .select('name, type, subtype, available_balance, current_balance')
      .in('item_id', itemDbIds),

    // This month's transactions
    supabase
      .from('transactions')
      .select('date, amount, merchant_name, name, ai_merchant_name, ai_category_tag')
      .in('plaid_item_id', plaidItemIds)
      .gte('date', monthStart.toISOString().split('T')[0])
      .order('date', { ascending: false })
      .limit(500),

    // Last 7 days transactions
    supabase
      .from('transactions')
      .select('date, amount, merchant_name, name, ai_merchant_name, ai_category_tag')
      .in('plaid_item_id', plaidItemIds)
      .gte('date', sevenDaysAgo.toISOString().split('T')[0])
      .order('date', { ascending: false })
      .limit(200),

    // Last 30 days transactions
    supabase
      .from('transactions')
      .select('date, amount, ai_category_tag')
      .in('plaid_item_id', plaidItemIds)
      .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
      .limit(1000),

    // Historical transactions (ALL prior months — for baseline averages)
    fetchAllHistorical(plaidItemIds, monthStart),

    // Upcoming bills
    getUpcomingBills(userId, today, endOfMonth),

    // Alerts
    getAlerts(userId, sevenDaysAgo),
  ]);

  const accounts = accountsResult.data || [];
  const monthTransactions = (monthTransactionsResult.data || []).filter(t => t.amount > 0);
  const last7d = (last7dTransactionsResult.data || []).filter(t => t.amount > 0);
  const last30d = (last30dTransactionsResult.data || []).filter(t => t.amount > 0);

  // Compute summaries
  const totalBalance = accounts.reduce((s, a) => s + (a.available_balance || a.current_balance || 0), 0);
  const monthSpend = monthTransactions.reduce((s, t) => s + t.amount, 0);
  const last7dSpend = last7d.reduce((s, t) => s + t.amount, 0);
  const upcomingTotal = upcomingBills.reduce((s, b) => s + b.amount, 0);

  // Yesterday's transactions
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  const yesterdayTx = monthTransactions.filter(t => t.date === yesterdayStr);
  const yesterdaySpend = yesterdayTx.reduce((s, t) => s + t.amount, 0);

  // Top categories (last 30 days)
  const categoryMap = new Map<string, CategorySpend>();
  let last30dTotal = 0;
  last30d.forEach(t => {
    const cat = t.ai_category_tag || 'Uncategorized';
    const existing = categoryMap.get(cat) || { category: cat, total: 0, count: 0 };
    existing.total += t.amount;
    existing.count++;
    last30dTotal += t.amount;
    categoryMap.set(cat, existing);
  });
  const topCategories = Array.from(categoryMap.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

  // Top merchants (last 7 days)
  const merchantMap = new Map<string, MerchantSpend>();
  last7d.forEach(t => {
    const m = t.ai_merchant_name || t.merchant_name || t.name || 'Unknown';
    const existing = merchantMap.get(m) || { merchant: m, total: 0, count: 0 };
    existing.total += t.amount;
    existing.count++;
    merchantMap.set(m, existing);
  });
  const topMerchants = Array.from(merchantMap.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // Days left in month
  const daysLeft = endOfMonth.getDate() - today.getDate();
  const dayOfMonth = today.getDate();
  const daysInMonth = endOfMonth.getDate();
  const monthProgressPct = dayOfMonth / daysInMonth;

  // ── Historical data + derived views ────────────────────────────────
  type HistTx = { date: string; amount: number; merchant_name: string; name: string; ai_merchant_name: string | null; ai_category_tag: string | null };
  const historical = (historicalResult || []).filter((t: HistTx) => t.amount > 0) as HistTx[];
  const numHistMonths = Math.max(getDistinctMonths(historical.map(t => t.date)), 1);

  // ── Day before yesterday ──────────────────────────────────────
  const dayBeforeYesterday = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000);
  const dayBeforeYesterdayStr = dayBeforeYesterday.toISOString().split('T')[0];
  let dayBeforeTx = monthTransactions.filter(t => t.date === dayBeforeYesterdayStr);
  if (dayBeforeTx.length === 0 && dayBeforeYesterday.getMonth() !== today.getMonth()) {
    dayBeforeTx = historical.filter(t => t.date === dayBeforeYesterdayStr);
  }
  const dayBeforeSpend = dayBeforeTx.reduce((s, t) => s + t.amount, 0);

  // ── Predicted expenses (next 7 days) ──────────────────────────
  const allTxForPrediction: HistTx[] = [...historical, ...(monthTransactions as HistTx[])];
  const merchantDayGroups = new Map<string, { month: string; day: number; amount: number }[]>();

  for (const t of allTxForPrediction) {
    const m = (t.ai_merchant_name || t.merchant_name || t.name || 'Unknown').toLowerCase().trim();
    const day = parseInt(t.date.split('-')[2], 10);
    const month = t.date.substring(0, 7);
    const entries = merchantDayGroups.get(m) || [];
    entries.push({ month, day, amount: t.amount });
    merchantDayGroups.set(m, entries);
  }

  // Build the next 7 calendar dates (tomorrow through +7)
  const next7dates: { str: string; day: number }[] = [];
  for (let i = 1; i <= 7; i++) {
    const dt = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
    next7dates.push({ str: dt.toISOString().split('T')[0], day: dt.getDate() });
  }

  const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const predictedExpenses: PredictedExpense[] = [];
  const predictedMerchants = new Set<string>();

  for (const [merchant, entries] of merchantDayGroups) {
    for (const target of next7dates) {
      if (predictedMerchants.has(merchant)) break; // one prediction per merchant

      // Find entries within ±2 days of the target day-of-month
      const matching = entries.filter(e => Math.abs(e.day - target.day) <= 2);
      const distinctMonths = new Set(matching.map(e => e.month));

      if (distinctMonths.size < 2) continue; // need at least 2 months of pattern

      // Skip if already charged this month near this day
      const chargedThisMonth = matching.some(e => e.month === currentMonthStr);
      if (chargedThisMonth) continue;

      // Use most recent amount
      const sorted = [...matching].sort((a, b) => b.month.localeCompare(a.month));
      const displayName = entries.length > 0
        ? (allTxForPrediction.find(t =>
            (t.ai_merchant_name || t.merchant_name || t.name || '').toLowerCase().trim() === merchant
          )?.ai_merchant_name || allTxForPrediction.find(t =>
            (t.ai_merchant_name || t.merchant_name || t.name || '').toLowerCase().trim() === merchant
          )?.merchant_name || merchant)
        : merchant;

      predictedExpenses.push({
        merchant: displayName,
        predictedDate: target.str,
        amount: sorted[0].amount,
        monthsMatched: distinctMonths.size,
      });
      predictedMerchants.add(merchant);
    }
  }

  // Sort by date, then amount descending
  predictedExpenses.sort((a, b) => a.predictedDate.localeCompare(b.predictedDate) || b.amount - a.amount);
  const predictedTotal = predictedExpenses.reduce((s, p) => s + p.amount, 0);

  // ── Weekly bucket breakdowns ────────────────────────────────────
  // Helper: get day-of-month from date string "YYYY-MM-DD"
  const dayOf = (d: string) => parseInt(d.split('-')[2], 10);

  // Helper: bucket index for a day-of-month
  const bucketIdx = (day: number) => {
    if (day <= 7) return 0;
    if (day <= 14) return 1;
    if (day <= 21) return 2;
    return 3;
  };

  // Helper: build a WeeklyBreakdown for a filter fn over current-month & historical txns
  const buildBreakdown = (
    label: string,
    filterCurrent: (t: typeof monthTransactions[0]) => boolean,
    filterHist: (t: HistTx) => boolean,
  ): WeeklyBreakdown => {
    const currBuckets = [0, 0, 0, 0];
    const histBuckets = [0, 0, 0, 0];

    for (const t of monthTransactions) {
      if (!filterCurrent(t)) continue;
      currBuckets[bucketIdx(dayOf(t.date))] += t.amount;
    }
    for (const t of historical) {
      if (!filterHist(t)) continue;
      histBuckets[bucketIdx(dayOf(t.date))] += t.amount;
    }

    const buckets: WeekBucket[] = WEEK_BUCKETS.map((wb, i) => ({
      label: wb.label,
      current: currBuckets[i],
      avgHist: histBuckets[i] / numHistMonths,
    }));

    return {
      label,
      buckets,
      currentTotal: currBuckets.reduce((a, b) => a + b, 0),
      avgHistTotal: histBuckets.reduce((a, b) => a + b, 0) / numHistMonths,
    };
  };

  // Match helper: case-insensitive merchant name check
  const merchantMatch = (t: { ai_merchant_name: string | null; merchant_name: string; name: string }, keyword: string) => {
    const m = (t.ai_merchant_name || t.merchant_name || t.name || '').toLowerCase();
    return m.includes(keyword.toLowerCase());
  };

  // Overall breakdown
  const overallBreakdown = buildBreakdown(
    'All Spending',
    () => true,
    () => true,
  );

  // Key category breakdowns
  const categoryBreakdowns: WeeklyBreakdown[] = KEY_CATEGORIES.map(cat =>
    buildBreakdown(
      cat,
      t => (t.ai_category_tag || '').toLowerCase() === cat.toLowerCase(),
      t => (t.ai_category_tag || '').toLowerCase() === cat.toLowerCase(),
    )
  );

  // Key merchant breakdowns
  const merchantBreakdowns: WeeklyBreakdown[] = KEY_MERCHANTS.map(name =>
    buildBreakdown(
      name,
      t => merchantMatch(t, name),
      t => merchantMatch(t, name),
    )
  );

  return {
    now,
    totalBalance,
    accounts,
    monthSpend,
    last7dSpend,
    yesterdaySpend,
    yesterdayTx,
    dayBeforeSpend,
    dayBeforeTx,
    dayBeforeYesterdayStr,
    upcomingBills,
    upcomingTotal,
    predictedExpenses,
    predictedTotal,
    topCategories,
    topMerchants,
    alerts: alertsData,
    daysLeft,
    dayOfMonth,
    daysInMonth,
    monthProgressPct,
    monthTransactionCount: monthTransactions.length,
    last30dTotal,
    numHistMonths,
    overallBreakdown,
    categoryBreakdowns,
    merchantBreakdowns,
  };
}

async function fetchAllHistorical(plaidItemIds: string[], beforeDate: Date) {
  const beforeStr = beforeDate.toISOString().split('T')[0];
  // Single large query — avoids slow pagination round-trips
  const { data } = await supabase
    .from('transactions')
    .select('date, amount, merchant_name, name, ai_merchant_name, ai_category_tag')
    .in('plaid_item_id', plaidItemIds)
    .lt('date', beforeStr)
    .gt('amount', 0)
    .order('date', { ascending: true })
    .limit(5000);

  return data || [];
}

function getDistinctMonths(dates: string[]): number {
  const months = new Set(dates.map(d => d.substring(0, 7))); // "YYYY-MM"
  return months.size;
}

async function getUpcomingBills(userId: string, startDate: Date, endDate: Date): Promise<Expense[]> {
  const { data: merchants } = await supabase
    .from('tagged_merchants')
    .select('merchant_name, expected_amount, next_predicted_date')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('next_predicted_date', { ascending: true });

  if (!merchants) return [];

  const shoppingMerchants = ['amazon', 'apple', 'target', 'walmart', 'costco', 'publix', 'kroger'];

  return merchants
    .filter(m => {
      const d = new Date(m.next_predicted_date + 'T12:00:00');
      d.setHours(0, 0, 0, 0);
      const isShopping = shoppingMerchants.some(s => m.merchant_name.toLowerCase().includes(s));
      return d >= startDate && d <= endDate && !isShopping;
    })
    .map(m => ({
      merchant: m.merchant_name,
      amount: Number(m.expected_amount),
      date: m.next_predicted_date,
    }));
}

async function getAlerts(userId: string, _since: Date): Promise<Alert[]> {
  const alerts: Alert[] = [];
  const now = new Date();
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgoStr = sixtyDaysAgo.toISOString().split('T')[0];

  // "New bill" = first transaction within last 60 days (truly new recurring charge)
  // "Dormant" = was active but last charge > 60 days ago
  // "Amount change" = amount_drift is set (non-zero)
  const { data: bills } = await supabase
    .from('tagged_merchants')
    .select('merchant_name, expected_amount, prediction_frequency, last_transaction_date, lifecycle_state, amount_drift, is_active')
    .eq('user_id', userId);

  if (!bills) return alerts;

  for (const b of bills) {
    const lastTx = b.last_transaction_date;

    // New bill: first appeared recently (last_transaction_date exists, bill is active,
    // and the merchant hasn't been around long — proxy: only 1-2 months of history)
    // Skip this for now — it's unreliable without tracking first-ever transaction date.

    // Dormant: active bill that hasn't been charged in 60+ days
    if (b.is_active && lastTx && lastTx < sixtyDaysAgoStr) {
      alerts.push({
        type: 'dormant',
        merchant: b.merchant_name,
        detail: `Last charge ${lastTx} — may have stopped`,
      });
    }

    // Amount change
    const drift = Number(b.amount_drift || 0);
    if (drift !== 0) {
      const newAmt = Number(b.expected_amount);
      const oldAmt = newAmt - drift;
      alerts.push({
        type: 'amount_change',
        merchant: b.merchant_name,
        detail: `$${oldAmt.toFixed(2)} → $${newAmt.toFixed(2)}`,
      });
    }
  }

  return alerts.slice(0, 5);
}

// ── Subject line ────────────────────────────────────────────────────
function buildSubject(data: Awaited<ReturnType<typeof gatherInsights>>): string {
  const dateStr = data.now.toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  if (data.yesterdaySpend > 0) {
    return `${dateStr} — $${data.yesterdaySpend.toFixed(0)} spent yesterday · $${data.totalBalance.toFixed(0)} available`;
  }
  return `${dateStr} — $${data.totalBalance.toFixed(0)} available · ${data.upcomingBills.length} bills ahead`;
}

// ── HTML email ──────────────────────────────────────────────────────
function buildEmailHtml(data: Awaited<ReturnType<typeof gatherInsights>>): string {
  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtDate = (d: string) => {
    const dt = new Date(d + 'T12:00:00');
    return `${dt.getMonth() + 1}/${dt.getDate()}`;
  };

  const dateStr = data.now.toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  // Alert rows
  const alertRows = data.alerts.map(a => {
    const icon = a.type === 'new_bill' ? '🆕' : a.type === 'amount_change' ? '📊' : '⏸️';
    const label = a.type === 'new_bill' ? 'New bill detected' : a.type === 'amount_change' ? 'Amount changed' : 'Possibly cancelled';
    return `
      <tr>
        <td style="padding:6px 12px;font-size:14px;">${icon} <strong>${a.merchant}</strong></td>
        <td style="padding:6px 12px;font-size:14px;color:#666;">${label}</td>
        <td style="padding:6px 12px;font-size:14px;text-align:right;">${a.detail}</td>
      </tr>`;
  }).join('');

  // Upcoming bills rows
  const billRows = data.upcomingBills.slice(0, 8).map(b => `
    <tr>
      <td style="padding:6px 12px;font-size:14px;color:#666;">${fmtDate(b.date)}</td>
      <td style="padding:6px 12px;font-size:14px;">${b.merchant}</td>
      <td style="padding:6px 12px;font-size:14px;text-align:right;font-weight:600;">$${fmt(b.amount)}</td>
    </tr>`).join('');

  // ── Weekly breakdown table builder ──────────────────────────────
  const weeklyTable = (bd: WeeklyBreakdown, highlight: boolean) => {
    const diffTotal = bd.currentTotal - bd.avgHistTotal;
    const diffColor = diffTotal > 0 ? '#dc2626' : '#16a34a';
    const diffSign = diffTotal > 0 ? '+' : '';

    const rows = bd.buckets.map((b, i) => {
      const isFuture = data.dayOfMonth <= WEEK_BUCKETS[i].start - 1;
      const isCurrent = data.dayOfMonth >= WEEK_BUCKETS[i].start && data.dayOfMonth <= WEEK_BUCKETS[i].end;
      const diff = b.current - b.avgHist;
      const dColor = diff > 0 ? '#dc2626' : '#16a34a';
      const dSign = diff > 0 ? '+' : '';
      const rowBg = isCurrent ? '#f0f9ff' : 'transparent';
      const indicator = isCurrent ? ' ◀' : '';

      return `<tr style="background:${rowBg};">
        <td style="padding:6px 12px;font-size:14px;white-space:nowrap;"><strong>${b.label}</strong>${indicator}</td>
        <td style="padding:6px 12px;font-size:14px;text-align:right;font-weight:600;">
          ${isFuture ? '<span style="color:#ccc;">—</span>' : '$' + fmt(b.current)}
        </td>
        <td style="padding:6px 12px;font-size:14px;text-align:right;color:#666;">$${fmt(b.avgHist)}</td>
        <td style="padding:6px 12px;font-size:14px;text-align:right;color:${isFuture ? '#ccc' : dColor};font-weight:600;">
          ${isFuture ? '—' : dSign + '$' + fmt(Math.abs(diff))}
        </td>
      </tr>`;
    }).join('');

    const bgColor = highlight ? '#fafafa' : '#ffffff';

    return `<table width="100%" cellpadding="0" cellspacing="0" style="background:${bgColor};border-radius:8px;border:1px solid #eee;margin-bottom:4px;">
      <tr style="border-bottom:2px solid #eee;">
        <td style="padding:6px 12px;font-size:11px;color:#999;text-transform:uppercase;">Period</td>
        <td style="padding:6px 12px;font-size:11px;color:#999;text-align:right;text-transform:uppercase;">This Month</td>
        <td style="padding:6px 12px;font-size:11px;color:#999;text-align:right;text-transform:uppercase;">Avg Month</td>
        <td style="padding:6px 12px;font-size:11px;color:#999;text-align:right;text-transform:uppercase;">+/−</td>
      </tr>
      ${rows}
      <tr style="border-top:2px solid #ddd;">
        <td style="padding:8px 12px;font-size:14px;font-weight:700;">Total</td>
        <td style="padding:8px 12px;font-size:14px;text-align:right;font-weight:700;">$${fmt(bd.currentTotal)}</td>
        <td style="padding:8px 12px;font-size:14px;text-align:right;color:#666;font-weight:700;">$${fmt(bd.avgHistTotal)}</td>
        <td style="padding:8px 12px;font-size:14px;text-align:right;color:${diffColor};font-weight:700;">${diffSign}$${fmt(Math.abs(diffTotal))}</td>
      </tr>
    </table>`;
  };

  // Yesterday breakdown
  const yesterdayRows = data.yesterdayTx.slice(0, 8).map(t => `
    <tr>
      <td style="padding:4px 12px;font-size:14px;">${t.ai_merchant_name || t.merchant_name || t.name}</td>
      <td style="padding:4px 12px;font-size:14px;text-align:right;">$${fmt(t.amount)}</td>
    </tr>`).join('');

  // Day before yesterday breakdown
  const dayBeforeRows = data.dayBeforeTx.slice(0, 8).map(t => `
    <tr>
      <td style="padding:4px 12px;font-size:14px;">${t.ai_merchant_name || t.merchant_name || t.name}</td>
      <td style="padding:4px 12px;font-size:14px;text-align:right;">$${fmt(t.amount)}</td>
    </tr>`).join('');

  // Predicted expenses rows
  const predictedRows = data.predictedExpenses.slice(0, 10).map(p => `
    <tr>
      <td style="padding:6px 12px;font-size:14px;color:#666;">${fmtDate(p.predictedDate)}</td>
      <td style="padding:6px 12px;font-size:14px;">${p.merchant}</td>
      <td style="padding:6px 12px;font-size:14px;text-align:right;font-weight:600;">$${fmt(p.amount)}</td>
    </tr>`).join('');

  // Account rows
  const accountRows = data.accounts.map(a => `
    <tr>
      <td style="padding:4px 12px;font-size:13px;">${a.name}</td>
      <td style="padding:4px 12px;font-size:13px;color:#666;">${a.subtype || a.type}</td>
      <td style="padding:4px 12px;font-size:13px;text-align:right;font-weight:600;">$${fmt(a.available_balance || a.current_balance || 0)}</td>
    </tr>`).join('');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:20px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

  <!-- Header -->
  <tr><td style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:28px 32px;">
    <div style="color:#a0aec0;font-size:13px;text-transform:uppercase;letter-spacing:1px;">Krezzo Daily Insights</div>
    <div style="color:#fff;font-size:22px;font-weight:700;margin-top:6px;">${dateStr}</div>
  </td></tr>

  <!-- Key numbers -->
  <tr><td style="padding:24px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="text-align:center;padding:12px;border-right:1px solid #eee;">
          <div style="font-size:13px;color:#666;margin-bottom:4px;">Available Balance</div>
          <div style="font-size:28px;font-weight:700;color:#1a1a2e;">$${fmt(data.totalBalance)}</div>
        </td>
        <td style="text-align:center;padding:12px;border-right:1px solid #eee;">
          <div style="font-size:13px;color:#666;margin-bottom:4px;">Month-to-Date</div>
          <div style="font-size:28px;font-weight:700;color:#dc2626;">$${fmt(data.monthSpend)}</div>
          <div style="font-size:11px;color:#999;">${data.monthTransactionCount} transactions</div>
        </td>
        <td style="text-align:center;padding:12px;">
          <div style="font-size:13px;color:#666;margin-bottom:4px;">Bills Remaining</div>
          <div style="font-size:28px;font-weight:700;color:#f59e0b;">$${fmt(data.upcomingTotal)}</div>
          <div style="font-size:11px;color:#999;">${data.upcomingBills.length} bills · ${data.daysLeft} days left</div>
        </td>
      </tr>
    </table>
  </td></tr>

  ${data.alerts.length > 0 ? `
  <!-- Alerts -->
  <tr><td style="padding:0 32px 16px;">
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:12px 0;">
      <div style="padding:4px 12px 8px;font-weight:700;font-size:14px;color:#9a3412;">⚠️ Alerts</div>
      <table width="100%" cellpadding="0" cellspacing="0">${alertRows}</table>
    </div>
  </td></tr>` : ''}

  ${data.yesterdayTx.length > 0 ? `
  <!-- Yesterday -->
  <tr><td style="padding:0 32px 20px;">
    <div style="font-weight:700;font-size:15px;color:#1a1a2e;margin-bottom:8px;">Yesterday — $${fmt(data.yesterdaySpend)}</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border-radius:8px;">${yesterdayRows}</table>
  </td></tr>` : ''}

  ${data.dayBeforeTx.length > 0 ? `
  <!-- Day Before Yesterday -->
  <tr><td style="padding:0 32px 20px;">
    <div style="font-weight:700;font-size:15px;color:#1a1a2e;margin-bottom:8px;">Day Before (${data.dayBeforeYesterdayStr}) — $${fmt(data.dayBeforeSpend)}</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border-radius:8px;">${dayBeforeRows}</table>
  </td></tr>` : ''}

  ${data.predictedExpenses.length > 0 ? `
  <!-- Predicted Expenses -->
  <tr><td style="padding:0 32px 20px;">
    <div style="font-weight:700;font-size:15px;color:#1a1a2e;margin-bottom:4px;">Predicted Expenses — Next 7 Days</div>
    <div style="font-size:12px;color:#999;margin-bottom:8px;">Based on recurring patterns · $${fmt(data.predictedTotal)} expected</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;">
      <tr style="border-bottom:1px solid #fde68a;">
        <td style="padding:6px 12px;font-size:11px;color:#92400e;text-transform:uppercase;">Date</td>
        <td style="padding:6px 12px;font-size:11px;color:#92400e;text-transform:uppercase;">Merchant</td>
        <td style="padding:6px 12px;font-size:11px;color:#92400e;text-align:right;text-transform:uppercase;">Est. Amount</td>
      </tr>
      ${predictedRows}
      <tr style="border-top:1px solid #fde68a;">
        <td colspan="2" style="padding:8px 12px;font-size:14px;font-weight:700;color:#92400e;">Total Predicted</td>
        <td style="padding:8px 12px;font-size:14px;text-align:right;font-weight:700;color:#92400e;">$${fmt(data.predictedTotal)}</td>
      </tr>
    </table>
  </td></tr>` : ''}

  <!-- Overall weekly breakdown -->
  <tr><td style="padding:0 32px 20px;">
    <div style="font-weight:700;font-size:15px;color:#1a1a2e;margin-bottom:4px;">Spending by Week — ${data.overallBreakdown.label}</div>
    <div style="font-size:12px;color:#999;margin-bottom:8px;">Day ${data.dayOfMonth} of ${data.daysInMonth} · Avg based on ${data.numHistMonths} months of history</div>
    ${weeklyTable(data.overallBreakdown, false)}
  </td></tr>

  <!-- Category breakdowns -->
  ${data.categoryBreakdowns.length > 0 ? `
  <tr><td style="padding:0 32px 20px;">
    <div style="font-weight:700;font-size:15px;color:#1a1a2e;margin-bottom:8px;">Key Categories — Week by Week</div>
    ${data.categoryBreakdowns.map(cb => `
      <div style="font-weight:600;font-size:14px;color:#374151;margin:8px 0 4px;">${cb.label}</div>
      ${weeklyTable(cb, true)}
    `).join('')}
  </td></tr>` : ''}

  <!-- Merchant breakdowns -->
  ${data.merchantBreakdowns.length > 0 ? `
  <tr><td style="padding:0 32px 20px;">
    <div style="font-weight:700;font-size:15px;color:#1a1a2e;margin-bottom:8px;">Key Merchants — Week by Week</div>
    ${data.merchantBreakdowns.map(mb => `
      <div style="font-weight:600;font-size:14px;color:#374151;margin:8px 0 4px;">${mb.label}</div>
      ${weeklyTable(mb, true)}
    `).join('')}
  </td></tr>` : ''}

  <!-- Account breakdown -->
  <tr><td style="padding:0 32px 24px;">
    <div style="font-weight:700;font-size:15px;color:#1a1a2e;margin-bottom:8px;">Accounts</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border-radius:8px;">${accountRows}</table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #eee;">
    <div style="font-size:12px;color:#999;text-align:center;">
      Krezzo · Daily financial insights · <a href="https://get.krezzo.com" style="color:#1a73e8;">Dashboard</a>
    </div>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}
