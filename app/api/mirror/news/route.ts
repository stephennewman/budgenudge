import { NextRequest, NextResponse } from "next/server";

// Lightweight RSS headline fetcher. The feed is configurable via the
// MIRROR_NEWS_FEED env var (or a ?feed= override); defaults to NPR top stories.
export const revalidate = 600; // 10 minutes

const DEFAULT_FEED = "https://feeds.npr.org/1001/rss.xml";

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

async function fetchFeed(
  feed: string,
  limit: number
): Promise<{ items: { title: string; link: string | null }[]; source: string | null }> {
  try {
    const res = await fetch(feed, {
      next: { revalidate },
      headers: { "User-Agent": "Mozilla/5.0 (MirrorDashboard)" },
    });
    if (!res.ok) return { items: [], source: null };

    const xml = await res.text();
    const channelTitle = extract(xml.split("<item")[0] ?? "", "title");

    const items: { title: string; link: string | null }[] = [];
    const itemRegex = /<item[\s\S]*?<\/item>/gi;
    let match: RegExpExecArray | null;
    while ((match = itemRegex.exec(xml)) && items.length < limit) {
      const block = match[0];
      const title = extract(block, "title");
      const link = extract(block, "link");
      if (title) items.push({ title, link });
    }
    return { items, source: channelTitle };
  } catch {
    return { items: [], source: null };
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // Sectioned mode: one call returns headlines grouped by category.
  if (searchParams.get("sections")) {
    const results = await Promise.all(
      CATEGORY_FEEDS.map((c) => fetchFeed(c.feed, 8))
    );
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
    return NextResponse.json({ sections });
  }

  const feed =
    searchParams.get("feed") || process.env.MIRROR_NEWS_FEED || DEFAULT_FEED;
  const { items, source } = await fetchFeed(feed, 6);
  return NextResponse.json({ items, source });
}
