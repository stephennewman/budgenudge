import { NextRequest, NextResponse } from "next/server";

// Lightweight RSS headline fetcher. The feed is configurable via the
// MIRROR_NEWS_FEED env var (or a ?feed= override); defaults to NPR top stories.
export const revalidate = 600; // 10 minutes

const DEFAULT_FEED = "https://feeds.npr.org/1001/rss.xml";
const HEADLINES_SHOWN = 3;

// Category feeds for the Today channel's sectioned view (?sections=1).
// NPR topic feeds are free and keyless; ESPN covers sports.
const CATEGORY_FEEDS: { id: string; label: string; feed: string }[] = [
  { id: "top", label: "Top Stories", feed: "https://feeds.npr.org/1001/rss.xml" },
  { id: "politics", label: "Politics", feed: "https://feeds.npr.org/1014/rss.xml" },
  { id: "business", label: "Business", feed: "https://feeds.npr.org/1006/rss.xml" },
  { id: "technology", label: "Technology", feed: "https://feeds.npr.org/1019/rss.xml" },
  { id: "science", label: "Science", feed: "https://feeds.npr.org/1007/rss.xml" },
  { id: "culture", label: "Culture", feed: "https://feeds.npr.org/1008/rss.xml" },
  { id: "sports", label: "Sports", feed: "https://www.espn.com/espn/rss/news" },
];

// NPR/ESPN feeds mix in shows, roundups, and newsletters — those aren't
// glanceable "top stories" for a wall display.
const SKIP_HEADLINE =
  /\b(consider this|npr news now|up first|podcast|newsletter|your weekly|week in|listener|from npr's|news brief|morning edition|all things considered|the sunday story)\b/i;
const SKIP_URL = /up-first|newsletter|consider-this|npr-news-now|\/podcast/i;
// NPR often glues two stories into one briefing headline.
const SKIP_ROUNDUP = /\.\s+And,/;

type NewsItem = { title: string; link: string | null };

function decode(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#8217;|&rsquo;/g, "\u2019")
    .replace(/&#8216;|&lsquo;/g, "\u2018")
    .replace(/&#8211;|&ndash;/g, "\u2013")
    .replace(/&#8212;|&mdash;/g, "\u2014")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function extract(block: string, tag: string): string | null {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? decode(m[1]) : null;
}

function extractLink(block: string): string | null {
  const link = extract(block, "link");
  if (link && /^https?:\/\//i.test(link)) return link;
  const guid = extract(block, "guid");
  if (guid && /^https?:\/\//i.test(guid)) return guid;
  return link;
}

async function fetchFeed(
  feed: string,
  limit: number
): Promise<{ items: NewsItem[]; source: string | null }> {
  try {
    const res = await fetch(feed, {
      next: { revalidate },
      headers: { "User-Agent": "Mozilla/5.0 (MirrorDashboard)" },
    });
    if (!res.ok) return { items: [], source: null };

    const xml = await res.text();
    const channelTitle = extract(xml.split("<item")[0] ?? "", "title");

    const items: NewsItem[] = [];
    const itemRegex = /<item[\s\S]*?<\/item>/gi;
    let match: RegExpExecArray | null;
    while ((match = itemRegex.exec(xml)) && items.length < limit) {
      const block = match[0];
      const title = extract(block, "title");
      if (!title || SKIP_HEADLINE.test(title) || SKIP_ROUNDUP.test(title)) {
        continue;
      }
      const link = extractLink(block);
      if (link && SKIP_URL.test(link)) continue;
      items.push({
        title,
        link,
      });
    }
    return { items, source: channelTitle };
  } catch {
    return { items: [], source: null };
  }
}

// NPR's Top Stories feed is already editorially ranked. After dropping
// briefs/newsletters, the first items are the day's most newsworthy.
// If that feed is thin, fill from other sections in category order.
function rankHeadlines(results: { items: NewsItem[] }[]): NewsItem[] {
  const topIdx = CATEGORY_FEEDS.findIndex((c) => c.id === "top");
  const picked: NewsItem[] = [...(results[topIdx]?.items ?? [])];
  const seen = new Set(picked.map((it) => it.title.toLowerCase()));

  for (let i = 0; i < results.length && picked.length < HEADLINES_SHOWN; i++) {
    if (i === topIdx) continue;
    for (const it of results[i]?.items ?? []) {
      const key = it.title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      picked.push(it);
      if (picked.length >= HEADLINES_SHOWN) break;
    }
  }

  return picked.slice(0, HEADLINES_SHOWN);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // Sectioned mode: one call returns ranked top headlines plus the
  // category groups (used as a fallback if ranking is empty).
  if (searchParams.get("sections")) {
    const results = await Promise.all(
      CATEGORY_FEEDS.map((c) => fetchFeed(c.feed, 12))
    );
    const headlines = rankHeadlines(results);

    // NPR's topic feeds overlap (a politics story is often also a top story);
    // keep each headline in the first section it appears in.
    const seen = new Set<string>();
    const sections = CATEGORY_FEEDS.map((c, i) => {
      const items = results[i].items
        .filter((it) => {
          const key = it.title.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, 5);
      return { id: c.id, label: c.label, items };
    }).filter((s) => s.items.length > 0);
    return NextResponse.json({ headlines, sections });
  }

  const feed =
    searchParams.get("feed") || process.env.MIRROR_NEWS_FEED || DEFAULT_FEED;
  const { items, source } = await fetchFeed(feed, 6);
  return NextResponse.json({ items, source });
}
