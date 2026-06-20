/**
 * AI dinner-idea engine.
 *
 * Turns this week's real Publix BOGO deals into a handful of concrete, cheap dinner
 * ideas (entree + sides + a short recipe + rough cost). Results are cached per weekly
 * deal_post in the `dinner_plans` table so we generate once per week, not per request.
 *
 * Shared by the /bogo-dinner-plan page and the daily "Tonight's Dinner" SMS.
 */
import OpenAI from 'openai';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MODEL = 'gpt-4o';
const DINNER_COUNT = 7;

export interface DinnerIdea {
  title: string;
  cuisine: string;
  bogoItems: string[]; // BOGO products this dinner builds on
  pantryItems: string[]; // common staples assumed on hand
  steps: string[]; // 3-5 short cooking steps
  estCost: string; // e.g. "~$9 for 4 servings (everything's BOGO)"
  sms: string; // SMS-ready blurb, <= 280 chars
}

export interface DinnerPlan {
  weekOf: string;
  generatedAt: string;
  dinners: DinnerIdea[];
}

export interface DealInput {
  title: string;
  price_text: string | null;
}

function serviceClient(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function generateDinnerPlan(deals: DealInput[], weekLabel: string): Promise<DinnerPlan> {
  const dealList = deals
    .slice(0, 180)
    .map((d) => `- ${d.title}${d.price_text ? ` (${d.price_text})` : ''}`)
    .join('\n');

  const prompt = `You are a thrifty home-cook helping a family solve "what's for dinner" using this week's Publix BOGO (buy-one-get-one-free) deals.

This week's Publix BOGO items (${weekLabel}):
${dealList}

Create ${DINNER_COUNT} realistic, family-friendly dinner ideas. Rules:
- Each dinner must build on 2-4 of the BOGO items above (use the exact product wording from the list in bogoItems).
- Favor complete meals: an entree plus a side or two.
- Assume common pantry staples (oil, salt, pepper, basic spices, onion, garlic, rice/pasta if not on sale) — list those in pantryItems.
- Keep recipes simple: 3-5 short steps a busy parent can follow.
- estCost: a rough, honest estimate for the meal, noting BOGO savings.
- sms: a punchy one-line text (max 280 chars) pitching tonight's dinner + the key BOGO items. No markdown, no links.
- Vary cuisines across the ${DINNER_COUNT} dinners.

Return ONLY valid JSON in this exact shape:
{"dinners":[{"title":"","cuisine":"","bogoItems":[""],"pantryItems":[""],"steps":[""],"estCost":"","sms":""}]}`;

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: 'You are a practical, budget-focused meal planner. Always return valid JSON.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
    response_format: { type: 'json_object' },
  });

  const raw = response.choices[0]?.message?.content || '{}';
  const parsed = JSON.parse(raw) as { dinners?: DinnerIdea[] };
  const dinners = Array.isArray(parsed.dinners) ? parsed.dinners.slice(0, DINNER_COUNT) : [];

  return { weekOf: weekLabel, generatedAt: new Date().toISOString(), dinners };
}

/**
 * Read the cached plan for a post, or generate + cache it.
 * Reads can use any client; generation writes use the service role.
 */
export async function getOrGenerateDinnerPlan(opts: {
  postId: number;
  deals: DealInput[];
  weekLabel: string;
  force?: boolean;
  readClient?: SupabaseClient;
}): Promise<DinnerPlan> {
  const reader = opts.readClient || serviceClient();

  if (!opts.force) {
    const { data: cached } = await reader
      .from('dinner_plans')
      .select('plan_json')
      .eq('post_id', opts.postId)
      .maybeSingle();
    if (cached?.plan_json) return cached.plan_json as DinnerPlan;
  }

  const plan = await generateDinnerPlan(opts.deals, opts.weekLabel);

  const writer = serviceClient();
  await writer
    .from('dinner_plans')
    .upsert({ post_id: opts.postId, plan_json: plan, model: MODEL }, { onConflict: 'post_id' });

  return plan;
}

/** Pick a dinner for "tonight" — rotates deterministically by day so it varies daily. */
export function pickTonightsDinner(plan: DinnerPlan, date = new Date()): DinnerIdea | null {
  if (!plan.dinners.length) return null;
  const dayIndex = Math.floor(date.getTime() / 86_400_000);
  return plan.dinners[dayIndex % plan.dinners.length];
}
