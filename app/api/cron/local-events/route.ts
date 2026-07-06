import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

// Weekly "Around Town" generator for the mirror dashboard.
//
// The Ticketmaster card covers ticketed events; this fills the hyperlocal gap
// (community events, markets, recurring restaurant/bar specials) that no
// structured API has. Runs once a week: an OpenAI web-search call gathers
// what's happening in the Palm Harbor area over the next 7 days, the model
// returns strict JSON, and we cache it in mirror_local_events. The public
// mirror only ever reads the cache — it never triggers a generation.
export const maxDuration = 180;

const MODEL = "gpt-4o";

// Roughly a 25-mile ring around Palm Harbor, ordered closest-first — the
// prompt tells the model to prioritize in this order when space is limited.
// Venues whose calendars aren't (fully) on Ticketmaster. A second web-search
// pass reads each venue's own calendar and extracts every show. Add entries
// here to watch more venues.
const VENUE_WATCHLIST: {
  name: string;
  url: string;
  town: string;
  // For venues whose own sites block crawlers, tell the model where else to look.
  hint?: string;
}[] = [
  { name: "Jannus Live", url: "jannuslive.com/calendar", town: "St. Petersburg" },
  {
    name: "Straz Center",
    url: "strazcenter.org",
    town: "Tampa",
    hint: "their site blocks crawlers — use visittampabay.com, cltampa.com, broadwayworld.com Tampa, or ticket listings instead",
  },
  // Ruth Eckerd Hall ticketing (not on Ticketmaster) runs three Clearwater venues.
  { name: "Ruth Eckerd Hall", url: "rutheckerdhall.com/events", town: "Clearwater" },
  {
    name: "The Sound at Coachman Park",
    url: "rutheckerdhall.com/events",
    town: "Clearwater",
    hint: "listed on rutheckerdhall.com — filter for The Sound / Coachman Park shows",
  },
  {
    name: "Capitol Theatre",
    url: "rutheckerdhall.com/events",
    town: "Clearwater",
    hint: "listed on rutheckerdhall.com — filter for Capitol Theatre shows",
  },
  { name: "Tampa Theatre", url: "tampatheatre.org/events", town: "Tampa" },
  { name: "The Palladium", url: "mypalladium.org", town: "St. Petersburg" },
];

const TOWNS =
  "Palm Harbor, Ozona, Crystal Beach, Dunedin, Tarpon Springs, Safety Harbor, East Lake, Oldsmar, Clearwater, Clearwater Beach, Largo, Trinity, New Port Richey, Odessa, Westchase, Indian Rocks Beach, Seminole, Dunedin Causeway/Honeymoon Island, St. Petersburg, and Tampa";

export type LocalItem = {
  title: string;
  date: string | null; // YYYY-MM-DD for one-off events
  schedule: string | null; // e.g. "Tuesdays" for recurring specials
  time: string | null; // e.g. "5-9 PM"
  venue: string | null;
  town: string | null;
  kind: "event" | "special";
  source: string | null; // domain the model cited, e.g. "patch.com"
};

