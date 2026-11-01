import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { reconcileUserBills } from '@/utils/bills/reconcile';
import type { ReconciliationResult } from '@/utils/bills/reconcile';
import { EMAIL_FROM_INSIGHTS, SITE_URL } from '@/lib/brand';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Lazy-init so builds don't require RESEND_API_KEY at module load.
let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const TARGET_USER_ID = 'bc474c8b-4b47-4c7d-b202-f469330af2a2';
const TARGET_EMAIL = 'stephen@krezzo.com';

export const maxDuration = 30;

// ── Types ───────────────────────────────────────────────────────────
interface Expense { merchant: string; amount: number; date: string }
interface PredictedExpense { merchant: string; predictedDate: string; amount: number; monthsMatched: number }
interface PaceRow { name: string; actual: number; average: number; pacePct: number | null }
interface Alert {
  type: 'new_bill' | 'amount_change' | 'dormant';
  merchant: string;
  detail: string;
}

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

    // Reconcile bills to get fresh paid/upcoming timeline
    let billTimeline: ReconciliationResult | null = null;
    try {
      billTimeline = await reconcileUserBills(TARGET_USER_ID);
    } catch (err) {
      console.error('Bill reconciliation failed for email:', err);
    }

    const html = buildEmailHtml(data, billTimeline);
    const subject = buildSubject(data);

    const { error } = await getResend().emails.send({
      from: EMAIL_FROM_INSIGHTS,
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
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0); // last day of prev month

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
    lastMonthTransactionsResult,
    historicalResult,
    upcomingBills,
    alertsData,
  ] = await Promise.all([
    // Account balances
    supabase
      .from('accounts')
      .select('name, type, subtype, available_balance, current_balance')
      .in('item_id', itemDbIds)
      .is('deleted_at', null),

    // This month's transactions
    supabase
      .from('transactions')
      .select('date, amount, merchant_name, name, ai_merchant_name, ai_category_tag, pfc_primary')
      .in('plaid_item_id', plaidItemIds)
      .gte('date', monthStart.toISOString().split('T')[0])
      .order('date', { ascending: false })
      .limit(500),

    // Last month's transactions
    supabase
      .from('transactions')
      .select('date, amount, merchant_name, name, ai_merchant_name, ai_category_tag, pfc_primary')
      .in('plaid_item_id', plaidItemIds)
      .gte('date', lastMonthStart.toISOString().split('T')[0])
      .lte('date', lastMonthEnd.toISOString().split('T')[0])
      .order('date', { ascending: false })
      .limit(1000),

    // Historical transactions (ALL prior months — for predictions)
    fetchAllHistorical(plaidItemIds, monthStart),

    // Upcoming bills
    getUpcomingBills(userId, today, endOfMonth),

    // Alerts
    getAlerts(userId),
  ]);

  const accounts = accountsResult.data || [];
  // Transfers (savings moves, Venmo, Zelle) aren't spending
  const isSpend = (t: { amount: number; pfc_primary: string | null; ai_category_tag: string | null }) =>
    t.amount > 0 && t.pfc_primary !== 'TRANSFER_OUT' && t.ai_category_tag !== 'Transfer';
  const monthTransactions = (monthTransactionsResult.data || []).filter(isSpend);
  const lastMonthTransactions = (lastMonthTransactionsResult.data || []).filter(isSpend);

  // Compute summaries
  const totalBalance = accounts.reduce((s, a) => s + (a.available_balance || a.current_balance || 0), 0);
  const monthSpend = monthTransactions.reduce((s, t) => s + t.amount, 0);
  const upcomingTotal = upcomingBills.reduce((s, b) => s + b.amount, 0);

  // Yesterday's transactions
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  let yesterdayTx = monthTransactions.filter(t => t.date === yesterdayStr);
  let yesterdaySpend = yesterdayTx.reduce((s, t) => s + t.amount, 0);

  // Days left in month
  const daysLeft = endOfMonth.getDate() - today.getDate();
  const dayOfMonth = today.getDate();
  const daysInMonth = endOfMonth.getDate();

  // ── Historical data (for predictions) ──────────────────────────────
  type HistTx = { date: string; amount: number; merchant_name: string; name: string; ai_merchant_name: string | null; ai_category_tag: string | null; pfc_primary: string | null };
  const historical = (historicalResult || []).filter((t: HistTx) => isSpend(t)) as HistTx[];

  // Budget is the average of the prior 12 complete months. Pace compares
  // month-to-date spend with that fraction of the average.
  const BASELINE_MONTHS = 12;
  const MIN_MONTHLY_AVERAGE = 250;
  const buildPace = (keyOf: (t: HistTx) => string): PaceRow[] => {
    const totals = new Map<string, number>();
    for (const t of historical) {
      const key = keyOf(t);
      totals.set(key, (totals.get(key) || 0) + t.amount);
    }
    const actuals = new Map<string, number>();
    for (const t of monthTransactions) {
      const key = keyOf(t);
      actuals.set(key, (actuals.get(key) || 0) + t.amount);
    }
    const rows: PaceRow[] = [];
    for (const [name, total] of totals) {
      const average = total / BASELINE_MONTHS;
      if (average < MIN_MONTHLY_AVERAGE) continue;
      const actual = actuals.get(name) || 0;
      const expectedByToday = average * (dayOfMonth / daysInMonth);
      rows.push({
        name,
        actual,
        average,
        pacePct: expectedByToday >= 12 ? actual / expectedByToday - 1 : null,
      });
    }
    rows.sort((a, b) => b.average - a.average);
    return rows;
  };
  const vendorPace = buildPace(t => t.ai_merchant_name || t.merchant_name || t.name || 'Unknown');
  const categoryPace = buildPace(t => t.ai_category_tag || 'Uncategorized');

  // Yesterday falls in the previous month on the 1st
  if (yesterdayTx.length === 0 && yesterday.getMonth() !== today.getMonth()) {
    yesterdayTx = lastMonthTransactions.filter(t => t.date === yesterdayStr);
    yesterdaySpend = yesterdayTx.reduce((s, t) => s + t.amount, 0);
  }

  // ── Day before yesterday ──────────────────────────────────────
  const dayBeforeYesterday = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000);
  const dayBeforeYesterdayStr = dayBeforeYesterday.toISOString().split('T')[0];
  let dayBeforeTx = monthTransactions.filter(t => t.date === dayBeforeYesterdayStr);
  if (dayBeforeTx.length === 0 && dayBeforeYesterday.getMonth() !== today.getMonth()) {
    dayBeforeTx = lastMonthTransactions.filter(t => t.date === dayBeforeYesterdayStr);
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

  return {
    now,
    totalBalance,
    accounts,
    monthSpend,
    yesterdaySpend,
    yesterdayTx,
    dayBeforeSpend,
    dayBeforeTx,
    dayBeforeYesterdayStr,
    upcomingBills,
    upcomingTotal,
    predictedExpenses,
    predictedTotal,
    vendorPace,
    categoryPace,
    alerts: alertsData,
    daysLeft,
    dayOfMonth,
    daysInMonth,
    monthTransactionCount: monthTransactions.length,
  };
}

