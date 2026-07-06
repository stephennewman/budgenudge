import { NextRequest, NextResponse } from "next/server";

// Readable article text for the Today channel's slide-out reader. Fetches the
// story server-side and extracts paragraph text. Host-allowlisted to the news
// sources we actually surface, so this can't be used as an open proxy.
export const revalidate = 3600; // 1 hour

const ALLOWED_HOSTS = [/(^|\.)npr\.org$/, /(^|\.)espn\.com$/];

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#8217;|&rsquo;/g, "\u2019")
    .replace(/&#8216;|&lsquo;/g, "\u2018")
    .replace(/&#8220;|&ldquo;/g, "\u201c")
    .replace(/&#8221;|&rdquo;/g, "\u201d")
    .replace(/&#8211;|&ndash;/g, "\u2013")
    .replace(/&#8212;|&mdash;/g, "\u2014")
    .replace(/&nbsp;/g, " ")
    .replace(/&#\d+;/g, "")
    .trim();
}

function stripNonContent(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");
}

function paragraphsFrom(block: string): string[] {
  const out: string[] = [];
  const regex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(block))) {
    const text = decodeEntities(m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));
    // Skip boilerplate: short fragments, video-player captions ("play… (2:09)"),
    // and nav-ish lines that sneak into <article>.
    if (text.length < 60) continue;
    if (/^play\b.*\(\d+:\d+\)$/i.test(text)) continue;
    out.push(text);
    if (out.length >= 40) break;
  }
  return out;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("url");
  if (!raw) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }
  if (
    url.protocol !== "https:" ||
    !ALLOWED_HOSTS.some((re) => re.test(url.hostname))
  ) {
    return NextResponse.json({ error: "Host not allowed" }, { status: 400 });
  }

  try {
    const res = await fetch(url.toString(), {
      next: { revalidate },
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (MirrorDashboard)" },
    });
    if (!res.ok) {
      return NextResponse.json({ title: null, paragraphs: [] });
    }
    const html = stripNonContent(await res.text());

    const ogTitle =
      html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]*)"/i)?.[1] ??
      html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ??
      null;

    // Prefer paragraphs inside <article>; some sites (ESPN) render the body
    // elsewhere, so fall back to the whole document.
    const articleBlock = html.match(/<article[\s\S]*?<\/article>/i)?.[0];
    let paragraphs = articleBlock ? paragraphsFrom(articleBlock) : [];
    if (paragraphs.length < 3) paragraphs = paragraphsFrom(html);

    return NextResponse.json({
      title: ogTitle ? decodeEntities(ogTitle) : null,
      paragraphs,
    });
  } catch {
    return NextResponse.json({ title: null, paragraphs: [] });
  }
}
