import { NextRequest, NextResponse } from "next/server";

// "Today" page data: fun national days (Checkiday), plus Wikipedia's
// on-this-day feed (curated historical events, holidays/observances, and
// notable birthdays). All sources are free and keyless. Cached for 6 hours —
// the content only changes once a day.
export const revalidate = 21600;

const WIKI_BASE = "https://en.wikipedia.org/api/rest_v1/feed/onthisday";
const UA = "Mozilla/5.0 (MirrorDashboard)";

export type NationalDay = { name: string; url: string | null };
export type HistoryItem = {
  year: number;
  text: string;
  thumbnail: string | null;
  url: string | null;
};
export type BirthItem = {
  year: number;
  name: string;
  description: string | null;
  thumbnail: string | null;
  url: string | null;
};
export type HolidayItem = { text: string; url: string | null };

type WikiPage = {
  titles?: { normalized?: string };
  description?: string;
  thumbnail?: { source?: string };
  content_urls?: { desktop?: { page?: string } };
};

type WikiEntry = { year?: number; text?: string; pages?: WikiPage[] };

function pageMeta(pages: WikiPage[] | undefined) {
  const p = pages?.[0];
  return {
    thumbnail: p?.thumbnail?.source ?? null,
    url: p?.content_urls?.desktop?.page ?? null,
  };
}

async function getNationalDays(date: Date): Promise<NationalDay[]> {
  const d = `${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${String(date.getUTCDate()).padStart(2, "0")}`;
  try {
    const res = await fetch(`https://www.checkiday.com/api/3/?d=${d}`, {
      next: { revalidate },
      headers: { "User-Agent": UA },
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data?.holidays)) return [];
    return data.holidays
      .filter((h: { name?: string }) => h?.name)
      .map((h: { name: string; url?: string }) => ({
        name: h.name,
        url: h.url ?? null,
      }));
  } catch {
    return [];
  }
}

async function getWiki(kind: "selected" | "births" | "holidays", date: Date) {
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  try {
    const res = await fetch(`${WIKI_BASE}/${kind}/${mm}/${dd}`, {
      next: { revalidate },
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  // The client passes its local calendar date so the server's timezone never
  // shifts the day. Falls back to server "now" (UTC).
  const dateParam = searchParams.get("date"); // YYYY-MM-DD
  const date =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? new Date(`${dateParam}T12:00:00Z`)
      : new Date();

  const [nationalDays, selected, births, holidays] = await Promise.all([
    getNationalDays(date),
    getWiki("selected", date),
    getWiki("births", date),
    getWiki("holidays", date),
  ]);

  const history: HistoryItem[] = ((selected?.selected ?? []) as WikiEntry[])
    .filter((e) => typeof e.year === "number" && e.text)
    .map((e) => ({
      year: e.year as number,
      text: e.text as string,
      ...pageMeta(e.pages),
    }))
    .sort((a, b) => b.year - a.year)
    .slice(0, 12);

  const birthList: BirthItem[] = ((births?.births ?? []) as WikiEntry[])
    .filter((e) => typeof e.year === "number" && e.text)
    // Recent first — recognizable names tend to be from the last ~150 years.
    .sort((a, b) => (b.year as number) - (a.year as number))
    .slice(0, 10)
    .map((e) => {
      // Wiki text embeds the description ("Zion Williamson, American
      // basketball player") — split so the UI can style them separately.
      const text = e.text as string;
      const comma = text.indexOf(",");
      const name = comma > 0 ? text.slice(0, comma).trim() : text;
      const rest = comma > 0 ? text.slice(comma + 1).trim() : null;
      return {
        year: e.year as number,
        name,
        description: e.pages?.[0]?.description ?? rest,
        ...pageMeta(e.pages),
      };
    });

  const holidayList: HolidayItem[] = ((holidays?.holidays ?? []) as WikiEntry[])
    .filter((e) => e.text)
    .slice(0, 8)
    .map((e) => ({ text: e.text as string, url: pageMeta(e.pages).url }));

  return NextResponse.json({
    nationalDays,
    history,
    births: birthList,
    holidays: holidayList,
  });
}
