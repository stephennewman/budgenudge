import { supabase, type Transaction, type MerchantPacing } from './shared';
import {
  getUserFirstName,
  runEnhancedBillDetectionInTemplate,
  analyzeMerchantPatternForTemplate,
  isNonBillMerchant,
  calculateEnhancedBillScoreForTemplate,
  isBillMerchant,
  normalizeMerchantNameForTemplate,
  calculateVarianceForTemplate,
  findNextIncome,
  normalizeIncomeSourceName,
  generateAIVibeMessage,
  generateEnhancedAIVibeMessage,
  generateActionItems,
} from './helpers';

export async function generateDailyReportV2(userId: string): Promise<string> {
  try {
    // First name
    const { data: authUser } = await supabase.auth.admin.getUserById(userId);
    const firstName = authUser?.user?.user_metadata?.firstName || authUser?.user?.user_metadata?.first_name || 'there';

    // Items
    const { data: userItems } = await supabase
      .from('items')
      .select('id, plaid_item_id')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (!userItems || userItems.length === 0) {
      return `📊 Daily snapshot\n\nHey ${firstName}!\nNo bank accounts connected yet. Connect to see your daily insights.`;
    }

    const itemDbIds = userItems.map(i => i.id);
    const plaidItemIds = userItems.map(i => i.plaid_item_id);

    // Available balance (depository only)
    const { data: accounts } = await supabase
      .from('accounts')
      .select('type, subtype, available_balance')
      .in('item_id', itemDbIds);

    const availableBalance = (accounts || [])
      .filter(acc => acc.type === 'depository' && (!acc.subtype || acc.subtype === 'checking' || acc.subtype === 'savings'))
      .reduce((sum, acc) => sum + (acc.available_balance || 0), 0);

    // Tagged recurring merchants for exclusion + bills
    const todayISO = new Date().toISOString().split('T')[0];
    const { data: taggedMerchants } = await supabase
      .from('tagged_merchants')
      .select('merchant_name, expected_amount, next_predicted_date, is_active')
      .eq('user_id', userId)
      .eq('is_active', true);

    // Yesterday spend
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yISO = yesterday.toISOString().split('T')[0];

    const { data: yesterdayTx } = await supabase
      .from('transactions')
      .select('date, merchant_name, name, amount')
      .in('plaid_item_id', plaidItemIds)
      .eq('date', yISO)
      .gt('amount', 0) // spending only
      .order('amount', { ascending: false });

    const totalYesterdayAll = (yesterdayTx || []).reduce((sum, t) => sum + (t.amount || 0), 0);
    const topYesterdayAll = (yesterdayTx || [])
      .slice()
      .sort((a, b) => (b.amount || 0) - (a.amount || 0))
      .slice(0, 2);

    // Next income (prefer profile, fallback to 30-day horizon)
    const now = new Date();
    let nextIncomeDate: Date | null = null;
    const { data: incomeProfile } = await supabase
      .from('user_income_profiles')
      .select('profile_data')
      .eq('user_id', userId)
      .single();

    const sources = incomeProfile?.profile_data?.income_sources || [];
    try {
      const structured = sources
        .filter((s: any) => s && s.expected_amount > 0 && s.frequency && s.frequency !== 'irregular');
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
          else if (freq === 'monthly') {
            while (d <= now) d.setMonth(d.getMonth() + 1);
          } else {
            // default monthly
            while (d <= now) d.setMonth(d.getMonth() + 1);
          }
        }
        if (d) candidates.push(d);
      });
      candidates.sort((a, b) => a.getTime() - b.getTime());
      nextIncomeDate = candidates[0] || null;
    } catch {}

    // Horizon (next income date if available, else 30 days)
    const horizonDate = nextIncomeDate ? new Date(nextIncomeDate) : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Bills until the day BEFORE income
    let totalBills = 0;
    let billsCount = 0;
    if (taggedMerchants && taggedMerchants.length > 0) {
      const { data: billsWindow } = await supabase
        .from('tagged_merchants')
        .select('expected_amount, next_predicted_date')
        .eq('user_id', userId)
        .eq('is_active', true)
        .gte('next_predicted_date', todayISO)
        .lt('next_predicted_date', horizonDate.toISOString().split('T')[0]);

      const list = billsWindow || [];
      billsCount = list.length;
      totalBills = list.reduce((sum, b) => sum + Number(b.expected_amount || 0), 0);
    }

    // ---------- Top behavioral spend (last 90 days, 3+ times, bills excluded) ----------
    // Behavioral = repeated discretionary spend. Recurring bills (mortgage, utilities,
    // 1x bills) are excluded via the tagged-merchant set; only merchants/categories with
    // 3+ purchases in the window qualify.
    const lookback90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const lb90ISO = lookback90.toISOString().split('T')[0];

    const billMerchantSet = new Set<string>(
      (taggedMerchants || [])
        .map(tm => (tm.merchant_name || '').toLowerCase().trim())
        .filter(Boolean)
    );

    // Recent window (last 30d) vs the prior 60d, to detect spending "more than usual"
    const recent30ISO = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data: behaviorTx } = await supabase
      .from('transactions')
      .select('amount, merchant_name, name, ai_category_tag, date')
      .in('plaid_item_id', plaidItemIds)
      .gte('date', lb90ISO)
      .gt('amount', 0); // spending only

    type SpendRow = { label: string; count: number; total: number; recent: number; prior: number };
    const merchantMap = new Map<string, SpendRow>();
    const categoryMap = new Map<string, SpendRow>();

    const bump = (map: Map<string, SpendRow>, key: string, label: string, amt: number, isRecent: boolean) => {
      const row = map.get(key) || { label, count: 0, total: 0, recent: 0, prior: 0 };
      row.count += 1;
      row.total += amt;
      if (isRecent) row.recent += amt;
      else row.prior += amt;
      map.set(key, row);
    };

    for (const t of behaviorTx || []) {
      const rawMerchant = String((t as any).merchant_name || (t as any).name || '').trim();
      const merchantKey = rawMerchant.toLowerCase();
      const amt = Math.max(0, Number((t as any).amount || 0));

      // Skip recurring bills entirely — they aren't behavioral
      if (!rawMerchant || billMerchantSet.has(merchantKey)) continue;

      const isRecent = String((t as any).date || '') >= recent30ISO;

      bump(merchantMap, merchantKey, rawMerchant, amt, isRecent);

      const cat = String((t as any).ai_category_tag || '').trim();
      if (cat) bump(categoryMap, cat.toLowerCase(), cat, amt, isRecent);
    }

    // Top behavioral spend by frequency (3+ purchases in 90d)
    const rankTop5 = (m: Map<string, SpendRow>): SpendRow[] =>
      Array.from(m.values())
        .filter(r => r.count >= 3)
        .sort((a, b) => b.count - a.count || b.total - a.total)
        .slice(0, 5);

    const topMerchants = rankTop5(merchantMap);
    const topCategories = rankTop5(categoryMap);

    // Overage: last 30d spend vs the prior 60d monthly-equivalent average.
    // Requires a real baseline (≥$20/mo) and a meaningful jump to avoid noise.
    type OverRow = { label: string; recent: number; baseline: number; delta: number; pct: number };
    const rankOverage = (m: Map<string, SpendRow>): OverRow[] =>
      Array.from(m.values())
        .map(r => {
          const baseline = r.prior / 2; // 60 days → monthly-equivalent
          return {
            label: r.label,
            recent: r.recent,
            baseline,
            delta: r.recent - baseline,
            pct: baseline > 0 ? Math.round((r.recent / baseline - 1) * 100) : 0,
          };
        })
        .filter(r => r.baseline >= 20 && r.delta >= 15 && r.pct >= 15)
        .sort((a, b) => b.delta - a.delta)
        .slice(0, 5);

    const overageMerchants = rankOverage(merchantMap);
    const overageCategories = rankOverage(categoryMap);

    // ---- Compose: status lead, exceptions, position, sign-off ----
    const titleCase = (s: string) =>
      String(s || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

    const horizonLabel = nextIncomeDate
      ? horizonDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' })
      : null;
    const dateLabel = now.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/New_York'
    });

    let msg = `Krezzo · ${dateLabel}\n\n`;

    const clip = (label: string, applyTitleCase: boolean) =>
      (applyTitleCase ? titleCase(label) : label).slice(0, 22);

    // Overage first — where you're spending more than usual (30d vs prior 60d avg)
    const fmtOver = (r: OverRow, applyTitleCase: boolean) =>
      `${clip(r.label, applyTitleCase)} · $${Math.round(r.recent).toLocaleString()} · ↑${Math.min(r.pct, 300)}% vs usual`;

    if (overageMerchants.length > 0 || overageCategories.length > 0) {
      msg += `🔺 Spending more than usual\n`;
      if (overageMerchants.length > 0) {
        msg += overageMerchants.map(r => fmtOver(r, false)).join('\n') + `\n`;
      }
      if (overageCategories.length > 0) {
        msg += overageCategories.map(r => fmtOver(r, true)).join('\n') + `\n`;
      }
      msg += `\n`;
    }

    // Top behavioral spend — vendors & categories by frequency (last 90 days)
    const fmtRow = (r: SpendRow, applyTitleCase: boolean) =>
      `${clip(r.label, applyTitleCase)} · ${r.count}x · $${Math.round(r.total).toLocaleString()}`;

    if (topMerchants.length > 0) {
      msg += `🔁 Top vendors (90d, 3+ visits)\n`;
      msg += topMerchants.map(r => fmtRow(r, false)).join('\n') + `\n\n`;
    }
    if (topCategories.length > 0) {
      msg += `📊 Top categories (90d, 3+ visits)\n`;
      msg += topCategories.map(r => fmtRow(r, true)).join('\n') + `\n\n`;
    }
    if (topMerchants.length === 0 && topCategories.length === 0) {
      msg += `Not enough repeat spending yet to spot patterns.\n\n`;
    }

    // Yesterday in one line — summarized, not itemized
    const yCount = (yesterdayTx || []).length;
    if (yCount > 0) {
      const tops = topYesterdayAll
        .map(t => {
          const m = titleCase(String((t as any).merchant_name || (t as any).name || 'purchase').slice(0, 20));
          return `${m} $${Math.round(Number((t as any).amount || 0)).toLocaleString()}`;
        })
        .join(', ');
      msg += `Yesterday: $${Math.round(totalYesterdayAll).toLocaleString()} across ${yCount} buy${yCount !== 1 ? 's' : ''}`;
      if (tops) msg += ` (${tops})`;
      msg += `\n`;
    } else {
      msg += `Yesterday: nothing posted\n`;
    }

    // Financial position
    msg += `💰 $${Math.round(availableBalance).toLocaleString()} available`;
    if (billsCount > 0) {
      msg += ` · $${Math.round(totalBills).toLocaleString()} in bills`;
      msg += horizonLabel ? ` before ${horizonLabel}` : ` (next 30 days)`;
    }
    msg += `\n\n`;

    // Sign-off
    msg += `Have a good one 👋`;

    return msg;
  } catch (err) {
    console.error('❌ Error in generateDailyReportV2:', err);
    return `📊 Daily snapshot\n\nHey there!\nWe couldn't generate your snapshot right now. Please try again later.`;
  }
}

// Simple and reliable income prediction function
