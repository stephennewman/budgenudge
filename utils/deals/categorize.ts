/**
 * AI food-type categorization for Publix BOGO deals.
 *
 * Runs once per weekly ingest (publix-deals cron) and persists to the
 * deals.category column, so read paths (the mirror) never call OpenAI.
 */
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Full gpt-4o: runs once per weekly ingest, and the mini model misclassified
// too many items (accuracy matters more than the pennies saved).
const MODEL = 'gpt-4o';

export const DEAL_CATEGORIES = [
  'Entrées & Meat',
  'Sides & Pantry',
  'Breakfast & Bakery',
  'Dairy & Cheese',
  'Snacks & Sweets',
  'Beverages',
  'Everything Else',
] as const;

export type DealCategory = (typeof DEAL_CATEGORIES)[number];

const FALLBACK: DealCategory = 'Everything Else';

function normalize(value: unknown): DealCategory {
  return DEAL_CATEGORIES.includes(value as DealCategory)
    ? (value as DealCategory)
    : FALLBACK;
}

// A full weekly ad is ~230 items; one call for all of them overruns the
// model's output limit and truncates the JSON. Chunk to stay well under it.
const CHUNK_SIZE = 60;

/**
 * Categorize deal titles. Returns categories aligned by index with the input.
 * Throws on API failure — callers decide whether categorization is best-effort.
 */
export async function categorizeDeals(titles: string[]): Promise<DealCategory[]> {
  const results: DealCategory[] = [];
  for (let i = 0; i < titles.length; i += CHUNK_SIZE) {
    const chunk = titles.slice(i, i + CHUNK_SIZE);
    try {
      results.push(...(await categorizeChunk(chunk)));
    } catch {
      // The model occasionally emits malformed/runaway JSON; one retry
      // resolves it in practice.
      results.push(...(await categorizeChunk(chunk)));
    }
  }
  return results;
}

async function categorizeChunk(titles: string[]): Promise<DealCategory[]> {
  if (titles.length === 0) return [];

  const list = titles.map((t, i) => `${i}. ${t}`).join('\n');
  const prompt = `Categorize each grocery product below into exactly one of these categories:
${DEAL_CATEGORIES.map((c) => `- ${c}`).join('\n')}

Guidance:
- "Entrées & Meat": meats, seafood, and items that are the main dish of a meal (frozen entrées, pizza, lasagna).
- "Sides & Pantry": pasta, rice, sauces, canned goods, condiments, pickles, dressings, vegetables, salads.
- "Breakfast & Bakery": cereal, breakfast foods, bread, bagels, baked goods.
- "Dairy & Cheese": cheese, yogurt, milk, butter, eggs.
- "Snacks & Sweets": chips, crackers, cookies, candy, ice cream, desserts.
- "Beverages": all drinks.
- "Everything Else": non-food items (household, personal care, pet) or anything that doesn't fit.
Be accurate about what the product actually is — e.g. dill pickles are a pantry condiment, not an entrée.

Products:
${list}

Return ONLY valid JSON in this shape, one entry per product, keyed by the product's number so nothing shifts out of order:
{"items":[{"i":0,"category":"..."},{"i":1,"category":"..."}]}`;

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: 'You are a precise grocery product classifier. Always return valid JSON.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0,
    response_format: { type: 'json_object' },
  });

  const raw = response.choices[0]?.message?.content || '{}';
  const parsed = JSON.parse(raw) as { items?: Array<{ i?: unknown; category?: unknown }> };
  const byIndex = new Map<number, DealCategory>();
  for (const item of parsed.items ?? []) {
    if (typeof item?.i === 'number') byIndex.set(item.i, normalize(item.category));
  }

  return titles.map((_, i) => byIndex.get(i) ?? FALLBACK);
}