async function fetchAllHistorical(plaidItemIds: string[], beforeDate: Date) {
  const beforeStr = beforeDate.toISOString().split('T')[0];
  const from = new Date(beforeDate);
  from.setMonth(from.getMonth() - 12);
  const fromStr = from.toISOString().split('T')[0];
  const PAGE_SIZE = 1000;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = [];
  for (let start = 0; ; start += PAGE_SIZE) {
    const { data } = await supabase
      .from('transactions')
      .select('id, date, amount, merchant_name, name, ai_merchant_name, ai_category_tag, pfc_primary')
      .in('plaid_item_id', plaidItemIds)
      .gte('date', fromStr)
      .lt('date', beforeStr)
      .gt('amount', 0)
      .order('date', { ascending: false })
      .order('id', { ascending: false })
      .range(start, start + PAGE_SIZE - 1);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
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

async function getAlerts(userId: string): Promise<Alert[]> {
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
function buildEmailHtml(data: Awaited<ReturnType<typeof gatherInsights>>, billTimeline?: ReconciliationResult | null): string {
  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const dateStr = data.now.toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const paceLabel = (pct: number | null) => {
    if (pct === null) return { text: '—', color: '#999' };
    if (Math.abs(pct) <= 0.08) return { text: 'On pace', color: '#666' };
    const n = Math.round(pct * 100);
    return { text: `${n > 0 ? '+' : ''}${n}%`, color: n > 0 ? '#dc2626' : '#16a34a' };
  };

  const paceTable = (rows: PaceRow[]) => `<table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border-radius:8px;border:1px solid #eee;">
      <tr style="border-bottom:2px solid #eee;">
        <td style="padding:6px 12px;font-size:11px;color:#999;text-transform:uppercase;">Name</td>
        <td style="padding:6px 12px;font-size:11px;color:#999;text-align:right;text-transform:uppercase;">Actual</td>
        <td style="padding:6px 12px;font-size:11px;color:#999;text-align:right;text-transform:uppercase;">Avg/mo</td>
        <td style="padding:6px 12px;font-size:11px;color:#999;text-align:right;text-transform:uppercase;">Pace</td>
      </tr>
      ${rows.map(row => {
        const pace = paceLabel(row.pacePct);
        return `<tr>
          <td style="padding:6px 12px;font-size:14px;">${row.name}</td>
          <td style="padding:6px 12px;font-size:14px;text-align:right;font-weight:600;">$${fmt(row.actual)}</td>
          <td style="padding:6px 12px;font-size:14px;text-align:right;color:#666;">$${fmt(row.average)}</td>
          <td style="padding:6px 12px;font-size:14px;text-align:right;font-weight:600;color:${pace.color};">${pace.text}</td>
        </tr>`;
      }).join('')}
    </table>`;

  // Yesterday itemized (all transactions, largest first)
  const yesterdayRows = [...data.yesterdayTx].sort((a, b) => b.amount - a.amount).map(t => `
    <tr>
      <td style="padding:6px 12px;font-size:14px;">${t.ai_merchant_name || t.merchant_name || t.name}</td>
      <td style="padding:6px 12px;font-size:12px;color:#999;">${t.ai_category_tag || 'Uncategorized'}</td>
      <td style="padding:6px 12px;font-size:14px;text-align:right;font-weight:600;">$${fmt(t.amount)}</td>
    </tr>`).join('');
  const yesterdayLabel = new Date(data.now.getTime() - 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const rollupRows = (items: { name: string; total: number; count: number }[]) =>
    items.sort((a, b) => b.total - a.total).map(item => `
      <tr>
        <td style="padding:6px 12px;font-size:14px;">${item.name}${item.count > 1 ? ` <span style="color:#999;font-size:12px;">×${item.count}</span>` : ''}</td>
        <td style="padding:6px 12px;font-size:14px;text-align:right;font-weight:600;">$${fmt(item.total)}</td>
      </tr>`).join('');

  const yesterdayVendorMap = new Map<string, { name: string; total: number; count: number }>();
  const yesterdayCategoryMap = new Map<string, { name: string; total: number; count: number }>();
  for (const t of data.yesterdayTx) {
    const vendor = t.ai_merchant_name || t.merchant_name || t.name || 'Unknown';
    const category = t.ai_category_tag || 'Uncategorized';
    const v = yesterdayVendorMap.get(vendor) || { name: vendor, total: 0, count: 0 };
    v.total += t.amount;
    v.count++;
    yesterdayVendorMap.set(vendor, v);
    const c = yesterdayCategoryMap.get(category) || { name: category, total: 0, count: 0 };
    c.total += t.amount;
    c.count++;
    yesterdayCategoryMap.set(category, c);
  }
  const yesterdayVendors = Array.from(yesterdayVendorMap.values());
  const yesterdayCategories = Array.from(yesterdayCategoryMap.values());
  const yesterdayRollupTable = (items: { name: string; total: number; count: number }[]) =>
    `<table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border-radius:8px;border:1px solid #eee;">
      ${rollupRows(items)}
      <tr style="border-top:2px solid #ddd;">
        <td style="padding:8px 12px;font-size:14px;font-weight:700;">Total</td>
        <td style="padding:8px 12px;font-size:14px;text-align:right;font-weight:700;">$${fmt(data.yesterdaySpend)}</td>
      </tr>
    </table>`;

  const laterdayLabel = new Date(data.dayBeforeYesterdayStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const laterdayRows = [...data.dayBeforeTx].sort((a, b) => b.amount - a.amount).map(t => `
    <tr>
      <td style="padding:6px 12px;font-size:14px;">${t.ai_merchant_name || t.merchant_name || t.name}</td>
      <td style="padding:6px 12px;font-size:12px;color:#999;">${t.ai_category_tag || 'Uncategorized'}</td>
      <td style="padding:6px 12px;font-size:14px;text-align:right;font-weight:600;">$${fmt(t.amount)}</td>
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

  <!-- Yesterday itemized -->
  <tr><td style="padding:0 32px 20px;">
    <div style="font-weight:700;font-size:15px;color:#1a1a2e;margin-bottom:4px;">Posted yesterday — ${yesterdayLabel}</div>
    <div style="font-size:12px;color:#999;margin-bottom:8px;">${data.yesterdayTx.length} transactions · $${fmt(data.yesterdaySpend)} · excludes transfers</div>
    ${data.yesterdayTx.length > 0 ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border-radius:8px;border:1px solid #eee;">
      ${yesterdayRows}
      <tr style="border-top:2px solid #ddd;">
        <td style="padding:8px 12px;font-size:14px;font-weight:700;" colspan="2">Total</td>
        <td style="padding:8px 12px;font-size:14px;text-align:right;font-weight:700;">$${fmt(data.yesterdaySpend)}</td>
      </tr>
    </table>

    <div style="font-weight:700;font-size:14px;color:#1a1a2e;margin:16px 0 8px;">Yesterday by vendor</div>
    ${yesterdayRollupTable(yesterdayVendors)}

    <div style="font-weight:700;font-size:14px;color:#1a1a2e;margin:16px 0 8px;">Yesterday by category</div>
    ${yesterdayRollupTable(yesterdayCategories)}` : `<div style="font-size:14px;color:#666;">No spending posted yesterday.</div>`}
  </td></tr>

  <!-- Posted laterday -->
  <tr><td style="padding:0 32px 20px;">
    <div style="font-weight:700;font-size:15px;color:#1a1a2e;margin-bottom:4px;">Posted laterday — ${laterdayLabel}</div>
    <div style="font-size:12px;color:#999;margin-bottom:8px;">${data.dayBeforeTx.length} transactions · $${fmt(data.dayBeforeSpend)} · excludes transfers</div>
    ${data.dayBeforeTx.length > 0 ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border-radius:8px;border:1px solid #eee;">
      ${laterdayRows}
      <tr style="border-top:2px solid #ddd;">
        <td style="padding:8px 12px;font-size:14px;font-weight:700;" colspan="2">Total</td>
        <td style="padding:8px 12px;font-size:14px;text-align:right;font-weight:700;">$${fmt(data.dayBeforeSpend)}</td>
      </tr>
    </table>` : `<div style="font-size:14px;color:#666;">No spending posted.</div>`}
  </td></tr>

  ${buildBillTimelineHtml(billTimeline, data.alerts, fmt)}

  <!-- Spending by Vendor -->
  ${data.vendorPace.length > 0 ? `
  <tr><td style="padding:0 32px 20px;">
    <div style="font-weight:700;font-size:15px;color:#1a1a2e;margin-bottom:4px;">Spending by Vendor</div>
    <div style="font-size:12px;color:#999;margin-bottom:8px;">Month to date vs 12-month average · day ${data.dayOfMonth} of ${data.daysInMonth} · $250 a month and up</div>
    ${paceTable(data.vendorPace)}
  </td></tr>` : ''}

  <!-- Spending by Category -->
  ${data.categoryPace.length > 0 ? `
  <tr><td style="padding:0 32px 20px;">
    <div style="font-weight:700;font-size:15px;color:#1a1a2e;margin-bottom:4px;">Spending by Category</div>
    <div style="font-size:12px;color:#999;margin-bottom:8px;">Month to date vs 12-month average · day ${data.dayOfMonth} of ${data.daysInMonth} · $250 a month and up</div>
    ${paceTable(data.categoryPace)}
  </td></tr>` : ''}

  ${buildPredictedExpensesHtml(data.predictedExpenses, fmt)}

  <!-- Account breakdown -->
  <tr><td style="padding:0 32px 24px;">
    <div style="font-weight:700;font-size:15px;color:#1a1a2e;margin-bottom:8px;">Accounts</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border-radius:8px;">${accountRows}</table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #eee;">
    <div style="font-size:12px;color:#999;text-align:center;">
      Krezzo · Daily financial insights · <a href="${SITE_URL}" style="color:#1a73e8;">Dashboard</a>
    </div>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

function buildBillTimelineHtml(
  timeline: ReconciliationResult | null | undefined,
  alerts: Alert[],
  fmt: (n: number) => string
): string {
  if (!timeline || (timeline.paid.length === 0 && timeline.upcoming.length === 0)) {
    return '';
  }

  const allEntries = [
    ...timeline.paid.map(e => ({ ...e, sortDate: e.actual_date || e.predicted_date })),
    ...timeline.upcoming.map(e => ({ ...e, sortDate: e.predicted_date })),
  ].sort((a, b) => a.sortDate.localeCompare(b.sortDate));

  const rows = allEntries.map(entry => {
    const isPaid = entry.status === 'paid';
    const icon = isPaid ? '&#9989;' : '&#9203;';
    const displayDate = new Date((entry.actual_date || entry.predicted_date) + 'T12:00:00');
    const day = displayDate.getDate();
    const suffixes = ['th', 'st', 'nd', 'rd'];
    const v = day % 100;
    const ordinal = day + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
    const amount = entry.actual_amount || entry.expected_amount;
    const amountColor = isPaid ? '#16a34a' : '#1a1a2e';
    const freqLabel = entry.prediction_frequency || '';
    const statusText = isPaid
      ? (entry.days_off === 0 ? 'on time' : `${entry.days_off}d off`)
      : `${entry.confidence_score}% · ${freqLabel}`;

    return `<tr>
      <td style="padding:4px 12px;font-size:14px;">${icon}</td>
      <td style="padding:4px 12px;font-size:14px;font-weight:600;">${ordinal}</td>
      <td style="padding:4px 12px;font-size:14px;">${entry.merchant_name}</td>
      <td style="padding:4px 12px;font-size:14px;text-align:right;font-weight:600;color:${amountColor};">$${fmt(amount)}</td>
      <td style="padding:4px 12px;font-size:12px;color:#999;">${statusText}</td>
    </tr>`;
  }).join('');

  const totalPaid = timeline.totalPaid;
  const totalUpcoming = timeline.totalUpcoming;

  let alertsHtml = '';
  if (alerts.length > 0) {
    alertsHtml = `<div style="margin-top:8px;padding:8px 12px;background:#fef3c7;border-radius:6px;font-size:12px;color:#92400e;">
      ${alerts.map(a => `<div>&#9888; ${a.merchant}: ${a.detail}</div>`).join('')}
    </div>`;
  }

  return `
  <!-- Bill Timeline -->
  <tr><td style="padding:0 32px 20px;">
    <div style="font-weight:700;font-size:15px;color:#1a1a2e;margin-bottom:4px;">Monthly Bills</div>
    <div style="font-size:12px;color:#999;margin-bottom:8px;">${timeline.paid.length} paid ($${fmt(totalPaid)}) · ${timeline.upcoming.length} upcoming ($${fmt(totalUpcoming)})</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border-radius:8px;">
      ${rows}
    </table>
    ${alertsHtml}
  </td></tr>`;
}

function buildPredictedExpensesHtml(
  predictions: PredictedExpense[],
  fmt: (n: number) => string
): string {
  if (!predictions || predictions.length === 0) return '';

  const rows = predictions.map(p => {
    const d = new Date(p.predictedDate + 'T12:00:00');
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `<tr>
      <td style="padding:4px 12px;font-size:14px;">${dateStr}</td>
      <td style="padding:4px 12px;font-size:14px;">${p.merchant}</td>
      <td style="padding:4px 12px;font-size:14px;text-align:right;font-weight:600;">$${fmt(p.amount)}</td>
      <td style="padding:4px 12px;font-size:12px;color:#999;">${p.monthsMatched}mo pattern</td>
    </tr>`;
  }).join('');

  const total = predictions.reduce((s, p) => s + p.amount, 0);

  return `
  <!-- Predicted Expenses -->
  <tr><td style="padding:0 32px 20px;">
    <div style="font-weight:700;font-size:15px;color:#1a1a2e;margin-bottom:4px;">Predicted This Week</div>
    <div style="font-size:12px;color:#999;margin-bottom:8px;">${predictions.length} charges · ~$${fmt(total)}</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border-radius:8px;">
      ${rows}
    </table>
  </td></tr>`;
}
