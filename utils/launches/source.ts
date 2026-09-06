/**
 * Launch Library 2 (thespacedevs.com) reader, narrowed to Florida.
 *
 * Free and unauthenticated, rate limited to roughly 15 requests an hour, which
 * is why the sync cron runs hourly and pages rather than polling constantly.
 *
 * Kept free of Next.js and Supabase imports so it can be exercised directly by
 * test/launch-calendar-test.js.
 */

const API_BASE = "https://ll.thespacedevs.com/2.3.0/launches/upcoming/";

/** Cape Canaveral SFS and Kennedy Space Center, the two Florida launch sites. */
export const FLORIDA_LOCATION_IDS = [12, 27];

/** Rough bounding box for Florida, used when a pad has no known location id. */
const FLORIDA_BBOX = { minLat: 24.4, maxLat: 31.1, minLon: -87.7, maxLon: -79.8 };

/**
 * Upstream precisions worth putting on a calendar. Anything coarser (M, Q1-Q4,
 * H1/H2, Y, FY) is a placeholder parked on the last day of the period — most of
 * the Florida manifest sits there and would bury the real launches.
 */
const TIMED_PRECISIONS = new Set(["SEC", "MIN", "HR"]);
const ALL_DAY_PRECISION = "DAY";

export type LaunchRecord = {
  launch_id: string;
  name: string;
  slug: string | null;
  provider: string | null;
  rocket: string | null;
  mission_name: string | null;
  mission_description: string | null;
  orbit: string | null;
  pad_name: string | null;
  pad_location: string;
  pad_latitude: number | null;
  pad_longitude: number | null;
  net: string;
  net_precision: string;
  window_start: string | null;
  window_end: string | null;
  status: string | null;
  status_name: string | null;
  probability: number | null;
  webcast_url: string | null;
  info_url: string | null;
  image_url: string | null;
};

type Json = Record<string, unknown>;

function obj(value: unknown): Json | null {
  return value && typeof value === "object" ? (value as Json) : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  // Latitude and longitude come back as strings on some pads.
  if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return null;
}

/** True when a launch lifts off from Cape Canaveral or Kennedy Space Center. */
export function isFloridaLaunch(raw: unknown): boolean {
  const pad = obj(obj(raw)?.pad);
  if (!pad) return false;

  const location = obj(pad.location);
  if (location) {
    if (typeof location.id === "number" && FLORIDA_LOCATION_IDS.includes(location.id)) {
      return true;
    }
    const name = str(location.name);
    if (name && /(^|,)\s*FL\s*,/i.test(name)) return true;
    if (name && /cape canaveral|kennedy space cent/i.test(name)) return true;
  }

  // Last resort for a pad the API hasn't fully catalogued yet.
  const lat = num(pad.latitude);
  const lon = num(pad.longitude);
  return (
    lat !== null &&
    lon !== null &&
    lat >= FLORIDA_BBOX.minLat &&
    lat <= FLORIDA_BBOX.maxLat &&
    lon >= FLORIDA_BBOX.minLon &&
    lon <= FLORIDA_BBOX.maxLon
  );
}

/** True when the T-0 is firm enough to hold a slot on a calendar. */
export function isSchedulable(precision: string | null): boolean {
  if (!precision) return false;
  return TIMED_PRECISIONS.has(precision) || precision === ALL_DAY_PRECISION;
}

/** True when the launch gets a timed event rather than an all-day one. */
export function isTimedLaunch(launch: Pick<LaunchRecord, "net_precision">): boolean {
  return TIMED_PRECISIONS.has(launch.net_precision);
}

/**
 * Reshape one upstream launch into a row, or null when it is not a Florida
 * launch with a schedulable T-0.
 */
export function normalizeLaunch(raw: unknown): LaunchRecord | null {
  const launch = obj(raw);
  if (!launch) return null;

  const id = str(launch.id);
  const name = str(launch.name);
  const net = str(launch.net);
  if (!id || !name || !net) return null;
  if (Number.isNaN(Date.parse(net))) return null;

  const precision = str(obj(launch.net_precision)?.abbrev);
  if (!isSchedulable(precision)) return null;
  if (!isFloridaLaunch(launch)) return null;

  const pad = obj(launch.pad);
  const location = obj(pad?.location);
  const mission = obj(launch.mission);
  const rocket = obj(obj(launch.rocket)?.configuration);
  const status = obj(launch.status);

  // vidURLs is ordered by priority; the first entry is the primary webcast.
  const videos = Array.isArray(launch.vidURLs) ? launch.vidURLs : [];
  const infos = Array.isArray(launch.infoURLs) ? launch.infoURLs : [];

  return {
    launch_id: id,
    name,
    slug: str(launch.slug),
    provider: str(obj(launch.launch_service_provider)?.name),
    rocket: str(rocket?.full_name) ?? str(rocket?.name),
    mission_name: str(mission?.name),
    mission_description: str(mission?.description),
    orbit: str(obj(mission?.orbit)?.name),
    pad_name: str(pad?.name),
    pad_location: str(location?.name) ?? "Florida, USA",
    pad_latitude: num(pad?.latitude),
    pad_longitude: num(pad?.longitude),
    net: new Date(net).toISOString(),
    net_precision: precision!,
    window_start: str(launch.window_start),
    window_end: str(launch.window_end),
    status: str(status?.abbrev),
    status_name: str(status?.name),
    probability: typeof launch.probability === "number" ? launch.probability : null,
    webcast_url: str(obj(videos[0])?.url),
    info_url: str(obj(infos[0])?.url),
    image_url: str(obj(launch.image)?.image_url),
  };
}

export type FetchResult = {
  /** Florida launches with a schedulable T-0, soonest first. */
  launches: LaunchRecord[];
  /**
   * Count of Florida launches seen upstream including the unschedulable ones,
   * for reporting how much of the manifest the precision filter held back.
   */
  floridaSeen: number;
  /** False when a page failed, which suppresses cancellations for the run. */
  complete: boolean;
};

/**
 * Page through the upcoming Florida manifest.
 *
 * `maxPages` bounds the run: the Florida manifest runs to a few hundred
 * entries, nearly all of them year-level placeholders sorted last.
 */
export async function fetchFloridaLaunches(
  options: { maxPages?: number; pageSize?: number; fetchImpl?: typeof fetch } = {}
): Promise<FetchResult> {
  const { maxPages = 3, pageSize = 100, fetchImpl = fetch } = options;

  const launches: LaunchRecord[] = [];
  let floridaSeen = 0;
  let complete = true;
  let offset = 0;

  for (let page = 0; page < maxPages; page++) {
    const url = `${API_BASE}?mode=detailed&limit=${pageSize}&offset=${offset}&location__ids=${FLORIDA_LOCATION_IDS.join(",")}`;
    const response = await fetchImpl(url, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      complete = false;
      break;
    }

    const body = (await response.json()) as Json;
    const results = Array.isArray(body.results) ? body.results : [];

    for (const raw of results) {
      // location__ids is a server-side hint; re-check so a widened filter or a
      // mis-tagged pad can never leak a non-Florida launch into the calendar.
      if (!isFloridaLaunch(raw)) continue;
      floridaSeen++;
      const normalized = normalizeLaunch(raw);
      if (normalized) launches.push(normalized);
    }

    if (results.length < pageSize || !str(body.next)) break;
    offset += pageSize;
  }

  launches.sort((a, b) => a.net.localeCompare(b.net));
  return { launches, floridaSeen, complete };
}
