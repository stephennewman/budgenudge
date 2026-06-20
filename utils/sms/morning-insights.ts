import { createClient } from '@supabase/supabase-js';
import { DateTime } from 'luxon';
import { generateText, isLLMConfigured } from '@/utils/ai/llm';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ZONE = 'America/New_York';

// Categories that are fixed/non-discretionary; surfaced separately so the
// behavioral nudge can focus on spending the user can actually control.
const FIXED_CATEGORIES = new Set([
  'LOAN_PAYMENTS',
  'RENT_AND_UTILITIES',
  'TRANSFER_OUT',
  'TRANSFER_IN',
  'BANK_FEES',
]);

interface RawTxn {
  amount: number;
  date: string;
  merchant_name: string | null;
  name: string | null;
  pfc_primary: string | null;
  is_subscription: boolean | null;
}

export interface MorningInsights {
  today: string; // e.g. "Friday, June 19"
  dayName: string; // e.g. "Friday"
  dayOfMonth: number;
  daysInMonth: number;
  daysLeftInMonth: number;
  balance: { available: number | null; current: number | null };
  food: {
    mtdTotal: number;
    mtdCount: number;
    lastMonthSamePeriod: number;
    lastMonthFull: number;
    projectedMonth: number;
    dayOfWeekAvg: number; // avg food spend on this weekday over trailing window
  };
  topMerchantsMTD: Array<{ merchant: string; count: number; total: number }>;
  categoriesMTD: Array<{ category: string; total: number; count: number; fixed: boolean }>;
  yesterday: { total: number; items: Array<{ merchant: string; amount: number; category: string }> };
  subscriptions: { monthlyTotal: number; items: Array<{ merchant: string; amount: number }> };
}

