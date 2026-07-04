import { createClient } from '@supabase/supabase-js';

/**
 * North-star metric: "Daily Burn" — 28-day rolling average of discretionary
 * spend per day (recurring bills excluded), computed over COMPLETE days
 * (i.e. ending yesterday, Eastern time).
 *
 * One row per user per day lands in `northstar_daily`. Rows are upserted so
 * late-posting Plaid transactions restate the metric on the next run.
 *
 * Bill exclusion intentionally mirrors generateDailyReportV2: exact
 * lowercased merchant-name match against active tagged_merchants.
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 28;

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export interface NorthstarResult {
  recorded: boolean;
  reason?: string;
  metricDate?: string;
  discSpend?: number;
  burn28d?: number;
}

/**
 * Compute yesterday's Daily Burn for a user and upsert it into
 * northstar_daily. Safe to call repeatedly; never throws.
 */
export async function recordNorthstarMetric(userId: string): Promise<NorthstarResult> {
  try {
    const { data: userItems } = await supabase
      .from('items')
      .select('plaid_item_id')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (!userItems || userItems.length === 0) {
      return { recorded: false, reason: 'no_items' };
    }
    const plaidItemIds = userItems.map(i => i.plaid_item_id);

    // Anchor on Eastern wall-clock so "yesterday" matches the SMS reports.
    const etNow = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })
    );
    const yesterday = new Date(etNow.getTime() - MS_PER_DAY);
    const metricDate = ymd(yesterday);
    const windowStart = new Date(yesterday.getTime() - (WINDOW_DAYS - 1) * MS_PER_DAY);
    const windowStartStr = ymd(windowStart);

    // Require at least a full window of history before the metric is meaningful.
    const { data: earliest } = await supabase
      .from('transactions')
      .select('date')
      .in('plaid_item_id', plaidItemIds)
      .gt('amount', 0)
      .order('date', { ascending: true })
      .limit(1);

    const firstTxnDate = earliest?.[0]?.date as string | undefined;
    if (!firstTxnDate || firstTxnDate > windowStartStr) {
      return { recorded: false, reason: 'insufficient_history' };
    }

    const { data: taggedMerchants } = await supabase
      .from('tagged_merchants')
      .select('merchant_name')
      .eq('user_id', userId)
      .eq('is_active', true);

    const billMerchantSet = new Set<string>(
      (taggedMerchants || [])
        .map(tm => (tm.merchant_name || '').toLowerCase().trim())
        .filter(Boolean)
    );

    const { data: txns } = await supabase
      .from('transactions')
      .select('amount, merchant_name, name, date')
      .in('plaid_item_id', plaidItemIds)
      .gte('date', windowStartStr)
      .lte('date', metricDate)
      .gt('amount', 0);

    let windowTotal = 0;
    let yesterdaySpend = 0;
    for (const t of txns || []) {
      const merchant = String(t.merchant_name || t.name || '').toLowerCase().trim();
      if (!merchant || billMerchantSet.has(merchant)) continue;
      const amt = Math.max(0, Number(t.amount || 0));
      windowTotal += amt;
      if (t.date === metricDate) yesterdaySpend += amt;
    }

    const burn28d = Math.round((windowTotal / WINDOW_DAYS) * 100) / 100;
    const discSpend = Math.round(yesterdaySpend * 100) / 100;

    const { error } = await supabase
      .from('northstar_daily')
      .upsert(
        { user_id: userId, metric_date: metricDate, disc_spend: discSpend, burn_28d: burn28d },
        { onConflict: 'user_id,metric_date' }
      );

    if (error) {
      console.error(`❌ northstar upsert failed for ${userId}:`, error.message);
      return { recorded: false, reason: error.message };
    }

    return { recorded: true, metricDate, discSpend, burn28d };
  } catch (err) {
    console.error(`❌ recordNorthstarMetric error for ${userId}:`, err);
    return { recorded: false, reason: err instanceof Error ? err.message : 'unknown' };
  }
}
