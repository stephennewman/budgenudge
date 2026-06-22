// Boat Outlook — data fetching from NOAA tides + NWS weather/marine.
import { BOAT_CONFIG } from './config';

const TZ = BOAT_CONFIG.timezone;

export interface NwsPeriod {
  startTime: string;
  temperature: number | null;
  windSpeed: string | null;
  windDirection: string | null;
  probabilityOfPrecipitation: { value: number | null } | null;
  shortForecast: string | null;
}

export interface TideEvent {
  local: string; // "YYYY-MM-DD HH:mm" (station local time)
  type: 'H' | 'L';
  height: number;
  hour: number;
}

// Second-source forecast (Open-Meteo), keyed by ET hour for the target day.
export interface AltForecast {
  windKtByHour: Record<number, number>;
  gustKtByHour: Record<number, number>;
  rainByHour: Record<number, number>;
  tempByHour: Record<number, number>;
  dirByHour: Record<number, string>;
  thunderByHour: Record<number, boolean>;
  waveFtByHour: Record<number, number>;
  sunrise: string | null; // "...THH:mm" local
  sunset: string | null;
  uvMax: number | null;
  sstF: number | null; // sea-surface temp (fallback for water temp)
}

export interface BoatData {
  dateLabel: string; // "Tue, 6/23"
  weekdayName: string; // "TUESDAY"
  daylightPeriods: NwsPeriod[]; // tomorrow, 6a-8p ET
  gustByHourKt: Record<number, number>; // ET hour -> max gust (kt)
  tides: TideEvent[];
  seas: { text: string; ft: number | null };
  waterTempF: number | null; // NOAA sensor, else Open-Meteo SST
  advisories: string[]; // active NWS marine alerts (e.g. "Small Craft Advisory")
  alt: AltForecast | null; // Open-Meteo cross-check; null if unavailable
  usedFallback: boolean; // true if core weather came from Open-Meteo (NWS unavailable)
}

const KMH_TO_KT = 0.539957;

export const hourET = (iso: string) =>
  parseInt(new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', hour12: false }).format(new Date(iso)), 10);
const dayKeyET = (d: Date | string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(d));
const labelET = (d: Date) =>
  new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', month: 'numeric', day: 'numeric' }).format(d);
const weekdayET = (d: Date) =>
  new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'long' }).format(d).toUpperCase();

async function getJson<T = any>(url: string, timeoutMs = 12000): Promise<T> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': BOAT_CONFIG.userAgent, Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`${url} -> ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

// Parse the NWS Coastal Waters Forecast text for our zone's daytime seas.
function parseMarineSeas(productText: string, weekday: string): { text: string; ft: number | null } {
  const i = productText.indexOf(BOAT_CONFIG.nws.marineZone);
  const section = i >= 0 ? productText.slice(i, i + 2500) : '';
  for (const block of section.split(/\n\.(?=[A-Z])/).map((s) => s.trim())) {
    const nameMatch = block.match(/^([A-Z ]+?)\.\.\./);
    if (!nameMatch) continue;
    const name = nameMatch[1].trim();
    if (/NIGHT|TONIGHT/.test(name)) continue; // daytime periods only
    if (name !== weekday && name !== 'TODAY') continue;
    const seasMatch = block.match(/Seas?\s+([^.]*?)\./i);
    const text = seasMatch ? seasMatch[1].trim() : '';
    const nums = (text.match(/\d+/g) || []).map(Number);
    const ft = nums.length ? Math.max(...nums) : /less/i.test(text) ? 1 : null;
    if (text) return { text, ft };
  }
  return { text: '', ft: null };
}

// Expand the gridpoint windGust series into a per-ET-hour map (km/h -> kt) for a day.
function gustMapForDay(values: Array<{ validTime: string; value: number | null }>, dayKey: string): Record<number, number> {
  const map: Record<number, number> = {};
  for (const v of values) {
    if (v.value == null) continue;
    const [startIso, dur] = v.validTime.split('/');
    const hours = Math.max(1, parseIsoDurationHours(dur));
    for (let h = 0; h < hours; h++) {
      const t = new Date(new Date(startIso).getTime() + h * 3600_000);
      if (dayKeyET(t) !== dayKey) continue;
      const hr = hourET(t.toISOString());
      const kt = Math.round(v.value * KMH_TO_KT);
      map[hr] = Math.max(map[hr] ?? 0, kt);
    }
  }
  return map;
}

function parseIsoDurationHours(dur: string): number {
  // e.g. PT1H, PT6H, P1DT2H
  const m = dur?.match(/P(?:(\d+)D)?T?(?:(\d+)H)?/);
  if (!m) return 1;
  return (parseInt(m[1] || '0', 10) * 24) + parseInt(m[2] || '0', 10);
}

