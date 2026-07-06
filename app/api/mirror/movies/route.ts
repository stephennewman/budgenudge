import { NextRequest, NextResponse } from "next/server";

// "Now showing" — movies in theaters plus recent TV per streaming service
// (Netflix, HBO Max, Peacock, Prime, Paramount+, Disney+) from TMDB, enriched
// with a Rotten Tomatoes score from OMDb when available. Both keys are free:
//   TMDB:  https://www.themoviedb.org/settings/api
//   OMDb:  https://www.omdbapi.com/apikey.aspx
// The widget hides itself when TMDB_API_KEY is missing.
export const revalidate = 21600; // 6 hours

const TMDB = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p/w342";
const PER_TYPE = 12;

// Default TMDB watch-provider IDs (US region). Extra providers can be added
// per-device via the `extra` query param (comma-separated TMDB provider IDs);
// their labels are resolved from TMDB's provider list.
const STREAMING_PROVIDERS: { id: string; label: string; tmdbId: number }[] = [
  { id: "netflix", label: "Netflix", tmdbId: 8 },
  { id: "hbo", label: "HBO Max", tmdbId: 1899 },
  { id: "peacock", label: "Peacock", tmdbId: 386 },
  { id: "prime", label: "Prime", tmdbId: 9 },
  { id: "paramount", label: "Paramount+", tmdbId: 531 },
  { id: "disney", label: "Disney+", tmdbId: 337 },
];

type TmdbProvider = {
  provider_id: number;
  provider_name: string;
  display_priorities?: Record<string, number>;
  display_priority?: number;
};

// All TV watch providers available in the US, per TMDB.
async function fetchProviderCatalog(tmdbKey: string): Promise<TmdbProvider[]> {
  try {
    const res = await fetch(
      `${TMDB}/watch/providers/tv?api_key=${tmdbKey}&language=en-US&watch_region=US`,
      { next: { revalidate } }
    );
    if (!res.ok) return [];
    const list = ((await res.json()).results as TmdbProvider[]) || [];
    return list.sort(
      (a, b) =>
        (a.display_priorities?.US ?? a.display_priority ?? 999) -
        (b.display_priorities?.US ?? b.display_priority ?? 999)
    );
  } catch {
    return [];
  }
}

type MediaItem = {
  type: "movie" | "tv";
  title: string;
  year: string | null;
  poster: string | null;
  tmdbScore: number | null; // 0-100
  rtScore: string | null; // e.g. "85%" (Rotten Tomatoes critics, via OMDb)
  url: string | null; // TMDB details page
};

type Section = {
  id: string;
  label: string;
  items: MediaItem[];
};

type TmdbResult = {
  id?: number;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  vote_average?: number;
};