function buildPrompt(today: Date): string {
  const end = new Date(today.getTime() + 14 * 86_400_000);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  return `Search the web for LOCAL, small-scale things happening in ${TOWNS} (Florida, Pinellas County area) between ${fmt(today)} and ${fmt(end)}.

I want the hyperlocal layer that big ticketing sites miss:
- community events: festivals, markets, parades, car shows, art walks, library or park events, church or school fairs
- live music at local bars and restaurants (not arena concerts)
- restaurant and bar deals: weekly specials (trivia nights, burger/wing/taco nights), BOGO food or drink deals, kids-eat-free nights, happy hours with real food deals, brunch or lunch specials

Good places to look besides general search: community calendar sites (Patch local calendars, palmharborhappenings.com, city parks & rec pages, chamber of commerce and downtown merchant association calendars) and the restaurants' own sites/menus for specials.

Rules:
- Only include things you actually found via search. Do NOT invent events, venues, times, or specials.
- Skip anything from Ticketmaster (arena/stadium concerts and pro sports are covered elsewhere).
- The town list is ordered closest-first from Palm Harbor; when space is limited, prefer the closer towns. St. Petersburg and Tampa items should only make the cut if they're notable (big festivals, markets, free community events).
- Stick to the towns listed above (or immediately adjacent to them).
- At most 2 items from any single venue — spread coverage across the area, don't dump one venue's whole calendar.
- Up to 25 one-off events and up to 12 recurring specials/deals.
- For specials, only include deals you can attribute to a specific named restaurant or bar with the day(s) it runs. Set "schedule" to the day(s) (e.g. "Tuesdays") and put the deal itself in "title" (e.g. "BOGO wings", "Kids eat free").

Respond with ONLY a JSON array (no prose, no markdown fence). Each element:
{
  "title": string,
  "date": "YYYY-MM-DD" or null (null only for recurring specials; must be between ${iso(today)} and ${iso(end)}),
  "schedule": string or null (e.g. "Tuesdays" — only for recurring specials),
  "time": string or null (e.g. "6-9 PM"),
  "venue": string or null,
  "town": string or null (just the town name),
  "kind": "event" or "special",
  "source": string or null (domain of the page you found it on, e.g. "patch.com")
}`;
}

