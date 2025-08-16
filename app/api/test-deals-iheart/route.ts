import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'KrezzoDealsBot/1.0 (+contact)'
    }
  });
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${url}`);
  return res.text();
}

function extractPostLinks(categoryHtml: string): string[] {
  const linkRegex = /<a[^>]+href="(https?:\/\/www\.iheartpublix\.com\/[^"]+)"[^>]*>([^<]+)<\/a>/gi;
  const urls = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(categoryHtml))) {
    const href = match[1];
    const linkText = match[2] || '';
    // Skip the category index itself
    if (href.includes('/category/weekly-ad/')) continue;
    const looksLikeWeeklyAdPost =
      /publix-ad/i.test(href) ||
      /weekly-ad/i.test(href) ||
      /week-?of/i.test(href) ||
      /Publix Ad|Coupons Week Of|Week Of|Sneak Peek/i.test(linkText);
    if (looksLikeWeeklyAdPost) {
      urls.add(href.split('#')[0]);
    }
  }
  return [...urls];
}

function stripNoise(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ');
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return null;
  return m[1].replace(/\s+/g, ' ').trim();
}

function extractDealsFromPost(html: string): string[] {
  const clean = stripNoise(html);
  const items: string[] = [];
  const patterns = [/BOGO/i, /B\.O\.G\.O/i, /\b2\s+for\b/i, /\$\d/, /\d+¢/];

  // Primary: list items
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let match: RegExpExecArray | null;
  while ((match = liRegex.exec(clean))) {
    const text = match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (text && patterns.some((re) => re.test(text))) items.push(text);
  }

  // Fallback: paragraphs
  if (items.length === 0) {
    const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    while ((match = pRegex.exec(clean))) {
      const text = match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (text && patterns.some((re) => re.test(text))) items.push(text);
    }
  }

  return items;
}

export async function GET() {
  try {
    const categoryUrl = 'https://www.iheartpublix.com/category/weekly-ad/';
    const listing = await fetchText(categoryUrl);
    const postUrls = extractPostLinks(listing).slice(0, 8);

    const previews: Array<{ url: string; title: string | null; sampleCount: number; sample: string[]; total: number }> = [];
    const postsHtml: Record<string, string> = {};
    const postsDeals: Record<string, string[]> = {};

    for (const url of postUrls) {
      const html = await fetchText(url);
      postsHtml[url] = html;
      const deals = extractDealsFromPost(html);
      postsDeals[url] = deals;
      previews.push({ url, title: extractTitle(html), sampleCount: Math.min(deals.length, 50), sample: deals.slice(0, 50), total: deals.length });
      // Polite delay to avoid hammering the site
      await new Promise((r) => setTimeout(r, 800));
    }

    // Auto-save the first post that has meaningful deals (direct DB upsert)
    type SaveResult = { success?: true; post_id?: number; inserted?: number; error?: string } | null;
    let saveResult: SaveResult = null;
    const candidate = previews.find((p) => p.total >= 5) || previews[0];
    if (candidate) {
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        // Upsert post
        const { data: postData, error: postErr } = await supabase
          .from('deal_posts')
          .upsert({ url: candidate.url, title: candidate.title }, { onConflict: 'url' })
          .select('id')
          .single();
        if (postErr || !postData) {
          saveResult = { error: postErr?.message || 'post upsert failed' };
        } else {
          const postId = postData.id as number;
          const allLines = postsDeals[candidate.url] || [];
          const rows = allLines.map((ln) => ({ post_id: postId, store: 'Publix', title: ln, brand: null, size: null, promo_type: /BOGO|B\.O\.G\.O|\b2\s+for\b/i.test(ln) ? (ln.match(/BOGO|B\.O\.G\.O|\b2\s+for\b/i)?.[0] || null) : null, price_text: (ln.match(/\$\d+[\.,]?\d*/) || [null])[0], unit_price_cents: null }));
          const { error: dealsErr } = await supabase.from('deals').upsert(rows, { onConflict: 'post_id,title,price_text' });
          saveResult = dealsErr ? { error: dealsErr.message } : { success: true, post_id: postId, inserted: rows.length };
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'save failed';
        saveResult = { error: msg };
      }
    }

    return NextResponse.json({
      source: 'iHeartPublix Weekly Ad',
      categoryUrl,
      discovered: postUrls.length,
      posts: previews,
      storage: {
        auto_saved: saveResult,
        schema: {
          deal_posts: ['id', 'url', 'title', 'published_at', 'created_at'],
          deals: ['id', 'post_id', 'store', 'title', 'brand', 'size', 'promo_type', 'price_text', 'unit_price_cents', 'starts_at', 'ends_at', 'created_at']
        }
      },
      timestamp: new Date().toISOString(),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'unknown';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