async function fetchRtScore(
  omdbKey: string,
  title: string,
  year: string | null,
  type: "movie" | "series"
): Promise<string | null> {
  try {
    const params = new URLSearchParams({ apikey: omdbKey, t: title, type });
    if (year) params.set("y", year);
    const res = await fetch(`https://www.omdbapi.com/?${params.toString()}`, {
      next: { revalidate },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      Ratings?: { Source: string; Value: string }[];
    };
    const rt = data.Ratings?.find((r) => r.Source === "Rotten Tomatoes");
    return rt?.Value ?? null;
  } catch {
    return null;
  }
}

// Rating used for ordering: prefer Rotten Tomatoes, fall back to TMDB score.
// Unrated items sort last.
function ratingValue(item: MediaItem): number {
  if (item.rtScore) {
    const n = parseInt(item.rtScore, 10);
    if (!Number.isNaN(n)) return n;
  }
  return item.tmdbScore ?? -1;
}

async function buildList(
  results: TmdbResult[],
  type: "movie" | "tv",
  omdbKey: string | undefined
): Promise<MediaItem[]> {
  const picks = results.filter((r) => r.poster_path).slice(0, PER_TYPE);

  const items = await Promise.all(
    picks.map(async (r) => {
      const title = (type === "movie" ? r.title : r.name) || "Untitled";
      const date = type === "movie" ? r.release_date : r.first_air_date;
      const year = date ? date.slice(0, 4) : null;
      const tmdbScore =
        typeof r.vote_average === "number" && r.vote_average > 0
          ? Math.round(r.vote_average * 10)
          : null;
      const rtScore = omdbKey
        ? await fetchRtScore(omdbKey, title, year, type === "movie" ? "movie" : "series")
        : null;

      return {
        type,
        title,
        year,
        poster: r.poster_path ? `${IMG}${r.poster_path}` : null,
        tmdbScore,
        rtScore,
        url: r.id ? `https://www.themoviedb.org/${type}/${r.id}` : null,
      } satisfies MediaItem;
    })
  );
  // Highest-rated first in every tab.
  return items.sort((a, b) => ratingValue(b) - ratingValue(a));
}

async function fetchResults(url: string): Promise<TmdbResult[]> {
  try {
    const res = await fetch(url, { next: { revalidate } });
    if (!res.ok) return [];
    return ((await res.json()).results as TmdbResult[]) || [];
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const tmdbKey = process.env.TMDB_API_KEY;
  if (!tmdbKey) return NextResponse.json({ sections: [] });
  const omdbKey = process.env.OMDB_API_KEY;

  // ?list=providers → the catalog of US streaming services that can be added
  // as extra tabs (defaults excluded).
  if (req.nextUrl.searchParams.get("list") === "providers") {
    const defaults = new Set(STREAMING_PROVIDERS.map((p) => p.tmdbId));
    const catalog = (await fetchProviderCatalog(tmdbKey))
      .filter((p) => !defaults.has(p.provider_id))
      .map((p) => ({ tmdbId: p.provider_id, label: p.provider_name }));
    return NextResponse.json({ providers: catalog });
  }

  // Extra provider tabs added on the device, as comma-separated TMDB IDs.
  const extraIds = (req.nextUrl.searchParams.get("extra") ?? "")
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0)
    .filter((n) => !STREAMING_PROVIDERS.some((p) => p.tmdbId === n))
    .slice(0, 10);

  let providers = STREAMING_PROVIDERS;
  if (extraIds.length > 0) {
    const catalog = await fetchProviderCatalog(tmdbKey);
    const byId = new Map(catalog.map((p) => [p.provider_id, p.provider_name]));
    providers = [
      ...STREAMING_PROVIDERS,
      ...extraIds.map((tmdbId) => ({
        id: `p${tmdbId}`,
        label: byId.get(tmdbId) ?? `Provider ${tmdbId}`,
        tmdbId,
      })),
    ];
  }

  // Recent shows: premiered within the last 6 months, ordered by popularity.
  const today = new Date().toISOString().slice(0, 10);
  const cutoff = new Date(Date.now() - 183 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  try {
    const [theaterResults, ...providerResults] = await Promise.all([
      fetchResults(
        `${TMDB}/movie/now_playing?api_key=${tmdbKey}&region=US&language=en-US&page=1`
      ),
      ...providers.map((p) =>
        fetchResults(
          `${TMDB}/discover/tv?api_key=${tmdbKey}&language=en-US&watch_region=US` +
            `&with_watch_providers=${p.tmdbId}&with_watch_monetization_types=flatrate` +
            `&first_air_date.gte=${cutoff}&first_air_date.lte=${today}` +
            `&sort_by=popularity.desc&vote_count.gte=5`
        )
      ),
    ]);

    const [theaterItems, ...providerItems] = await Promise.all([
      buildList(theaterResults, "movie", omdbKey),
      ...providerResults.map((results) => buildList(results, "tv", omdbKey)),
    ]);

    const sections: Section[] = [
      { id: "theaters", label: "In Theatres", items: theaterItems },
      ...providers.map((p, i) => ({
        id: p.id,
        label: p.label,
        items: providerItems[i],
      })),
    ].filter((s) => s.items.length > 0);

    return NextResponse.json({ sections });
  } catch {
    return NextResponse.json({ sections: [] });
  }
}