function merchantOf(t: RawTxn): string {
  return (t.merchant_name || t.name || 'Unknown').trim();
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Gather a bounded set of deterministic spending stats for the morning text.
 * All figures are computed from real transactions so the LLM only phrases them.
 */
export async function gatherMorningInsights(userId: string): Promise<MorningInsights | null> {
  const now = DateTime.now().setZone(ZONE);
  const monthStart = now.startOf('month');
  const lastMonthStart = monthStart.minus({ months: 1 });
  const dayOfMonth = now.day;
  const lastMonthSameEnd = lastMonthStart.plus({ days: dayOfMonth }); // exclusive
  const yesterday = now.minus({ days: 1 }).startOf('day');
  const windowStart = now.minus({ days: 100 }).startOf('day');

  // Resolve the user's active plaid items.
  const { data: items } = await supabase
    .from('items')
    .select('id, plaid_item_id')
    .eq('user_id', userId)
    .is('deleted_at', null);

  if (!items || items.length === 0) return null;

  const plaidItemIds = items.map((i) => i.plaid_item_id);
  const itemIds = items.map((i) => i.id);

  // Balance across the user's accounts.
  const { data: accounts } = await supabase
    .from('accounts')
    .select('available_balance, current_balance')
    .in('item_id', itemIds)
    .is('deleted_at', null);

  let available: number | null = null;
  let current: number | null = null;
  if (accounts && accounts.length > 0) {
    available = round2(accounts.reduce((s, a) => s + (a.available_balance ?? 0), 0));
    current = round2(accounts.reduce((s, a) => s + (a.current_balance ?? 0), 0));
  }

  // Pull ~100 days of transactions once, then aggregate in memory.
  const { data: txns } = await supabase
    .from('transactions')
    .select('amount, date, merchant_name, name, pfc_primary, is_subscription')
    .in('plaid_item_id', plaidItemIds)
    .gte('date', windowStart.toISODate()!)
    .order('date', { ascending: false });

  const all: RawTxn[] = (txns || []).map((t) => ({
    amount: Number(t.amount),
    date: t.date,
    merchant_name: t.merchant_name,
    name: t.name,
    pfc_primary: t.pfc_primary,
    is_subscription: t.is_subscription,
  }));

  // Spend only (Plaid: positive amount = money out).
  const spend = all.filter((t) => t.amount > 0);

  const inRange = (d: string, start: DateTime, endExclusive: DateTime) => {
    const dt = DateTime.fromISO(d, { zone: ZONE });
    return dt >= start && dt < endExclusive;
  };

  const monthEndExclusive = now.plus({ days: 1 }).startOf('day');

  const mtd = spend.filter((t) => inRange(t.date, monthStart, monthEndExclusive));
  const food = (t: RawTxn) => t.pfc_primary === 'FOOD_AND_DRINK';

  const foodMtd = mtd.filter(food);
  const foodMtdTotal = round2(foodMtd.reduce((s, t) => s + t.amount, 0));

  const foodLastSame = spend.filter(
    (t) => food(t) && inRange(t.date, lastMonthStart, lastMonthSameEnd)
  );
  const foodLastFull = spend.filter(
    (t) => food(t) && inRange(t.date, lastMonthStart, monthStart)
  );

  const projectedMonth = dayOfMonth > 0 ? round2((foodMtdTotal / dayOfMonth) * now.daysInMonth!) : 0;

  // Average food spend on the current weekday over the trailing window.
  const todayWeekday = now.weekday; // 1..7
  const foodByDate = new Map<string, number>();
  for (const t of spend) {
    if (!food(t)) continue;
    const dt = DateTime.fromISO(t.date, { zone: ZONE });
    if (dt.weekday !== todayWeekday) continue;
    foodByDate.set(t.date, (foodByDate.get(t.date) || 0) + t.amount);
  }
  const dowValues = Array.from(foodByDate.values());
  const dayOfWeekAvg = dowValues.length
    ? round2(dowValues.reduce((s, v) => s + v, 0) / dowValues.length)
    : 0;

  // Top merchants this month.
  const merchantAgg = new Map<string, { count: number; total: number }>();
  for (const t of mtd) {
    const m = merchantOf(t);
    const cur = merchantAgg.get(m) || { count: 0, total: 0 };
    cur.count += 1;
    cur.total += t.amount;
    merchantAgg.set(m, cur);
  }
  const topMerchantsMTD = Array.from(merchantAgg.entries())
    .map(([merchant, v]) => ({ merchant, count: v.count, total: round2(v.total) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

  // Category breakdown this month.
  const catAgg = new Map<string, { count: number; total: number }>();
  for (const t of mtd) {
    const c = t.pfc_primary || 'OTHER';
    const cur = catAgg.get(c) || { count: 0, total: 0 };
    cur.count += 1;
    cur.total += t.amount;
    catAgg.set(c, cur);
  }
  const categoriesMTD = Array.from(catAgg.entries())
    .map(([category, v]) => ({
      category,
      total: round2(v.total),
      count: v.count,
      fixed: FIXED_CATEGORIES.has(category),
    }))
    .sort((a, b) => b.total - a.total);

  // Yesterday.
  const yEnd = yesterday.plus({ days: 1 });
  const yItems = spend
    .filter((t) => inRange(t.date, yesterday, yEnd))
    .map((t) => ({ merchant: merchantOf(t), amount: round2(t.amount), category: t.pfc_primary || 'OTHER' }))
    .sort((a, b) => b.amount - a.amount);
  const yTotal = round2(yItems.reduce((s, t) => s + t.amount, 0));

  // Subscriptions seen in the last ~35 days (deduped by merchant).
  const subStart = now.minus({ days: 35 }).startOf('day');
  const subAgg = new Map<string, number>();
  for (const t of spend) {
    if (!t.is_subscription) continue;
    if (!inRange(t.date, subStart, monthEndExclusive)) continue;
    const m = merchantOf(t);
    // Keep the most recent (largest seen) amount per merchant.
    subAgg.set(m, Math.max(subAgg.get(m) || 0, t.amount));
  }
  const subItems = Array.from(subAgg.entries())
    .map(([merchant, amount]) => ({ merchant, amount: round2(amount) }))
    .sort((a, b) => b.amount - a.amount);
  const subMonthlyTotal = round2(subItems.reduce((s, t) => s + t.amount, 0));

  return {
    today: now.toFormat('cccc, LLLL d'),
    dayName: now.toFormat('cccc'),
    dayOfMonth,
    daysInMonth: now.daysInMonth!,
    daysLeftInMonth: now.daysInMonth! - dayOfMonth,
    balance: { available, current },
    food: {
      mtdTotal: foodMtdTotal,
      mtdCount: foodMtd.length,
      lastMonthSamePeriod: round2(foodLastSame.reduce((s, t) => s + t.amount, 0)),
      lastMonthFull: round2(foodLastFull.reduce((s, t) => s + t.amount, 0)),
      projectedMonth,
      dayOfWeekAvg,
    },
    topMerchantsMTD,
    categoriesMTD,
    yesterday: { total: yTotal, items: yItems },
    subscriptions: { monthlyTotal: subMonthlyTotal, items: subItems },
  };
}

// The set of insight "angles" the morning text can take. Tracking which one
// was used lets us rotate day to day so the message doesn't get repetitive.
export const MORNING_ANGLES = [
  'merchant_frequency', // e.g. "you hit Publix 30x this month"
  'food_pace', // food spend vs last month / projected pace
  'yesterday_recap', // what they spent yesterday
  'day_of_week', // typical spend for today's weekday
  'category_spotlight', // a notable discretionary category
  'balance_context', // balance / runway framing
  'win', // positive reinforcement (under pace, no-spend, etc.)
] as const;

const SYSTEM_PROMPT = `You are Krezzo, a financial wellness coach who sends one short morning text each day.
Your goal: help the user spend less and build better money habits through awareness, not guilt.

Rules:
- Use ONLY the numbers in the data provided. NEVER invent or estimate figures not given.
- Choose exactly ONE "angle" for today from this list: ${MORNING_ANGLES.join(', ')}.
  Prefer an angle that is genuinely useful today AND is NOT in the "recentAngles" list provided, so the daily text stays fresh.
- Treat "fixed" categories (rent, loans, transfers, utilities) as non-discretionary; focus nudges on controllable spending (food, merchandise, entertainment).
- Tone: warm, specific, encouraging. Like a sharp friend, not a scold or a robot.
- End with ONE concrete action the user can take today.
- The SMS text must be plain text: max ~320 characters, no markdown, no links, at most 1-2 emoji. Round dollars sensibly.
- Respond with STRICT JSON only, no prose around it: {"angle":"<one angle key>","message":"<the sms text>"}`;

export interface ComposedMorningText {
  angle: string;
  message: string;
}

/**
 * Ask Claude to pick a fresh angle and write the morning text from the
 * deterministic stats. Throws on failure; callers fall back to deterministic.
 */
export async function composeMorningTextWithLLM(
  insights: MorningInsights,
  recentAngles: string[] = []
): Promise<ComposedMorningText> {
  const prompt = `Here is today's spending data for this user. Write their morning text.\n\nrecentAngles (avoid these if you can): ${JSON.stringify(
    recentAngles
  )}\n\ndata:\n${JSON.stringify(
    insights,
    null,
    2
  )}\n\nNotes on fields: amounts are USD. food.projectedMonth is their current pace for the full month; compare to food.lastMonthFull. food.dayOfWeekAvg is what they typically spend on food on a ${insights.dayName}. topMerchantsMTD shows frequency this month. yesterday lists what they actually spent yesterday.`;

  const raw = await generateText({
    system: SYSTEM_PROMPT,
    prompt,
    temperature: 0.8,
    maxTokens: 260,
  });

  // Tolerant JSON extraction (strip code fences / surrounding prose).
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed && typeof parsed.message === 'string' && parsed.message.trim().length >= 15) {
        return { angle: String(parsed.angle || 'unknown'), message: parsed.message.trim() };
      }
    } catch {
      // fall through
    }
  }
  // If the model didn't return valid JSON, treat the whole output as the message.
  return { angle: 'unknown', message: raw.trim() };
}

async function getRecentAngles(userId: string, limit = 4): Promise<string[]> {
  try {
    const { data } = await supabase
      .from('morning_text_history')
      .select('angle')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    return (data || []).map((r) => r.angle).filter((a): a is string => !!a);
  } catch {
    return [];
  }
}

async function recordMorningText(userId: string, angle: string, message: string): Promise<void> {
  try {
    await supabase.from('morning_text_history').insert({ user_id: userId, angle, message });
  } catch (error) {
    console.error('Failed to record morning_text_history (non-fatal):', error);
  }
}

/**
 * Deterministic fallback used when the LLM is unavailable. Picks the strongest
 * available signal and produces a concise, useful nudge.
 */
export function deterministicMorningText(insights: MorningInsights): string {
  const { food, dayName, topMerchantsMTD, yesterday } = insights;
  const dollars = (n: number) => `$${Math.round(n)}`;

  const lines: string[] = [`☀️ ${dayName} money check`];

  if (yesterday.items.length > 0) {
    const top = yesterday.items[0];
    lines.push(`Yesterday: ${dollars(yesterday.total)} across ${yesterday.items.length} buys (${top.merchant} ${dollars(top.amount)}).`);
  } else {
    lines.push(`Yesterday: no spending logged. Nice. 👏`);
  }

  if (food.mtdTotal > 0) {
    const pace = food.projectedMonth;
    const vs = food.lastMonthFull > 0 ? ` vs ${dollars(food.lastMonthFull)} last month` : '';
    lines.push(`Food in ${insights.today.split(',')[1]?.trim().split(' ')[0] || 'this month'}: ${dollars(food.mtdTotal)} (${insights.food.mtdCount} buys), on pace for ${dollars(pace)}${vs}.`);
  }

  const freq = topMerchantsMTD.find((m) => m.count >= 5);
  if (freq) {
    lines.push(`You've hit ${freq.merchant} ${freq.count}x this month. Skip one stop today.`);
  } else if (food.dayOfWeekAvg > 0) {
    lines.push(`You average ${dollars(food.dayOfWeekAvg)} on food ${dayName}s. Try to beat it.`);
  }

  return lines.join('\n');
}

/**
 * Top-level entry point for the morning text: gather stats, then compose with
 * Claude, falling back to deterministic copy on any failure.
 */
export async function generateMorningInsightText(userId: string): Promise<string | null> {
  const insights = await gatherMorningInsights(userId);
  if (!insights) return null;

  if (isLLMConfigured()) {
    try {
      const recentAngles = await getRecentAngles(userId);
      const composed = await composeMorningTextWithLLM(insights, recentAngles);
      if (composed.message && composed.message.length >= 15) {
        await recordMorningText(userId, composed.angle, composed.message);
        return composed.message;
      }
    } catch (error) {
      console.error('❌ LLM morning text failed, using deterministic fallback:', error);
    }
  }

  return deterministicMorningText(insights);
}
