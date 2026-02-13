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
interface CategorySpend { category: string; total: number; count: number }
interface MerchantSpend { merchant: string; total: number; count: number }
interface Alert {
  type: 'new_bill' | 'amount_change' | 'dormant';
  merchant: string;
  detail: string;
}
interface PaceItem {
  name: string;
  currentMonth: number;
  avgMonthly: number;
  pacePercent: number;  // current vs expected-so-far (adjusted for day of month)
  status: 'under' | 'on_track' | 'over';
  currentWeek: number;
  avgWeekly: number;
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
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  // Week start (Monday)
  const dayOfWeek = now.getDay(); // 0=Sun
  const weekStart = new Date(today.getTime() - ((dayOfWeek === 0 ? 6 : dayOfWeek - 1)) * 24 * 60 * 60 * 1000);

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

    // Historical transactions (last 90 days, excluding current month — for baseline averages)
    supabase
      .from('transactions')
      .select('date, amount, merchant_name, name, ai_merchant_name, ai_category_tag')
      .in('plaid_item_id', plaidItemIds)
      .gte('date', ninetyDaysAgo.toISOString().split('T')[0])
      .lt('date', monthStart.toISOString().split('T')[0])
      .limit(1000),

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

  // ── Pace tracking ──────────────────────────────────────────────
  const historical = (historicalResult.data || []).filter(t => t.amount > 0);

  // Figure out how many full months the historical window covers (excluding current month)
  const histMonths = getDistinctMonths(historical.map(t => t.date));
  const numHistMonths = Math.max(histMonths, 1);

  // Current week transactions (Mon–today)
  const weekStartStr = weekStart.toISOString().split('T')[0];
  const currentWeekTx = monthTransactions.filter(t => t.date >= weekStartStr);

  // Compute weeks in historical window
  const histStartDate = ninetyDaysAgo;
  const histEndDate = monthStart;
  const histDays = Math.max(1, Math.round((histEndDate.getTime() - histStartDate.getTime()) / (1000 * 60 * 60 * 24)));
  const numHistWeeks = Math.max(1, histDays / 7);

  // ── Merchant pace ──────────────────────────────────────────────
  const histMerchantTotals = new Map<string, number>();
  for (const t of historical) {
    const m = t.ai_merchant_name || t.merchant_name || t.name || 'Unknown';
    histMerchantTotals.set(m, (histMerchantTotals.get(m) || 0) + t.amount);
  }

  const currMerchantTotals = new Map<string, number>();
  for (const t of monthTransactions) {
    const m = t.ai_merchant_name || t.merchant_name || t.name || 'Unknown';
    currMerchantTotals.set(m, (currMerchantTotals.get(m) || 0) + t.amount);
  }

  const currWeekMerchantTotals = new Map<string, number>();
  for (const t of currentWeekTx) {
    const m = t.ai_merchant_name || t.merchant_name || t.name || 'Unknown';
    currWeekMerchantTotals.set(m, (currWeekMerchantTotals.get(m) || 0) + t.amount);
  }

  const merchantPace: PaceItem[] = [];
  const allMerchants = new Set([...histMerchantTotals.keys(), ...currMerchantTotals.keys()]);
  for (const m of allMerchants) {
    const avgMonthly = (histMerchantTotals.get(m) || 0) / numHistMonths;
    const avgWeekly = (histMerchantTotals.get(m) || 0) / numHistWeeks;
    const currentMonth = currMerchantTotals.get(m) || 0;
    const currentWeek = currWeekMerchantTotals.get(m) || 0;

    // Only include merchants with meaningful history (avg > $5/mo) or current spending
    if (avgMonthly < 5 && currentMonth < 5) continue;

    const expectedSoFar = avgMonthly * monthProgressPct;
    const pacePercent = expectedSoFar > 0 ? (currentMonth / expectedSoFar) * 100 : (currentMonth > 0 ? 999 : 0);
    const status: PaceItem['status'] = pacePercent > 120 ? 'over' : pacePercent > 80 ? 'on_track' : 'under';

    merchantPace.push({ name: m, currentMonth, avgMonthly, pacePercent, status, currentWeek, avgWeekly });
  }
  merchantPace.sort((a, b) => b.pacePercent - a.pacePercent);

  // ── Category pace ──────────────────────────────────────────────
  const histCatTotals = new Map<string, number>();
  for (const t of historical) {
    const c = t.ai_category_tag || 'Uncategorized';
    histCatTotals.set(c, (histCatTotals.get(c) || 0) + t.amount);
  }

  const currCatTotals = new Map<string, number>();
  for (const t of monthTransactions) {
    const c = t.ai_category_tag || 'Uncategorized';
    currCatTotals.set(c, (currCatTotals.get(c) || 0) + t.amount);
  }

  const currWeekCatTotals = new Map<string, number>();
  for (const t of currentWeekTx) {
    const c = t.ai_category_tag || 'Uncategorized';
    currWeekCatTotals.set(c, (currWeekCatTotals.get(c) || 0) + t.amount);
  }

