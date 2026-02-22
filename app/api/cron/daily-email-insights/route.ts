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
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0); // last day of prev month
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
    lastMonthTransactionsResult,
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

    // Last month's transactions
    supabase
      .from('transactions')
      .select('date, amount, merchant_name, name, ai_merchant_name, ai_category_tag')
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
  const monthTransactions = (monthTransactionsResult.data || []).filter(t => t.amount > 0);
  const lastMonthTransactions = (lastMonthTransactionsResult.data || []).filter(t => t.amount > 0);

  // Compute summaries
  const totalBalance = accounts.reduce((s, a) => s + (a.available_balance || a.current_balance || 0), 0);
  const monthSpend = monthTransactions.reduce((s, t) => s + t.amount, 0);
  const lastMonthSpend = lastMonthTransactions.reduce((s, t) => s + t.amount, 0);
  const upcomingTotal = upcomingBills.reduce((s, b) => s + b.amount, 0);

  // Yesterday's transactions
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  const yesterdayTx = monthTransactions.filter(t => t.date === yesterdayStr);
  const yesterdaySpend = yesterdayTx.reduce((s, t) => s + t.amount, 0);

  // This month by category
  const thisMonthCatMap = new Map<string, CategorySpend>();
  monthTransactions.forEach(t => {
    const cat = t.ai_category_tag || 'Uncategorized';
    const existing = thisMonthCatMap.get(cat) || { category: cat, total: 0, count: 0 };
    existing.total += t.amount;
    existing.count++;
    thisMonthCatMap.set(cat, existing);
  });
  const thisMonthCategories = Array.from(thisMonthCatMap.values())
    .sort((a, b) => b.total - a.total);

  // This month by merchant
  const thisMonthMerchMap = new Map<string, MerchantSpend>();
  monthTransactions.forEach(t => {
    const m = t.ai_merchant_name || t.merchant_name || t.name || 'Unknown';
    const existing = thisMonthMerchMap.get(m) || { merchant: m, total: 0, count: 0 };
    existing.total += t.amount;
    existing.count++;
    thisMonthMerchMap.set(m, existing);
  });
  const thisMonthMerchants = Array.from(thisMonthMerchMap.values())
    .sort((a, b) => b.total - a.total);

  // Last month by category
  const lastMonthCatMap = new Map<string, CategorySpend>();
  lastMonthTransactions.forEach(t => {
    const cat = t.ai_category_tag || 'Uncategorized';
    const existing = lastMonthCatMap.get(cat) || { category: cat, total: 0, count: 0 };
    existing.total += t.amount;
    existing.count++;
    lastMonthCatMap.set(cat, existing);
  });
  const lastMonthCategories = Array.from(lastMonthCatMap.values())
    .sort((a, b) => b.total - a.total);

  // Last month by merchant
  const lastMonthMerchMap = new Map<string, MerchantSpend>();
  lastMonthTransactions.forEach(t => {
    const m = t.ai_merchant_name || t.merchant_name || t.name || 'Unknown';
    const existing = lastMonthMerchMap.get(m) || { merchant: m, total: 0, count: 0 };
    existing.total += t.amount;
    existing.count++;
    lastMonthMerchMap.set(m, existing);
  });
  const lastMonthMerchants = Array.from(lastMonthMerchMap.values())
    .sort((a, b) => b.total - a.total);

  const lastMonthLabel = lastMonthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Days left in month
  const daysLeft = endOfMonth.getDate() - today.getDate();
  const dayOfMonth = today.getDate();
  const daysInMonth = endOfMonth.getDate();

  // ── Historical data (for predictions) ──────────────────────────────
  type HistTx = { date: string; amount: number; merchant_name: string; name: string; ai_merchant_name: string | null; ai_category_tag: string | null };
  const historical = (historicalResult || []).filter((t: HistTx) => t.amount > 0) as HistTx[];

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

  return {
    now,
    totalBalance,
    accounts,
    monthSpend,
    lastMonthSpend,
    lastMonthLabel,
    yesterdaySpend,
    yesterdayTx,
    dayBeforeSpend,
    dayBeforeTx,
    dayBeforeYesterdayStr,
    upcomingBills,
    upcomingTotal,
    predictedExpenses,
    predictedTotal,
    thisMonthCategories,
    thisMonthMerchants,
    lastMonthCategories,
    lastMonthMerchants,
    alerts: alertsData,
    daysLeft,
    dayOfMonth,
    daysInMonth,
    monthTransactionCount: monthTransactions.length,
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
function buildEmailHtml(data: Awaited<ReturnType<typeof gatherInsights>>): string {
  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const dateStr = data.now.toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  // ── Combined spend table (this month + last month side by side) ──
  const combinedSpendTable = (
    thisMonth: { name: string; total: number; count: number }[],
    lastMonth: { name: string; total: number; count: number }[],
    thisMonthTotal: number,
    lastMonthTotal: number,
    lastMonthLabel: string,
  ) => {
    const lastMonthMap = new Map(lastMonth.map(i => [i.name, i]));
    const seen = new Set<string>();

    // Start with this month's items (sorted by this month total desc)
    const combined: { name: string; thisTotal: number; thisCount: number; lastTotal: number }[] = [];
    for (const item of thisMonth) {
      seen.add(item.name);
      const last = lastMonthMap.get(item.name);
      combined.push({ name: item.name, thisTotal: item.total, thisCount: item.count, lastTotal: last?.total || 0 });
    }
    // Add items only in last month
    for (const item of lastMonth) {
      if (!seen.has(item.name)) {
        combined.push({ name: item.name, thisTotal: 0, thisCount: 0, lastTotal: item.total });
      }
    }

    const rows = combined.map(item => {
      const hasLastMonth = item.lastTotal > 0;
      const overLastMonth = item.thisTotal > item.lastTotal && hasLastMonth;
      const thisColor = !hasLastMonth ? '#ca8a04' : overLastMonth ? '#dc2626' : '#16a34a';
      const nameColor = thisColor;
      return `
      <tr>
        <td style="padding:6px 12px;font-size:14px;color:${nameColor};">${item.name}</td>
        <td style="padding:6px 12px;font-size:14px;text-align:right;font-weight:600;color:${thisColor};">$${fmt(item.thisTotal)}</td>
        <td style="padding:6px 12px;font-size:14px;text-align:right;color:${hasLastMonth ? '#666' : '#ca8a04'};">$${fmt(item.lastTotal)}</td>
      </tr>`;
    }).join('');

    return `<table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border-radius:8px;border:1px solid #eee;">
      <tr style="border-bottom:2px solid #eee;">
        <td style="padding:6px 12px;font-size:11px;color:#999;text-transform:uppercase;">Name</td>
        <td style="padding:6px 12px;font-size:11px;color:#999;text-align:right;text-transform:uppercase;">This Month</td>
        <td style="padding:6px 12px;font-size:11px;color:#999;text-align:right;text-transform:uppercase;">${lastMonthLabel}</td>
      </tr>
      ${rows}
      <tr style="border-top:2px solid #ddd;">
        <td style="padding:8px 12px;font-size:14px;font-weight:700;">Total</td>
        <td style="padding:8px 12px;font-size:14px;text-align:right;font-weight:700;color:${thisMonthTotal > lastMonthTotal && lastMonthTotal > 0 ? '#dc2626' : '#1a1a2e'};">$${fmt(thisMonthTotal)}</td>
        <td style="padding:8px 12px;font-size:14px;text-align:right;color:#666;font-weight:700;">$${fmt(lastMonthTotal)}</td>
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

  ${data.yesterdayTx.length > 0 ? `
  <!-- Yesterday -->
  <tr><td style="padding:0 32px 20px;">
    <div style="font-weight:700;font-size:15px;color:#1a1a2e;margin-bottom:8px;">Posted Yesterday — $${fmt(data.yesterdaySpend)}</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border-radius:8px;">${yesterdayRows}</table>
  </td></tr>` : ''}

  ${data.dayBeforeTx.length > 0 ? `
  <!-- Day Before Yesterday -->
  <tr><td style="padding:0 32px 20px;">
    <div style="font-weight:700;font-size:15px;color:#1a1a2e;margin-bottom:8px;">Posted Lasterday (${data.dayBeforeYesterdayStr}) — $${fmt(data.dayBeforeSpend)}</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border-radius:8px;">${dayBeforeRows}</table>
  </td></tr>` : ''}

  <!-- Spending by Category -->
  ${data.thisMonthCategories.length > 0 ? `
  <tr><td style="padding:0 32px 20px;">
    <div style="font-weight:700;font-size:15px;color:#1a1a2e;margin-bottom:4px;">Spending by Category</div>
    <div style="font-size:12px;color:#999;margin-bottom:8px;">Day ${data.dayOfMonth} of ${data.daysInMonth} · ${data.monthTransactionCount} transactions</div>
    ${combinedSpendTable(
      data.thisMonthCategories.map(c => ({ name: c.category, total: c.total, count: c.count })),
      data.lastMonthCategories.map(c => ({ name: c.category, total: c.total, count: c.count })),
      data.monthSpend, data.lastMonthSpend, data.lastMonthLabel,
    )}
  </td></tr>` : ''}

  <!-- Spending by Merchant -->
  ${data.thisMonthMerchants.length > 0 ? `
  <tr><td style="padding:0 32px 20px;">
    <div style="font-weight:700;font-size:15px;color:#1a1a2e;margin-bottom:8px;">Spending by Merchant</div>
    ${combinedSpendTable(
      data.thisMonthMerchants.map(m => ({ name: m.merchant, total: m.total, count: m.count })),
      data.lastMonthMerchants.map(m => ({ name: m.merchant, total: m.total, count: m.count })),
      data.monthSpend, data.lastMonthSpend, data.lastMonthLabel,
    )}
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
