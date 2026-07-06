import { NextRequest, NextResponse } from "next/server";

// Nearby ticketed events for the mirror's "Out & About" card and the
// /mirror/events calendar. Two structured sources, merged and deduped:
// - Ticketmaster Discovery (TICKETMASTER_API_KEY): arenas, stadiums, big tours
// - SeatGeek (SEATGEEK_CLIENT_ID, optional): independent venues that don't
//   sell through Ticketmaster (Jannus Live, Crowbar, ...)
export const revalidate = 1800; // 30 minutes

const TM_URL = "https://app.ticketmaster.com/discovery/v2/events.json";
const SG_URL = "https://api.seatgeek.com/2/events";

// Palm Harbor, FL — fallback when the client doesn't pass a location.
const DEFAULT_LAT = 28.0781;
const DEFAULT_LON = -82.7637;

export type MirrorEvent = {
  name: string;
  localDate: string; // YYYY-MM-DD (venue-local)
  localTime: string | null; // HH:MM:SS or null when TBA
  venue: string | null;
  city: string | null;
  distanceMiles: number | null;
  category: string | null; // Music / Sports / Arts & Theatre / ...
  genre: string | null;
  priceMin: number | null;
  url: string | null;
};

type SgEvent = {
  title?: string;
  url?: string;
  datetime_local?: string; // "2026-07-24T20:00:00" venue-local
  date_tbd?: boolean;
  time_tbd?: boolean;
  type?: string; // "concert", "theater", "comedy", "minor_league_baseball", ...
  venue?: {
    name?: string;
    city?: string;
    location?: { lat?: number; lon?: number };
  };
  stats?: { lowest_price?: number | null };
};

// Map SeatGeek's event type to the segment buckets Ticketmaster uses, so the
// UI's category filter treats both sources the same.
function sgCategory(type: string | undefined): {
  category: string;
  genre: string | null;
} {
  const t = (type ?? "").toLowerCase();
  const pretty = t
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  if (t.includes("concert") || t.includes("music") || t.includes("festival"))
    return { category: "Music", genre: null };
  if (
    t.includes("theater") ||
    t.includes("broadway") ||
    t.includes("comedy") ||
    t.includes("dance") ||
    t.includes("circus")
  )
    return { category: "Arts & Theatre", genre: pretty };
  if (
    t.includes("baseball") ||
    t.includes("football") ||
    t.includes("hockey") ||
    t.includes("basketball") ||
    t.includes("soccer") ||
    t.includes("sports") ||
    t.includes("racing") ||
    t.includes("wrestling") ||
    t.includes("fight")
  )
    return { category: "Sports", genre: pretty };
  return { category: "Other", genre: pretty || null };
}

function haversineMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type TmEvent = {
  name?: string;
  url?: string;
  distance?: number;
  dates?: {
    start?: {
      localDate?: string;
      localTime?: string;
      timeTBA?: boolean;
      noSpecificTime?: boolean;
    };
    status?: { code?: string };
  };
  classifications?: {
    primary?: boolean;
    segment?: { name?: string };
    genre?: { name?: string };
  }[];
  priceRanges?: { min?: number }[];
  _embedded?: {
    venues?: { name?: string; city?: { name?: string } }[];
  };
};

