import { NextRequest, NextResponse } from "next/server";

// Lightweight RSS headline fetcher. The feed is configurable via the
// MIRROR_NEWS_FEED env var (or a ?feed= override); defaults to NPR top stories.
export const revalidate = 600; // 10 minutes

const DEFAULT_FEED = "https://feeds.npr.org/1001/rss.xml";

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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const feed =
    searchParams.get("feed") || process.env.MIRROR_NEWS_FEED || DEFAULT_FEED;

  try {
    const res = await fetch(feed, {
      next: { revalidate },
      headers: { "User-Agent": "Mozilla/5.0 (MirrorDashboard)" },
    });

    if (!res.ok) {
      return NextResponse.json({ items: [], source: null });
    }

    const xml = await res.text();
    const channelTitle = extract(xml.split("<item")[0] ?? "", "title");

    const items: { title: string; link: string | null }[] = [];
    const itemRegex = /<item[\s\S]*?<\/item>/gi;
    let match: RegExpExecArray | null;
    while ((match = itemRegex.exec(xml)) && items.length < 6) {
      const block = match[0];
      const title = extract(block, "title");
      const link = extract(block, "link");
      if (title) items.push({ title, link });
    }

    return NextResponse.json({ items, source: channelTitle });
  } catch {
    return NextResponse.json({ items: [], source: null });
  }
}