  const categoryPace: PaceItem[] = [];
  const allCats = new Set([...histCatTotals.keys(), ...currCatTotals.keys()]);
  for (const c of allCats) {
    const avgMonthly = (histCatTotals.get(c) || 0) / numHistMonths;
    const avgWeekly = (histCatTotals.get(c) || 0) / numHistWeeks;
    const currentMonth = currCatTotals.get(c) || 0;
    const currentWeek = currWeekCatTotals.get(c) || 0;

    if (avgMonthly < 10 && currentMonth < 10) continue;

    const expectedSoFar = avgMonthly * monthProgressPct;
    const pacePercent = expectedSoFar > 0 ? (currentMonth / expectedSoFar) * 100 : (currentMonth > 0 ? 999 : 0);
    const status: PaceItem['status'] = pacePercent > 120 ? 'over' : pacePercent > 80 ? 'on_track' : 'under';

    categoryPace.push({ name: c, currentMonth, avgMonthly, pacePercent, status, currentWeek, avgWeekly });
  }
  categoryPace.sort((a, b) => b.pacePercent - a.pacePercent);

  return {
    now,
    totalBalance,
    accounts,
    monthSpend,
    last7dSpend,
    yesterdaySpend,
    yesterdayTx,
    upcomingBills,
    upcomingTotal,
    topCategories,
    topMerchants,
    alerts: alertsData,
    daysLeft,
    dayOfMonth,
    daysInMonth,
    monthProgressPct,
    monthTransactionCount: monthTransactions.length,
    last30dTotal,
    merchantPace: merchantPace.slice(0, 12),
    categoryPace: categoryPace.slice(0, 8),
    numHistMonths,
  };
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

async function getAlerts(userId: string, since: Date): Promise<Alert[]> {
  const alerts: Alert[] = [];

  const [newBillsRes, dormantRes, changedRes] = await Promise.all([
    supabase
      .from('tagged_merchants')
      .select('merchant_name, expected_amount, prediction_frequency')
      .eq('user_id', userId)
      .eq('auto_detected', true)
      .gte('created_at', since.toISOString())
      .limit(3),
    supabase
      .from('tagged_merchants')
      .select('merchant_name')
      .eq('user_id', userId)
      .eq('lifecycle_state', 'dormant')
      .gte('updated_at', since.toISOString())
      .limit(2),
    supabase
      .from('tagged_merchants')
      .select('merchant_name, expected_amount, amount_drift')
      .eq('user_id', userId)
      .not('amount_drift', 'is', null)
      .neq('amount_drift', 0)
      .gte('updated_at', since.toISOString())
      .limit(2),
  ]);

  newBillsRes.data?.forEach(b => alerts.push({
    type: 'new_bill',
    merchant: b.merchant_name,
    detail: `$${Number(b.expected_amount).toFixed(2)}/${b.prediction_frequency}`,
  }));

  dormantRes.data?.forEach(b => alerts.push({
    type: 'dormant',
    merchant: b.merchant_name,
    detail: 'Possibly cancelled — no recent charges',
  }));

  changedRes.data?.forEach(b => {
    const newAmt = Number(b.expected_amount);
    const oldAmt = newAmt - Number(b.amount_drift);
    alerts.push({
      type: 'amount_change',
      merchant: b.merchant_name,
      detail: `$${oldAmt.toFixed(2)} → $${newAmt.toFixed(2)}`,
    });
  });

  return alerts;
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

  // Pace helper: status badge
  const paceBadge = (p: PaceItem) => {
    if (p.avgMonthly < 1) return `<span style="background:#e8f0fe;color:#1a73e8;padding:2px 8px;border-radius:10px;font-size:11px;">new</span>`;
    const pct = Math.round(p.pacePercent);
    if (p.status === 'over') return `<span style="background:#fef2f2;color:#dc2626;padding:2px 8px;border-radius:10px;font-size:11px;">${pct}% of pace</span>`;
    if (p.status === 'on_track') return `<span style="background:#fefce8;color:#a16207;padding:2px 8px;border-radius:10px;font-size:11px;">${pct}% of pace</span>`;
    return `<span style="background:#f0fdf4;color:#16a34a;padding:2px 8px;border-radius:10px;font-size:11px;">${pct}% of pace</span>`;
  };

  // Progress bar helper
  const progressBar = (current: number, avg: number) => {
    const pct = avg > 0 ? Math.min(Math.round((current / avg) * 100), 150) : 0;
    const barColor = pct > 100 ? '#dc2626' : pct > 80 ? '#f59e0b' : '#16a34a';
    const barWidth = Math.min(pct, 100);
    return `<div style="background:#e5e7eb;border-radius:4px;height:6px;width:100%;margin-top:4px;">
      <div style="background:${barColor};border-radius:4px;height:6px;width:${barWidth}%;"></div>
    </div>`;
  };

  // Category pace rows
  const catPaceRows = data.categoryPace.map(c => `
    <tr>
      <td style="padding:8px 12px;font-size:14px;vertical-align:top;">
        <strong>${c.name}</strong>
        ${progressBar(c.currentMonth, c.avgMonthly)}
      </td>
      <td style="padding:8px 12px;font-size:14px;text-align:right;vertical-align:top;">
        <div>$${fmt(c.currentMonth)}</div>
        <div style="font-size:11px;color:#999;">of $${fmt(c.avgMonthly)} avg</div>
      </td>
      <td style="padding:8px 12px;font-size:13px;text-align:right;vertical-align:top;">
        <div>$${fmt(c.currentWeek)}/wk</div>
        <div style="font-size:11px;color:#999;">avg $${fmt(c.avgWeekly)}/wk</div>
      </td>
      <td style="padding:8px 12px;font-size:14px;text-align:right;vertical-align:top;">${paceBadge(c)}</td>
    </tr>`).join('');

  // Merchant pace rows
  const merchantPaceRows = data.merchantPace.map(m => `
    <tr>
      <td style="padding:8px 12px;font-size:14px;vertical-align:top;">
        <strong>${m.name}</strong>
        ${progressBar(m.currentMonth, m.avgMonthly)}
      </td>
      <td style="padding:8px 12px;font-size:14px;text-align:right;vertical-align:top;">
        <div>$${fmt(m.currentMonth)}</div>
        <div style="font-size:11px;color:#999;">of $${fmt(m.avgMonthly)} avg</div>
      </td>
      <td style="padding:8px 12px;font-size:13px;text-align:right;vertical-align:top;">
        <div>$${fmt(m.currentWeek)}/wk</div>
        <div style="font-size:11px;color:#999;">avg $${fmt(m.avgWeekly)}/wk</div>
      </td>
      <td style="padding:8px 12px;font-size:14px;text-align:right;vertical-align:top;">${paceBadge(m)}</td>
    </tr>`).join('');

  // Yesterday breakdown
  const yesterdayRows = data.yesterdayTx.slice(0, 6).map(t => `
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

  ${data.upcomingBills.length > 0 ? `
  <!-- Upcoming bills -->
  <tr><td style="padding:0 32px 20px;">
    <div style="font-weight:700;font-size:15px;color:#1a1a2e;margin-bottom:8px;">Upcoming Bills — $${fmt(data.upcomingTotal)}</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border-radius:8px;">${billRows}</table>
    ${data.upcomingBills.length > 8 ? `<div style="font-size:12px;color:#999;padding:6px 12px;">+${data.upcomingBills.length - 8} more</div>` : ''}
  </td></tr>` : ''}

  ${data.categoryPace.length > 0 ? `
  <!-- Category pace -->
  <tr><td style="padding:0 32px 20px;">
    <div style="font-weight:700;font-size:15px;color:#1a1a2e;margin-bottom:4px;">Category Pace — Month to Date</div>
    <div style="font-size:12px;color:#999;margin-bottom:8px;">Day ${data.dayOfMonth} of ${data.daysInMonth} · Based on ${data.numHistMonths}-month averages</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border-radius:8px;">
      <tr style="border-bottom:1px solid #eee;">
        <td style="padding:6px 12px;font-size:11px;color:#999;text-transform:uppercase;">Category</td>
        <td style="padding:6px 12px;font-size:11px;color:#999;text-align:right;text-transform:uppercase;">This Month</td>
        <td style="padding:6px 12px;font-size:11px;color:#999;text-align:right;text-transform:uppercase;">This Week</td>
        <td style="padding:6px 12px;font-size:11px;color:#999;text-align:right;text-transform:uppercase;">Pace</td>
      </tr>
      ${catPaceRows}
    </table>
  </td></tr>` : ''}

  ${data.merchantPace.length > 0 ? `
  <!-- Merchant pace -->
  <tr><td style="padding:0 32px 20px;">
    <div style="font-weight:700;font-size:15px;color:#1a1a2e;margin-bottom:4px;">Merchant Pace — Month to Date</div>
    <div style="font-size:12px;color:#999;margin-bottom:8px;">Current month vs. ${data.numHistMonths}-month average</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border-radius:8px;">
      <tr style="border-bottom:1px solid #eee;">
        <td style="padding:6px 12px;font-size:11px;color:#999;text-transform:uppercase;">Merchant</td>
        <td style="padding:6px 12px;font-size:11px;color:#999;text-align:right;text-transform:uppercase;">This Month</td>
        <td style="padding:6px 12px;font-size:11px;color:#999;text-align:right;text-transform:uppercase;">This Week</td>
        <td style="padding:6px 12px;font-size:11px;color:#999;text-align:right;text-transform:uppercase;">Pace</td>
      </tr>
      ${merchantPaceRows}
    </table>
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