export async function GET(request: NextRequest) {
  const apiKey = process.env.TICKETMASTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ items: [] });
  }

  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat")) || DEFAULT_LAT;
  const lon = Number(searchParams.get("lon")) || DEFAULT_LON;
  const radius = Math.min(Number(searchParams.get("radius")) || 50, 100);
  const days = Math.min(Number(searchParams.get("days")) || 14, 60);

  // Now through `days` out, in the UTC format Ticketmaster requires
  // (no milliseconds).
  const now = new Date();
  const end = new Date(now.getTime() + days * 86_400_000);
  const fmt = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");

  const params = new URLSearchParams({
    apikey: apiKey,
    latlong: `${lat},${lon}`,
    radius: String(radius),
    unit: "miles",
    startDateTime: fmt(now),
    endDateTime: fmt(end),
    sort: "date,asc",
    size: "100",
  });

  // One page (100 events) covers ~2-3 weeks around Tampa Bay; longer windows
  // for the calendar page need more pages to reach the end of the range.
  const pageCount = days > 14 ? 3 : 1;

  // SeatGeek fills in independent venues Ticketmaster doesn't carry.
  const sgClientId = process.env.SEATGEEK_CLIENT_ID;
  const sgParams = sgClientId
    ? new URLSearchParams({
        client_id: sgClientId,
        lat: String(lat),
        lon: String(lon),
        range: `${radius}mi`,
        "datetime_local.gte": now.toISOString().slice(0, 10),
        "datetime_local.lte": end.toISOString().slice(0, 10),
        sort: "datetime_local.asc",
        per_page: "250",
      })
    : null;

  try {
    const [responses, sgRes] = await Promise.all([
      Promise.all(
        Array.from({ length: pageCount }, (_, page) =>
          fetch(`${TM_URL}?${params.toString()}&page=${page}`, {
            next: { revalidate },
          })
        )
      ),
      sgParams
        ? fetch(`${SG_URL}?${sgParams.toString()}`, { next: { revalidate } })
        : Promise.resolve(null),
    ]);

    const raw: TmEvent[] = [];
    for (const res of responses) {
      if (!res.ok) continue;
      const json = await res.json();
      raw.push(...(json?._embedded?.events ?? []));
    }

    const sgRaw: SgEvent[] =
      sgRes && sgRes.ok ? (await sgRes.json())?.events ?? [] : [];

    // The same show is often listed by multiple sources (Ticketmaster,
    // resale, partner feeds); keep the first occurrence per name+date+venue.
    const seen = new Set<string>();
    const items: MirrorEvent[] = [];

    for (const ev of raw) {
      if (!ev.name || !ev.dates?.start?.localDate) continue;
      if (ev.dates.status?.code === "cancelled") continue;

      const venue = ev._embedded?.venues?.[0];
      const key = [
        ev.name.toLowerCase(),
        ev.dates.start.localDate,
        venue?.name?.toLowerCase() ?? "",
      ].join("|");
      if (seen.has(key)) continue;
      seen.add(key);

      const classification =
        ev.classifications?.find((c) => c.primary) ?? ev.classifications?.[0];
      const timeHidden =
        ev.dates.start.timeTBA || ev.dates.start.noSpecificTime;

      items.push({
        name: ev.name,
        localDate: ev.dates.start.localDate,
        localTime: timeHidden ? null : ev.dates.start.localTime ?? null,
        venue: venue?.name ?? null,
        city: venue?.city?.name ?? null,
        distanceMiles:
          typeof ev.distance === "number" ? Math.round(ev.distance) : null,
        category: classification?.segment?.name ?? null,
        genre: classification?.genre?.name ?? null,
        priceMin: ev.priceRanges?.[0]?.min ?? null,
        url: ev.url ?? null,
      });

      // The mirror tile only needs ~40; the calendar page (longer window)
      // keeps everything the extra pages returned.
      if (items.length >= (days > 14 ? 250 : 40)) break;
    }

    // SeatGeek events join through the same dedupe, so shows listed on both
    // platforms aren't doubled. Ticketmaster (richer data) wins ties.
    for (const ev of sgRaw) {
      if (!ev.title || !ev.datetime_local || ev.date_tbd) continue;
      const localDate = ev.datetime_local.slice(0, 10);
      const key = [
        ev.title.toLowerCase(),
        localDate,
        ev.venue?.name?.toLowerCase() ?? "",
      ].join("|");
      if (seen.has(key)) continue;
      seen.add(key);

      const { category, genre } = sgCategory(ev.type);
      const vLat = ev.venue?.location?.lat;
      const vLon = ev.venue?.location?.lon;

      items.push({
        name: ev.title,
        localDate,
        localTime: ev.time_tbd ? null : ev.datetime_local.slice(11, 19) || null,
        venue: ev.venue?.name ?? null,
        city: ev.venue?.city ?? null,
        distanceMiles:
          typeof vLat === "number" && typeof vLon === "number"
            ? Math.round(haversineMiles(lat, lon, vLat, vLon))
            : null,
        category,
        genre,
        priceMin: ev.stats?.lowest_price ?? null,
        url: ev.url ?? null,
      });
    }

    items.sort((a, b) =>
      a.localDate === b.localDate
        ? (a.localTime ?? "99").localeCompare(b.localTime ?? "99")
        : a.localDate.localeCompare(b.localDate)
    );

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