function degToCompass(deg: number | null | undefined): string {
  if (deg == null) return '';
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

// Build a UTC ISO instant for a given ET clock-hour on dayKey (DST-aware).
function etHourToISO(dayKey: string, hr: number): string {
  const hh = String(hr).padStart(2, '0');
  for (const off of [4, 5]) {
    const iso = `${dayKey}T${hh}:00:00-0${off}:00`;
    const d = new Date(iso);
    if (hourET(d.toISOString()) === hr && dayKeyET(d.toISOString()) === dayKey) return d.toISOString();
  }
  return `${dayKey}T${hh}:00:00-04:00`;
}

// Fallback: synthesize NWS-shaped daylight periods from Open-Meteo when NWS is down.
function synthesizePeriods(alt: AltForecast, dayKey: string): NwsPeriod[] {
  const out: NwsPeriod[] = [];
  for (let hr = 6; hr <= 20; hr++) {
    if (alt.windKtByHour[hr] == null) continue;
    const mph = Math.round(alt.windKtByHour[hr] / 0.8689);
    out.push({
      startTime: etHourToISO(dayKey, hr),
      temperature: alt.tempByHour[hr] ?? null,
      windSpeed: `${mph} mph`,
      windDirection: alt.dirByHour[hr] || '',
      probabilityOfPrecipitation: { value: alt.rainByHour[hr] ?? 0 },
      shortForecast: alt.thunderByHour[hr] ? 'Thunderstorms' : '',
    });
  }
  return out;
}

// Active NWS marine alerts for our coastal-waters zone (SCA, Special Marine Warning, etc.).
async function fetchMarineAdvisories(): Promise<string[]> {
  try {
    const data = await getJson(`https://api.weather.gov/alerts/active?zone=${BOAT_CONFIG.nws.marineZone}`);
    const events = (data.features || [])
      .map((f: { properties?: { event?: string } }) => f.properties?.event)
      .filter((e: string | undefined): e is string => !!e);
    return [...new Set<string>(events)];
  } catch {
    return [];
  }
}

// Open-Meteo: independent second source (free, no key). Weather + marine waves.
// Returns null on any failure so the outlook degrades to NWS-only gracefully.
async function fetchOpenMeteo(dayKey: string): Promise<AltForecast | null> {
  try {
    const { lat, lon, timezone } = BOAT_CONFIG;
    const tzParam = encodeURIComponent(timezone);
    const [wx, marine] = await Promise.all([
      getJson(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m,weather_code,precipitation_probability,temperature_2m&daily=sunrise,sunset,uv_index_max&wind_speed_unit=kn&temperature_unit=fahrenheit&timezone=${tzParam}&forecast_days=3`,
      ),
      getJson(
        `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&hourly=wave_height,sea_surface_temperature&length_unit=imperial&timezone=${tzParam}&forecast_days=3`,
      ).catch(() => null),
    ]);

    const h = wx.hourly;
    if (!h?.time) return null;
    const out: AltForecast = {
      windKtByHour: {}, gustKtByHour: {}, rainByHour: {}, tempByHour: {}, dirByHour: {}, thunderByHour: {}, waveFtByHour: {},
      sunrise: null, sunset: null, uvMax: null, sstF: null,
    };

    // Daily fields for the target day
    const dIdx = (wx.daily?.time || []).indexOf(dayKey);
    if (dIdx >= 0) {
      out.sunrise = wx.daily.sunrise?.[dIdx] ?? null;
      out.sunset = wx.daily.sunset?.[dIdx] ?? null;
      out.uvMax = wx.daily.uv_index_max?.[dIdx] ?? null;
    }
    // Open-Meteo returns local time strings ("YYYY-MM-DDTHH:00") in the requested tz.
    const THUNDER_CODES = new Set([95, 96, 99]);
    for (let i = 0; i < h.time.length; i++) {
      const t: string = h.time[i];
      if (t.slice(0, 10) !== dayKey) continue;
      const hr = parseInt(t.slice(11, 13), 10);
      if (hr < 6 || hr > 20) continue;
      out.windKtByHour[hr] = Math.round(h.wind_speed_10m[i] ?? 0);
      out.gustKtByHour[hr] = Math.round(h.wind_gusts_10m[i] ?? 0);
      out.rainByHour[hr] = h.precipitation_probability?.[i] ?? 0;
      out.tempByHour[hr] = Math.round(h.temperature_2m[i] ?? 0);
      out.dirByHour[hr] = degToCompass(h.wind_direction_10m?.[i]);
      out.thunderByHour[hr] = THUNDER_CODES.has(h.weather_code?.[i]);
    }
    const mh = marine?.hourly;
    if (mh?.time) {
      const ssts: number[] = [];
      for (let i = 0; i < mh.time.length; i++) {
        const t: string = mh.time[i];
        if (t.slice(0, 10) !== dayKey) continue;
        const hr = parseInt(t.slice(11, 13), 10);
        if (hr < 6 || hr > 20) continue;
        if (mh.wave_height?.[i] != null) out.waveFtByHour[hr] = mh.wave_height[i];
        if (mh.sea_surface_temperature?.[i] != null) ssts.push(mh.sea_surface_temperature[i]);
      }
      if (ssts.length) {
        const avgC = ssts.reduce((a, b) => a + b, 0) / ssts.length;
        out.sstF = Math.round((avgC * 9) / 5 + 32);
      }
    }
    return out;
  } catch {
    return null;
  }
}

export async function fetchBoatData(target?: Date): Promise<BoatData> {
  const day = target ?? new Date(Date.now() + 86400_000); // default: tomorrow
  const dayKey = dayKeyET(day);
  const ymd = dayKey.replace(/-/g, '');

  // Each source is independently resilient — one failure can't sink the whole text.
  const ok = <T>(r: PromiseSettledResult<T>): T | null => (r.status === 'fulfilled' ? r.value : null);
  const [hourlyR, gridR, tideR, cwfR, altR, waterR, advR] = await Promise.allSettled([
    getJson(`https://api.weather.gov/gridpoints/${BOAT_CONFIG.nws.grid}/forecast/hourly`),
    getJson(`https://api.weather.gov/gridpoints/${BOAT_CONFIG.nws.grid}`),
    getJson(
      `${BOAT_CONFIG.tide.host}/api/prod/datagetter?product=predictions&application=boat-outlook&begin_date=${ymd}&end_date=${ymd}&datum=MLLW&station=${BOAT_CONFIG.tide.station}&time_zone=lst_ldt&units=english&interval=hilo&format=json`,
    ),
    getJson(`https://api.weather.gov/products/types/CWF/locations/${BOAT_CONFIG.nws.office}`),
    fetchOpenMeteo(dayKey),
    fetchNoaaWaterTemp(),
    fetchMarineAdvisories(),
  ]);

  const hourly = ok(hourlyR);
  const gridRaw = ok(gridR);
  const tideData = ok(tideR);
  const cwfList = ok(cwfR);
  const alt = ok(altR) as AltForecast | null;
  const noaaWaterTempF = ok(waterR) as number | null;
  const advisories = (ok(advR) as string[] | null) ?? [];

  let daylightPeriods: NwsPeriod[] = (hourly?.properties?.periods || []).filter(
    (p: NwsPeriod) => dayKeyET(p.startTime) === dayKey && hourET(p.startTime) >= 6 && hourET(p.startTime) <= 20,
  );

  // Fallback: if NWS hourly is unavailable, synthesize from Open-Meteo so a text still sends.
  let usedFallback = false;
  if (!daylightPeriods.length && alt) {
    daylightPeriods = synthesizePeriods(alt, dayKey);
    usedFallback = daylightPeriods.length > 0;
  }

  const gustByHourKt = gustMapForDay(gridRaw?.properties?.windGust?.values || [], dayKey);

  const tides: TideEvent[] = (tideData?.predictions || []).map((p: { t: string; v: string; type: 'H' | 'L' }) => ({
    local: p.t,
    type: p.type,
    height: parseFloat(p.v),
    hour: parseInt(p.t.slice(11, 13), 10),
  }));

  // Marine seas (best-effort; degrade gracefully if product text is unavailable)
  let seas: { text: string; ft: number | null } = { text: '', ft: null };
  try {
    const productId = cwfList?.['@graph']?.[0]?.['@id'];
    if (productId) {
      const cwf = await getJson(productId);
      seas = parseMarineSeas(cwf.productText || '', weekdayET(day));
    }
  } catch {
    // leave seas empty; outlook handles null
  }

  return {
    dateLabel: labelET(day),
    weekdayName: weekdayET(day),
    daylightPeriods,
    gustByHourKt,
    tides,
    seas,
    waterTempF: noaaWaterTempF ?? alt?.sstF ?? null,
    advisories,
    alt,
    usedFallback,
  };
}

// NOAA water-temperature sensor (latest reading). Slow-moving, fine as a proxy for tomorrow.
async function fetchNoaaWaterTemp(): Promise<number | null> {
  try {
    const data = await getJson(
      `${BOAT_CONFIG.tide.host}/api/prod/datagetter?product=water_temperature&application=boat-outlook&date=latest&station=${BOAT_CONFIG.tide.waterTempStation}&time_zone=lst_ldt&units=english&format=json`,
    );
    const v = data?.data?.[0]?.v;
    const n = v != null ? Math.round(parseFloat(v)) : NaN;
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}
