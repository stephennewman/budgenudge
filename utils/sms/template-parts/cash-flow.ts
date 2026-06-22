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

export async function generateCashFlowRunwayMessage(userId: string): Promise<string> {
  try {
    // Fetch user's Plaid items and depository accounts for balance
    const { data: userItems } = await supabase
      .from('items')
      .select('id, plaid_item_id')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (!userItems || userItems.length === 0) {
      return '🛤️ CASH FLOW RUNWAY\n\nNo bank accounts connected.';
    }

    const itemDbIds = userItems.map(i => i.id);
    const itemIds = userItems.map(i => i.plaid_item_id);

    // Current available balance from depository accounts only
    const { data: accounts } = await supabase
      .from('accounts')
      .select('type, subtype, available_balance')
      .in('item_id', itemDbIds);

    const checkingSavings = (accounts || []).filter(
      a => a.type === 'depository' && (a.subtype === 'checking' || a.subtype === 'savings')
    );
    const availableBalance = checkingSavings.reduce((sum, a) => sum + (a.available_balance || 0), 0);

    // Detect paycheck streams from deposits (negative amounts)
    const now = new Date();
    const lookbackStart = new Date();
    lookbackStart.setDate(lookbackStart.getDate() - 120);
    const lb = lookbackStart.toISOString().split('T')[0];

    type IncomeTxn = { date: string; name: string | null; merchant_name: string | null; amount: number };
    const { data: incomeCandidates } = await supabase
      .from('transactions')
      .select('date, name, merchant_name, amount')
      .in('plaid_item_id', itemIds)
      .gte('date', lb)
      .lt('amount', 0) // deposits as negative
      .order('date', { ascending: true });

    function normalizeIncomeSourceName(name: string): string {
      return name
        .replace(/\d{4}-\d{2}-\d{2}/g, '')
        .replace(/\b(payroll|deposit|direct|payment|transfer|ach|tran)\b/gi, '')
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
    }

    function variance(arr: number[]): number {
      if (arr.length === 0) return 0;
      const mean = arr.reduce((s, n) => s + n, 0) / arr.length;
      return arr.reduce((s, n) => s + Math.pow(n - mean, 2), 0) / arr.length;
    }

    function detectStreams(txns: IncomeTxn[]) {
      const groups = new Map<string, IncomeTxn[]>();
      for (const t of txns) {
        const label = `${t.merchant_name || ''} ${t.name || ''}`.trim();
        const key = normalizeIncomeSourceName(label);
        if (!key) continue;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(t);
      }
      const streams: Array<{
        source: string;
        expectedAmount: number;
        expectedInterval: number; // in days
        confidence: number;
        lastDate: Date;
        nextDate: Date;
      }> = [];

      for (const [key, arr] of groups.entries()) {
        if (arr.length < 3) continue;
        // Sort and compute intervals
        const sorted = [...arr].sort((a, b) => (a.date < b.date ? -1 : 1));
        const dates = sorted.map(t => new Date(t.date + 'T12:00:00'));
        const intervals: number[] = [];
        for (let i = 1; i < dates.length; i++) {
          intervals.push(Math.max(1, Math.round((dates[i].getTime() - dates[i - 1].getTime()) / (1000 * 60 * 60 * 24))));
        }
        const avgInterval = intervals.reduce((s, n) => s + n, 0) / intervals.length;
        const ivar = variance(intervals);

        // Choose expected interval bucket
        let expectedInterval = 14;
        if (Math.abs(avgInterval - 7) <= 2 && ivar < 4) expectedInterval = 7;
        else if (Math.abs(avgInterval - 15) <= 3 && ivar < 10) expectedInterval = 15;
        else if (Math.abs(avgInterval - 30) <= 5 && ivar < 25) expectedInterval = 30;

        // Amounts as absolute values
        const amounts = sorted.map(t => Math.abs(t.amount));
        const avgAmt = amounts.reduce((s, n) => s + n, 0) / amounts.length;
        const aVar = variance(amounts);
        const amountConsistency = avgAmt > 0 ? Math.max(0, 100 - (aVar / avgAmt) * 100) : 0;
        const frequencyConsistency = Math.max(0, 100 - (ivar / expectedInterval) * 10);
        const countBonus = Math.min(100, (sorted.length - 3) * 10 + 60);
        const confidence = Math.round(frequencyConsistency * 0.4 + amountConsistency * 0.3 + countBonus * 0.2 + 10); // +10 regularity bonus

        // Next date: advance last by expected interval until future
        let nextDate = new Date(dates[dates.length - 1].getTime());
        while (nextDate <= now) {
          nextDate = new Date(nextDate.getTime() + expectedInterval * 24 * 60 * 60 * 1000);
        }

        // Display source label: title case of key
        const source = key
          .split(' ')
          .filter(Boolean)
          .map(w => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');

        streams.push({
          source,
          expectedAmount: Math.round(avgAmt * 100) / 100,
          expectedInterval,
          confidence,
          lastDate: dates[dates.length - 1],
          nextDate,
        });
      }

      // Sort by next date soonest, then by expected amount desc
      return streams.sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime() || b.expectedAmount - a.expectedAmount);
    }

    const streamsAll = detectStreams((incomeCandidates || []) as IncomeTxn[]);

    function isTransferOrInvestmentSource(label: string): boolean {
      const l = (label || '').toLowerCase();
      const badKeywords = [
        'brokerage',
        'transfer',
        'venmo',
        'paypal',
        'zelle',
        'cash app',
        'apple cash',
        'external account',
        'internal transfer',
        'from savings',
        'to checking',
        'funds from',
        'sweep'
      ];
      return badKeywords.some(k => l.includes(k));
    }

    // Filter out likely non-paycheck sources for display and for primary next date
    const streams = (streamsAll || []).filter(s => !isTransferOrInvestmentSource(s.source));
    const primaryNext = streams.length > 0
      ? streams[0].nextDate
      : (streamsAll.length > 0 ? streamsAll[0].nextDate : new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000));
    const nextPaycheckDate = primaryNext;
    const daysUntilPay = Math.max(1, Math.ceil((nextPaycheckDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    // Sum predicted bills before next paycheck from tagged_merchants
    const { data: taggedMerchants } = await supabase
      .from('tagged_merchants')
      .select('merchant_name, expected_amount, next_predicted_date')
      .eq('user_id', userId)
      .eq('is_active', true);

    const billsInWindow = (taggedMerchants || []).filter(tm => {
      if (!tm.next_predicted_date) return false;
      const d = new Date(tm.next_predicted_date + 'T12:00:00');
      return d > now && d <= nextPaycheckDate;
    }).sort((a, b) => new Date(a.next_predicted_date + 'T12:00:00').getTime() - new Date(b.next_predicted_date + 'T12:00:00').getTime());

    const billsBeforePay = billsInWindow.reduce((sum, tm) => sum + Number(tm.expected_amount || 0), 0);

    // Estimate discretionary spend using pattern-based baseline
    // 1) Use up to 180d (or since first tx) to detect patterned discretionary sources
    // 2) Build baseline from up to last 90d (or since first tx) using only patterned discretionary
    // Determine first known transaction date to avoid skewing with fixed windows
    const { data: firstTxRows } = await supabase
      .from('transactions')
      .select('date')
      .in('plaid_item_id', itemIds)
      .order('date', { ascending: true })
      .limit(1);

    const firstTxDate = firstTxRows && firstTxRows.length > 0
      ? new Date(firstTxRows[0].date + 'T12:00:00')
      : null;
    const msPerDay = 24 * 60 * 60 * 1000;
    const availableDays = firstTxDate ? Math.max(1, Math.ceil((now.getTime() - firstTxDate.getTime()) / msPerDay)) : 180;
    const historyDays = Math.min(180, availableDays);
    const baselineDays = Math.min(90, availableDays);
    const historyStart = new Date(now.getTime() - historyDays * msPerDay);
    const baselineStart = new Date(now.getTime() - baselineDays * msPerDay);

    // Pull active recurring merchants to exclude from baseline
    const { data: activeRecurring } = await supabase
      .from('tagged_merchants')
      .select('merchant_name')
      .eq('user_id', userId)
      .eq('is_active', true);

    const recurringMerchantSet = new Set((activeRecurring || []).map(m => (m.merchant_name || '').toLowerCase()));
    const excludedBillCategories = new Set([
      'Mortgage', 'Rent', 'Utilities', 'Electric', 'Gas & Electric', 'Water', 'Trash', 'Internet', 'Phone', 'Cable',
      'Insurance', 'Student Loans', 'Credit Card Bill', 'Payment', 'Transfer', 'Taxes', 'Subscription', 'Subscriptions'
    ].map(s => s.toLowerCase()));

    // 180d history for pattern detection
    const { data: history180 } = await supabase
      .from('transactions')
      .select('amount, date, ai_category_tag, ai_merchant_name, merchant_name, name')
      .in('plaid_item_id', itemIds)
      .gte('date', historyStart.toISOString().split('T')[0])
      .gt('amount', 0);

    type Tx = { amount: number; date: string; ai_category_tag?: string | null; ai_merchant_name?: string | null; merchant_name?: string | null; name?: string | null };
    const filtered180 = (history180 || []).filter((t: any) => {
      const cat = (t.ai_category_tag || '').toLowerCase();
      const merch = (t.ai_merchant_name || t.merchant_name || t.name || '').toLowerCase();
      const isRecurringMerchant = merch && recurringMerchantSet.has(merch);
      const isBillCategory = cat && excludedBillCategories.has(cat);
      const isVenmo = merch.includes('venmo');
      return !isRecurringMerchant && !isBillCategory && !isVenmo;
    }) as Tx[];

    // Pattern detection: occurrences across months/weeks
    const merchantStats = new Map<string, { count: number; months: Set<string>; weeks: Set<string> }>();
    const categoryStats = new Map<string, { count: number; months: Set<string>; weeks: Set<string> }>();
    for (const t of filtered180) {
      const d = new Date(t.date + 'T12:00:00');
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const weekKey = `${d.getFullYear()}-W${Math.ceil((d.getDate()) / 7)}`;
      const merch = (t.ai_merchant_name || t.merchant_name || t.name || '').toLowerCase();
      const cat = (t.ai_category_tag || '').toLowerCase();
      if (merch) {
        if (!merchantStats.has(merch)) merchantStats.set(merch, { count: 0, months: new Set(), weeks: new Set() });
        const s = merchantStats.get(merch)!;
        s.count += 1; s.months.add(monthKey); s.weeks.add(weekKey);
      }
      if (cat) {
        if (!categoryStats.has(cat)) categoryStats.set(cat, { count: 0, months: new Set(), weeks: new Set() });
        const s = categoryStats.get(cat)!;
        s.count += 1; s.months.add(monthKey); s.weeks.add(weekKey);
      }
    }

    const allowedMerchants = new Set<string>();
    const allowedCategories = new Set<string>();
    for (const [merch, s] of merchantStats.entries()) {
      if (s.count >= 6 && s.months.size >= 3) allowedMerchants.add(merch); // at least 6 tx over 3+ months
      else if (s.weeks.size >= 6) allowedMerchants.add(merch); // or appears in 6+ distinct weeks
    }
    for (const [cat, s] of categoryStats.entries()) {
      if (s.count >= 10 && s.months.size >= 3) allowedCategories.add(cat);
      else if (s.weeks.size >= 8) allowedCategories.add(cat);
    }

    // Build baseline from last 90 days, filtered to patterned discretionary only
    const { data: last90 } = await supabase
      .from('transactions')
      .select('amount, date, ai_category_tag, ai_merchant_name, merchant_name, name')
      .in('plaid_item_id', itemIds)
      .gte('date', baselineStart.toISOString().split('T')[0])
      .gt('amount', 0);

    const totalPatterned90 = (last90 || []).reduce((sum, t: any) => {
      const cat = (t.ai_category_tag || '').toLowerCase();
      const merch = (t.ai_merchant_name || t.merchant_name || t.name || '').toLowerCase();
      const isRecurringMerchant = merch && recurringMerchantSet.has(merch);
      const isBillCategory = cat && excludedBillCategories.has(cat);
      const isVenmo = merch.includes('venmo');
      const isPatterned = (merch && allowedMerchants.has(merch)) || (cat && allowedCategories.has(cat));
      if (isRecurringMerchant || isBillCategory || isVenmo || !isPatterned) return sum;
      return sum + (t.amount || 0);
    }, 0);

    const avgDailyDiscretionary = baselineDays > 0 ? (totalPatterned90 / baselineDays) : 0;
    const projectedDiscretionary = avgDailyDiscretionary * daysUntilPay;

    // Compute runway days until paycheck
    const projectedOutflows = billsBeforePay + projectedDiscretionary;
    const runwayBalanceAfter = availableBalance - projectedOutflows;
    const onTrack = runwayBalanceAfter >= 0;

    // Per-day cap to stay solvent until payday
    const perDayCap = Math.max(0, (availableBalance - billsBeforePay) / daysUntilPay);

    const payDateStr = nextPaycheckDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const riskText = onTrack ? 'On track' : 'At risk';
    const tip = onTrack
      ? 'Nice work. Keep daily spend near your 30-day average.'
      : `Reduce discretionary by ~$${Math.ceil(Math.abs(runwayBalanceAfter) / daysUntilPay)} per day to stay on track.`;

    const discretionaryRemaining = availableBalance - billsBeforePay;
    const primaryIncomeAmount = streams.length > 0 ? Math.round(streams[0].expectedAmount) : null;
    let msg = `🛤️ CASH FLOW RUNWAY\n`;
    msg += `Available balance: $${Math.round(availableBalance)}\n`;
    msg += `Next income in ${daysUntilPay} days (${payDateStr})\n`;
    msg += `Bills before income: $${Math.round(billsBeforePay)}\n`;
    if (billsInWindow.length > 0) {
      const billLines = billsInWindow.slice(0, 6).map(tm => {
        const d = new Date(tm.next_predicted_date + 'T12:00:00');
        const ds = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const name = (tm.merchant_name || 'Bill').slice(0, 20);
        const amt = Math.round(Number(tm.expected_amount || 0));
        return `• ${ds}: ${name} $${amt}`;
      }).join('\n');
      msg += billLines ? `${billLines}\n` : '';
    }
    msg += `Predicted money remaining: $${Math.round(discretionaryRemaining)}\n`;
    msg += `Max spend per day: $${Math.round(perDayCap)}\n`;
    msg += `Tip: ${tip}`;

    // Append detected income streams summary (top 2 for clarity)
    if (streams.length > 0) {
      msg += `\n\nNext income:`;
      const top2 = streams.slice(0, 2);
      for (const s of top2) {
        const d = s.nextDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        msg += `\n• ${d}: ~$${Math.round(s.expectedAmount)} (${s.source || 'Income'})`;
      }
    }
    // Add a light, encouraging closer (varies per user/day but deterministic-ish)
    const encouragements = [
      "You're doing great—your wallet just winked. 😎💸",
      "Small steps, big wins. Future-you says thanks. 🌟",
      "Budget boss mode: engaged. Keep rolling. 🛼",
      "Your money has main-character energy today. 🎬✨",
      "Even the bills are impressed with your planning. 📅👏",
      "Stay smooth—like a tap to pay on Friday. 💳✨",
    ];
    const uidScore = Array.from(userId).reduce((s, c) => s + c.charCodeAt(0), 0);
    const pick = (uidScore + now.getDate()) % encouragements.length;
    msg += `\n\n${encouragements[pick]}`;

    // Final disclaimer
    msg += `\n\n*Predictions based on historical data.`;

    return msg;
  } catch (error) {
    console.error('Error generating cash flow runway message:', error);
    return '🛤️ CASH FLOW RUNWAY\n\nError generating runway analysis.';
  }
}

// ===================================
// ONBOARDING SMS TEMPLATES
// ===================================

/**
 * Immediate onboarding message sent right after bank connection
 */
