import { supabase } from './shared';

/**
 * Daily 5pm "Krezzo Report" — pacing edition.
 *
 * Instead of a static 90-day "top vendors" list, this answers two questions:
 *   1. How are you doing THIS WEEK vs. your usual pace?
 *   2. How are you doing THIS MONTH vs. your usual pace?
 *
 * "Usual pace" is a trailing ~12-month rolling daily average of DISCRETIONARY
 * spend (everything except the user's tagged recurring bills). Week/month
 * spend-to-date is compared against that baseline prorated to how far we are
 * into the period, so the user gets rewarded when they're under their norm.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MIN_BASELINE_DAYS = 28; // need ~4 weeks of history before pacing is meaningful
// Spend within this % of pace counts as "on pace". A percentage rather than a
// flat dollar band so large categories don't alarm on normal day-to-day noise.
const PACE_OK_BAND_PCT = 15;

// Parse a YYYY-MM-DD string to a stable UTC-noon Date (avoids TZ drift).
const parseISO = (s: string) => new Date(`${s}T12:00:00Z`);
const daysBetween = (a: string, b: string) =>
  Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / MS_PER_DAY);

// Format a Date's wall-clock fields as YYYY-MM-DD.
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;
const titleCase = (s: string) =>
  String(s || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
const clip = (s: string, n = 18) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

export async function generateDailyReportV2(userId: string): Promise<string> {
  try {
    const { data: authUser } = await supabase.auth.admin.getUserById(userId);
    const firstName =
      authUser?.user?.user_metadata?.firstName ||
      authUser?.user?.user_metadata?.first_name ||
      'there';

    // ---- Connected items ----
    const { data: userItems } = await supabase
      .from('items')
      .select('id, plaid_item_id')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (!userItems || userItems.length === 0) {
      return `📊 Daily snapshot\n\nHey ${firstName}!\nNo bank accounts connected yet. Connect to see your daily pacing.`;
    }

    const itemDbIds = userItems.map(i => i.id);
    const plaidItemIds = userItems.map(i => i.plaid_item_id);

    // ---- Available balance (depository only) ----
    const { data: accounts } = await supabase
      .from('accounts')
      .select('type, subtype, available_balance')
      .in('item_id', itemDbIds);

    const availableBalance = (accounts || [])
      .filter(
        acc =>
          acc.type === 'depository' &&
          (!acc.subtype || acc.subtype === 'checking' || acc.subtype === 'savings'),
      )
      .reduce((sum, acc) => sum + (acc.available_balance || 0), 0);

    // ---- Tagged recurring merchants (used to exclude bills from discretionary) ----
    const { data: taggedMerchants } = await supabase
      .from('tagged_merchants')
      .select('merchant_name, expected_amount, next_predicted_date, is_active')
      .eq('user_id', userId)
      .eq('is_active', true);

    const billMerchantSet = new Set<string>(
      (taggedMerchants || [])
        .map(tm => (tm.merchant_name || '').toLowerCase().trim())
        .filter(Boolean),
    );

    // ---- Time anchors (Eastern wall-clock) ----
    const now = new Date();
    // "Fake local" Date holding ET wall-clock values so getDay/getDate/etc. are ET.
    const etNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const todayStr = ymd(etNow);

    const yesterday = new Date(etNow);
    yesterday.setDate(etNow.getDate() - 1);
    const yesterdayStr = ymd(yesterday);

    const dow = etNow.getDay(); // 0 = Sunday
    const weekStart = new Date(etNow);
    weekStart.setDate(etNow.getDate() - dow);
    const weekStartStr = ymd(weekStart);
    const daysElapsedWeek = dow + 1; // Sun = 1 ... Sat = 7

    const monthStart = new Date(etNow.getFullYear(), etNow.getMonth(), 1);
    const monthStartStr = ymd(monthStart);
    const daysElapsedMonth = etNow.getDate();

    const baselineStart = new Date(etNow);
    baselineStart.setDate(etNow.getDate() - 365);
    const baselineStartStr = ymd(baselineStart);

    // North-star windows: 28 complete days ending yesterday, and the 28 before.
    const burn28Start = new Date(etNow);
    burn28Start.setDate(etNow.getDate() - 28); // yesterday - 27
    const burn28StartStr = ymd(burn28Start);
    const prior28Start = new Date(etNow);
    prior28Start.setDate(etNow.getDate() - 56);
    const prior28StartStr = ymd(prior28Start);

    // ---- Next income / horizon (for bills line) ----
    let nextIncomeDate: Date | null = null;
    const { data: incomeProfile } = await supabase
      .from('user_income_profiles')
      .select('profile_data')
      .eq('user_id', userId)
      .single();

    const sources = incomeProfile?.profile_data?.income_sources || [];
    try {
      const structured = sources.filter(
        (s: any) => s && s.expected_amount > 0 && s.frequency && s.frequency !== 'irregular',
      );
      const candidates: Date[] = [];
      structured.forEach((s: any) => {
        let d: Date | null = null;
        if (s.next_predicted_date && new Date(s.next_predicted_date) >= now) {
          d = new Date(s.next_predicted_date);
        } else if (s.last_pay_date) {
          const base = new Date(s.last_pay_date);
          const freq = (s.frequency || '').toLowerCase();
          d = new Date(base);
          const advance = (days: number) => {
            while (d! <= now) d!.setDate(d!.getDate() + days);
          };
          if (freq === 'weekly') advance(7);
          else if (freq === 'bi-weekly' || freq === 'biweekly') advance(14);
          else {
            while (d <= now) d.setMonth(d.getMonth() + 1);
          }
        }
        if (d) candidates.push(d);
      });
      candidates.sort((a, b) => a.getTime() - b.getTime());
      nextIncomeDate = candidates[0] || null;
    } catch {}

    const horizonDate = nextIncomeDate
      ? new Date(nextIncomeDate)
      : new Date(now.getTime() + 30 * MS_PER_DAY);

    let totalBills = 0;
    let billsCount = 0;
    if (taggedMerchants && taggedMerchants.length > 0) {
      const { data: billsWindow } = await supabase
        .from('tagged_merchants')
        .select('expected_amount, next_predicted_date')
        .eq('user_id', userId)
        .eq('is_active', true)
        .gte('next_predicted_date', todayStr)
        .lt('next_predicted_date', ymd(horizonDate));

      const list = billsWindow || [];
      billsCount = list.length;
      totalBills = list.reduce((sum, b) => sum + Number(b.expected_amount || 0), 0);
    }

    const horizonLabel = nextIncomeDate
      ? horizonDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          timeZone: 'America/New_York',
        })
      : null;
    const dateLabel = now.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: 'America/New_York',
    });

    const balanceLine = () => {
      let line = `💰 ${money(availableBalance)} available`;
      if (billsCount > 0) {
        line += ` · ${money(totalBills)} in bills`;
        line += horizonLabel ? ` before ${horizonLabel}` : ` (next 30 days)`;
      }
      return line;
    };

    // ---- Discretionary transactions over the trailing year ----
    const { data: rangeTx } = await supabase
      .from('transactions')
      .select('amount, merchant_name, name, ai_category_tag, date')
      .in('plaid_item_id', plaidItemIds)
      .gte('date', baselineStartStr)
      .gt('amount', 0);

    // Aggregate: overall baseline/WTD/MTD plus per-merchant & per-category maps.
    type Bucket = { label: string; baseline: number; baselineCount: number; mtd: number; mtdCount: number };
    const merchantMap = new Map<string, Bucket>();
    const categoryMap = new Map<string, Bucket>();

    let baselineTotal = 0; // discretionary spend from baselineStart..yesterday
    let wtd = 0; // week-to-date (incl. today)
    let mtd = 0; // month-to-date (incl. today)
    let burn28Total = 0; // last 28 complete days (ending yesterday)
    let prior28Total = 0; // the 28 days before that
    let earliestStr: string | null = null;

    const bump = (
      map: Map<string, Bucket>,
      key: string,
      label: string,
      amt: number,
      inBaseline: boolean,
      inMonth: boolean,
    ) => {
      const row = map.get(key) || { label, baseline: 0, baselineCount: 0, mtd: 0, mtdCount: 0 };
      if (inBaseline) {
        row.baseline += amt;
        row.baselineCount += 1;
      }
      if (inMonth) {
        row.mtd += amt;
        row.mtdCount += 1;
      }
      map.set(key, row);
    };

    for (const t of rangeTx || []) {
      const rawMerchant = String((t as any).merchant_name || (t as any).name || '').trim();
      const merchantKey = rawMerchant.toLowerCase();
      if (!rawMerchant || billMerchantSet.has(merchantKey)) continue; // skip bills

      const amt = Math.max(0, Number((t as any).amount || 0));
      const date = String((t as any).date || '');
      if (!date) continue;

      const inBaseline = date <= yesterdayStr; // exclude today's partial from "usual"
      const inMonth = date >= monthStartStr;

      if (inBaseline) {
        baselineTotal += amt;
        if (!earliestStr || date < earliestStr) earliestStr = date;
        if (date >= burn28StartStr) burn28Total += amt;
        else if (date >= prior28StartStr) prior28Total += amt;
      }
      if (date >= weekStartStr) wtd += amt;
      if (inMonth) mtd += amt;

      // Transfers / card payments are money movement, not spending — keep them
      // out of the category/vendor pacing lists (totals are left unchanged).
      const cat = String((t as any).ai_category_tag || '').trim();
      const isMoneyMovement = /transfer|payment|zelle|venmo/i.test(cat) || /zelle|venmo/i.test(rawMerchant);
      if (!isMoneyMovement) {
        bump(merchantMap, merchantKey, rawMerchant, amt, inBaseline, inMonth);
        if (cat) bump(categoryMap, cat.toLowerCase(), cat, amt, inBaseline, inMonth);
      }
    }

    // Effective baseline length: from first observed spend (capped at 365d) to yesterday.
    const spanStartStr =
      earliestStr && earliestStr > baselineStartStr ? earliestStr : baselineStartStr;
    const effectiveBaselineDays = Math.max(1, daysBetween(spanStartStr, yesterdayStr) + 1);
    const dailyAvg = baselineTotal / effectiveBaselineDays;

    // ---- Not enough history: skip pacing, show plain totals ----
    if (effectiveBaselineDays < MIN_BASELINE_DAYS || dailyAvg <= 0) {
      let msg = `Krezzo · ${dateLabel}\n\n`;
      msg += `📅 This week: ${money(wtd)} spent\n`;
      msg += `🗓️ This month: ${money(mtd)} spent\n\n`;
      msg += `Still learning your usual pace — I need ~4 weeks of history before I can compare.\n\n`;
      msg += `${balanceLine()}\n\n`;
      msg += `Have a good one 👋`;
      return msg;
    }

    // ---- Pacing blocks ----
    const expectedWeek = dailyAvg * daysElapsedWeek;
    const expectedMonth = dailyAvg * daysElapsedMonth;

    const pacingBlock = (emoji: string, title: string, spent: number, expected: number) => {
      const pct = expected > 0 ? Math.round((spent / expected - 1) * 100) : 0;
      const delta = Math.round(spent - expected);
      let status: string;
      if (Math.abs(pct) <= PACE_OK_BAND_PCT) {
        status = `⚖️ right on pace`;
      } else if (delta > 0) {
        status = `🔺 ${money(Math.abs(delta))} over pace`;
      } else {
        status = `✅ ${money(Math.abs(delta))} under pace — nice work`;
      }
      return `${emoji} ${title}\n${money(spent)} spent · ~${money(expected)} pace by now\n${status}\n\n`;
    };

    // ---- Category & vendor pacing: usual monthly avg vs current month ----
    // Ranked by usual monthly spend, limited to habitual items (>2 tx/month
    // on average) so steady under-pace items surface too. Pace is the usual
    // monthly amount spread over a day and multiplied by days elapsed, so
    // "green" is earnable rather than just a function of where we are in the month.
    const baselineMonths = effectiveBaselineDays / 30.44;
    type PaceRow = {
      label: string;
      avgMonthly: number;
      paceToDate: number;
      mtd: number;
      mtdCount: number;
      pct: number;
    };
    const toPaceRows = (map: Map<string, Bucket>): PaceRow[] =>
      Array.from(map.values())
        .filter(row => row.baselineCount / baselineMonths > 2 && row.baseline / baselineMonths >= 10)
        .map(row => {
          const avgMonthly = row.baseline / baselineMonths;
          const paceToDate = (row.baseline / effectiveBaselineDays) * daysElapsedMonth;
          return {
            label: clip(titleCase(row.label), 16),
            avgMonthly,
            paceToDate,
            mtd: row.mtd,
            mtdCount: row.mtdCount,
            pct: paceToDate > 0 ? Math.round((row.mtd / paceToDate) * 100) : 100,
          };
        })
        .sort((a, b) => b.avgMonthly - a.avgMonthly);

    const paceEmoji = (pct: number) => {
      if (pct > 100 + PACE_OK_BAND_PCT) return '🔴';
      if (pct < 100 - PACE_OK_BAND_PCT) return '🟢';
      return '🟡';
    };

    const paceLine = (r: PaceRow) =>
      `${paceEmoji(r.pct)} ${r.label} ${money(r.mtd)} vs ${money(r.paceToDate)} pace · ~${money(r.avgMonthly)}/mo (${r.mtdCount}x)`;

    const topCategories = toPaceRows(categoryMap).slice(0, 5);
    const topVendors = toPaceRows(merchantMap).slice(0, 5);

    // ---- Compose ----
    let msg = `Krezzo · ${dateLabel}\n\n`;
    msg += pacingBlock('📅', 'This week', wtd, expectedWeek);
    msg += pacingBlock('🗓️', 'This month', mtd, expectedMonth);

    if (topCategories.length > 0) {
      msg += `📊 Categories (mo)\n`;
      msg += topCategories.map(paceLine).join('\n');
      msg += `\n\n`;
    }
    if (topVendors.length > 0) {
      msg += `🏪 Top vendors (mo)\n`;
      msg += topVendors.map(paceLine).join('\n');
      msg += `\n\n`;
    }

    // ---- North star: Daily Burn (28d avg of discretionary spend/day) ----
    const burn28 = burn28Total / 28;
    const hasPriorWindow = spanStartStr <= prior28StartStr;
    if (burn28 > 0) {
      let burnLine = `🎯 Daily burn: ${money(burn28)}/day`;
      if (hasPriorWindow) {
        const prior28 = prior28Total / 28;
        const diff = burn28 - prior28;
        if (Math.abs(diff) < prior28 * 0.03) {
          burnLine += ` · steady vs last month`;
        } else if (diff < 0) {
          burnLine += ` · down from ${money(prior28)} ✅`;
        } else {
          burnLine += ` · up from ${money(prior28)} 🔺`;
        }
      } else {
        burnLine += ` (28d avg)`;
      }
      msg += `${burnLine}\n`;
    }

    msg += `${balanceLine()}\n\n`;

    const weekUnder = wtd - expectedWeek < 0;
    const monthUnder = mtd - expectedMonth < 0;
    msg += weekUnder && monthUnder ? `Keep crushing it 👋` : `Have a good one 👋`;

    return msg;
  } catch (err) {
    console.error('❌ Error in generateDailyReportV2:', err);
    return `📊 Daily snapshot\n\nHey there!\nWe couldn't generate your snapshot right now. Please try again later.`;
  }
}