function buildVenuePrompt(today: Date): string {
  // Venue calendars are reliable further out than general community search.
  const end = new Date(today.getTime() + 45 * 86_400_000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const list = VENUE_WATCHLIST.map(
    (v) => `- ${v.name}: ${v.url}${v.hint ? ` (${v.hint})` : ""}`
  ).join("\n");

  return `Look up the event calendars for these venues (search for the venue's own site/calendar page):
${list}

List EVERY show/event at these venues between ${iso(today)} and ${iso(end)}. Do not invent shows — only ones you actually found on their calendars or listings.

Respond with ONLY a JSON array (no prose, no markdown fence). Each element:
{
  "venueName": string (exactly as listed above),
  "title": string (the show name; keep "SOLD OUT" prefixes if present),
  "date": "YYYY-MM-DD",
  "time": string or null (e.g. "7:00 PM")
}`;
}

// Salvage a JSON array from model output: strip fences/prose, and if the
// output was truncated mid-array, cut at the last closed brace.
function extractJsonArray(text: string): unknown[] | null {
  const cleaned = text.replace(/```(?:json)?/g, "").trim();
  const start = cleaned.indexOf("[");
  if (start === -1) return null;

  const end = cleaned.lastIndexOf("]");
  if (end > start) {
    try {
      const parsed = JSON.parse(cleaned.slice(start, end + 1));
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      /* fall through to salvage */
    }
  }
  const lastBrace = cleaned.lastIndexOf("}");
  if (lastBrace > start) {
    try {
      const parsed = JSON.parse(cleaned.slice(start, lastBrace + 1) + "]");
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

function parseVenueShows(text: string): LocalItem[] {
  const parsed = extractJsonArray(text);
  if (!parsed) return [];
  const byName = new Map(VENUE_WATCHLIST.map((v) => [v.name.toLowerCase(), v]));
  const items: LocalItem[] = [];
  for (const raw of parsed) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.title !== "string" || !r.title.trim()) continue;
    if (typeof r.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) continue;
    const venue =
      typeof r.venueName === "string"
        ? byName.get(r.venueName.toLowerCase())
        : undefined;
    if (!venue) continue;
    items.push({
      title: r.title.trim(),
      date: r.date,
      schedule: null,
      time: typeof r.time === "string" ? r.time : null,
      venue: venue.name,
      town: venue.town,
      kind: "event",
      source: venue.url.replace(/\/.*$/, ""),
    });
  }
  return items;
}

// The model is told to return a bare JSON array, but strip a markdown fence
// or leading prose if it adds one anyway.
function parseItems(text: string): LocalItem[] {
  const parsed = extractJsonArray(text);
  if (!parsed) return [];

  const items: LocalItem[] = [];
  const seen = new Set<string>();
  const perVenue = new Map<string, number>();
  for (const raw of parsed) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.title !== "string" || !r.title.trim()) continue;
    // The model sometimes repeats an item it found on multiple pages.
    const dedupeKey = [r.title, r.date ?? "", r.venue ?? ""]
      .join("|")
      .toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    // ...and sometimes dumps one venue's entire calendar. Cap per venue so a
    // single bar's music schedule can't crowd out the rest of the area.
    if (typeof r.venue === "string" && r.venue.trim()) {
      const venueKey = r.venue.trim().toLowerCase();
      const n = perVenue.get(venueKey) ?? 0;
      if (n >= 2) continue;
      perVenue.set(venueKey, n + 1);
    }
    const kind = r.kind === "special" ? "special" : "event";
    const date =
      typeof r.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.date)
        ? r.date
        : null;
    // One-off events must carry a date; otherwise the card can't place them.
    if (kind === "event" && !date) continue;
    items.push({
      title: r.title.trim(),
      date,
      schedule: typeof r.schedule === "string" ? r.schedule : null,
      time: typeof r.time === "string" ? r.time : null,
      venue: typeof r.venue === "string" ? r.venue : null,
      town: typeof r.town === "string" ? r.town : null,
      kind,
      source: typeof r.source === "string" ? r.source : null,
    });
  }
  return items;
}

export async function GET(request: NextRequest) {
  const isVercelCron = request.headers.get("x-vercel-cron");
  const authHeader = request.headers.get("authorization");
  if (!isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { success: false, error: "OPENAI_API_KEY not set" },
      { status: 500 }
    );
  }

  const dryRun = request.nextUrl.searchParams.get("dry") === "1";
  const today = new Date();

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const [communityResp, venueResp] = await Promise.all([
      openai.responses.create({
        model: MODEL,
        tools: [{ type: "web_search_preview" }],
        input: buildPrompt(today),
        max_output_tokens: 8000,
      }),
      VENUE_WATCHLIST.length > 0
        ? openai.responses.create({
            model: MODEL,
            tools: [{ type: "web_search_preview" }],
            input: buildVenuePrompt(today),
            max_output_tokens: 6000,
          })
        : Promise.resolve(null),
    ]);

    const communityItems = parseItems(communityResp.output_text ?? "");
    const venueItems = venueResp
      ? parseVenueShows(venueResp.output_text ?? "")
      : [];

    // Merge, community items first; drop duplicates across the two passes.
    const merged: LocalItem[] = [];
    const mergeSeen = new Set<string>();
    for (const it of [...communityItems, ...venueItems]) {
      const key = [it.title, it.date ?? "", it.venue ?? ""]
        .join("|")
        .toLowerCase();
      if (mergeSeen.has(key)) continue;
      mergeSeen.add(key);
      merged.push(it);
    }
    const items = merged;

    if (items.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Model returned no parseable items",
          // Truncated raw output so a failed run is debuggable from the response.
          raw: (communityResp.output_text ?? "").slice(0, 2000),
        },
        { status: 502 }
      );
    }

    if (dryRun) {
      return NextResponse.json({ success: true, dryRun: true, items });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Specials are recurring (burger night, happy hour) but the search only
    // finds them some runs. If this run found none, carry the previous
    // snapshot's specials forward instead of wiping them.
    if (!items.some((it) => it.kind === "special")) {
      const { data: prev } = await supabase
        .from("mirror_local_events")
        .select("items")
        .order("week_start", { ascending: false })
        .limit(1)
        .maybeSingle();
      const prevSpecials = ((prev?.items as LocalItem[]) ?? []).filter(
        (it) => it.kind === "special"
      );
      items.push(...prevSpecials);
    }

    const weekStart = today.toISOString().slice(0, 10);
    const { error } = await supabase
      .from("mirror_local_events")
      .upsert(
        {
          week_start: weekStart,
          generated_at: new Date().toISOString(),
          items,
          model: MODEL,
        },
        { onConflict: "week_start" }
      );

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, weekStart, count: items.length });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "unknown" },
      { status: 500 }
    );
  }
}
