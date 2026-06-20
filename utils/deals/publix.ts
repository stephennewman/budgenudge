/**
 * Publix weekly-ad BOGO ingestion.
 *
 * Strategy (mirrors the contextmemo "sitehop" approach): the Publix weekly ad is a
 * JS-rendered SPA, so a plain fetch returns no deal text. We route the page through
 * Jina Reader (r.jina.ai), which renders the page and returns clean markdown. The
 * markdown is highly structured, so we parse it with simple line rules rather than AI.
 *
 * Note on store specificity: Jina renders the page without a selected store, so it
 * shows Publix's chain-wide BOGO list. Publix BOGOs are run nearly identically across
 * the chain each week, so this is acceptable for now. PUBLIX_WEEKLY_AD_URL can be
 * overridden if a store-scoped URL is needed later.
 */

export interface ParsedDeal {
  title: string;
  promo_type: 'BOGO';
  price_text: string | null; // e.g. "Save Up To $6.19"
  starts_at: string | null; // ISO date (YYYY-MM-DD)
  ends_at: string | null; // ISO date (YYYY-MM-DD)
}

const DEFAULT_WEEKLY_AD_URL = 'https://www.publix.com/savings/weekly-ad/all';

export function getWeeklyAdUrl(): string {
  return process.env.PUBLIX_WEEKLY_AD_URL || DEFAULT_WEEKLY_AD_URL;
}

/**
 * Fetch a URL as markdown via Jina Reader. Honors JINA_API_KEY when present
 * (higher rate limit / reliability) but works on the free tier without it.
 */
export async function fetchAsMarkdown(url: string): Promise<string> {
  const jinaUrl = `https://r.jina.ai/${url}`;
  // X-No-Cache forces Jina to re-render the live page instead of serving a cached
  // copy — critical so the daily pull reflects Publix's newest weekly ad, not last
  // week's. X-Return-Format=text keeps the response lean.
  const headers: Record<string, string> = {
    Accept: 'text/plain',
    'X-No-Cache': 'true',
    'X-Return-Format': 'text',
  };
  if (process.env.JINA_API_KEY) {
    headers.Authorization = `Bearer ${process.env.JINA_API_KEY}`;
  }

  const res = await fetch(jinaUrl, {
    method: 'GET',
    headers,
    signal: AbortSignal.timeout(70_000),
  });

  if (!res.ok) {
    throw new Error(`Jina Reader error: ${res.status} ${res.statusText}`);
  }
  return res.text();
}

const MONTHS_PER_YEAR = 12;

/** Parse "6/17 - 6/23" into ISO start/end dates, handling year rollover. */
function parseValidDates(line: string): { starts_at: string | null; ends_at: string | null } {
  const m = line.match(/(\d{1,2})\/(\d{1,2})\s*[-–]\s*(\d{1,2})\/(\d{1,2})/);
  if (!m) return { starts_at: null, ends_at: null };

  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const startMonth = parseInt(m[1], 10);
  const startDay = parseInt(m[2], 10);
  const endMonth = parseInt(m[3], 10);
  const endDay = parseInt(m[4], 10);

  let startYear = currentYear;
  let endYear = currentYear;

  // If we're in December but the ad starts in January, it's next year.
  if (now.getUTCMonth() + 1 === MONTHS_PER_YEAR && startMonth === 1) {
    startYear += 1;
    endYear += 1;
  }
  // Promo window crosses the new year (e.g. 12/30 - 1/5).
  if (endMonth < startMonth) endYear = startYear + 1;

  const iso = (y: number, mo: number, d: number) =>
    `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  return { starts_at: iso(startYear, startMonth, startDay), ends_at: iso(endYear, endMonth, endDay) };
}

const BOGO_LINE = /^buy 1 get 1( free)?$/i;
const SAVE_LINE = /^save up to \$/i;
const VALID_LINE = /^valid\s+\d/i;
const END_LINE = /^add to list$/i;

/** Lines that are clearly chrome/nav, not product titles. */
function isNoiseTitle(title: string): boolean {
  if (!title) return true;
  if (title.length < 2 || title.length > 90) return true;
  const noise = [
    'results', 'filters', 'view the weekly ad', 'go to image', 'add to list',
    'bogo', 'match day', 'protein', 'fiber', 'order now', 'shopping list',
  ];
  const t = title.toLowerCase();
  return noise.some((n) => t === n || t.startsWith(n));
}

/**
 * Parse the Jina markdown of the Publix weekly ad into BOGO deals.
 *
 * Each deal block looks like:
 *   <Product Title>
 *   Buy 1 Get 1 Free
 *   of equal or lesser price       (optional)
 *   Save Up To $X.XX               (optional)
 *   Valid 6/17 - 6/23
 *   Add to list
 */
export function parsePublixBogos(markdown: string): ParsedDeal[] {
  const lines = markdown
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const deals: ParsedDeal[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    if (!BOGO_LINE.test(lines[i])) continue;

    // Title is the nearest preceding non-noise line.
    let title = '';
    for (let j = i - 1; j >= 0 && j >= i - 3; j--) {
      if (!isNoiseTitle(lines[j]) && !BOGO_LINE.test(lines[j])) {
        title = lines[j];
        break;
      }
    }
    if (isNoiseTitle(title)) continue;

    // Scan forward for savings + valid dates until the block ends.
    let priceText: string | null = null;
    let validLine: string | null = null;
    for (let k = i + 1; k < lines.length && k <= i + 6; k++) {
      if (END_LINE.test(lines[k]) || BOGO_LINE.test(lines[k])) break;
      if (SAVE_LINE.test(lines[k])) priceText = lines[k];
      else if (VALID_LINE.test(lines[k])) validLine = lines[k];
    }

    const dedupeKey = title.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const { starts_at, ends_at } = validLine
      ? parseValidDates(validLine)
      : { starts_at: null, ends_at: null };

    deals.push({ title, promo_type: 'BOGO', price_text: priceText, starts_at, ends_at });
  }

  return deals;
}

export async function fetchPublixBogos(): Promise<{ url: string; deals: ParsedDeal[] }> {
  const url = getWeeklyAdUrl();
  const markdown = await fetchAsMarkdown(url);
  const deals = parsePublixBogos(markdown);
  return { url, deals };
}
