// Boat Outlook — turns fetched data into the daily SMS text.
// Combines NWS (primary) with Open-Meteo (cross-check): safety-max numbers,
// plus a low-confidence note only when the two sources disagree.
import { BOAT_CONFIG } from './config';
import { fetchBoatData, hourET, type BoatData, type NwsPeriod, type TideEvent, type AltForecast } from './sources';

type Score = 'GREEN' | 'YELLOW' | 'RED';
const DOT: Record<Score, string> = { GREEN: '🟢', YELLOW: '🟡', RED: '🔴' };
const RANK: Record<Score, number> = { GREEN: 0, YELLOW: 1, RED: 2 };

const MPH_TO_KT = 0.8689;
const windMph = (s: string | null) => {
  const n = (s || '').match(/\d+/g);
  return n ? Math.max(...n.map(Number)) : 0;
};
const toKt = (mph: number) => Math.round(mph * MPH_TO_KT);

function shortTime(localStr: string): string {
  const m = localStr.match(/(\d{2}):(\d{2})$/);
  if (!m) return localStr;
  let h = parseInt(m[1], 10);
  const ap = h >= 12 ? 'p' : 'a';
  h = h % 12 || 12;
  return `${h}:${m[2]}${ap}`;
}

interface Seg {
  name: string;
  windKt: number; // safety-max of both sources
  gustKt: number;
  dir: string;
  rain: number;
  thunder: boolean;
}

// Max of an alt-source per-hour map over the ET hours covered by these NWS periods.
function altMaxOverPeriods(ps: NwsPeriod[], map: Record<number, number> | undefined): number {
  if (!map) return 0;
  return Math.max(0, ...ps.map((p) => map[hourET(p.startTime)] ?? 0));
}

function summarizeSegment(name: string, ps: NwsPeriod[], gustByHour: Record<number, number>, alt: AltForecast | null): Seg | null {
  if (!ps.length) return null;
  const nwsMph = Math.max(...ps.map((p) => windMph(p.windSpeed)));
  const nwsWindKt = toKt(nwsMph);
  const nwsGustKt = Math.max(0, ...ps.map((p) => gustByHour[hourET(p.startTime)] ?? 0));
  const rain = Math.max(
    Math.max(...ps.map((p) => p.probabilityOfPrecipitation?.value || 0)),
    altMaxOverPeriods(ps, alt?.rainByHour),
  );
  return {
    name,
    windKt: Math.max(nwsWindKt, altMaxOverPeriods(ps, alt?.windKtByHour)),
    gustKt: Math.max(nwsGustKt, altMaxOverPeriods(ps, alt?.gustKtByHour)),
    dir: ps.find((p) => windMph(p.windSpeed) === nwsMph)?.windDirection || ps[0].windDirection || '',
    rain,
    thunder: ps.some((p) => /thunder|t-?storm/i.test(p.shortForecast || '')),
  };
}

function scoreSeg(s: Seg, seasFt: number | null): Score {
  if (s.windKt > 15 || s.gustKt > 25 || s.rain >= 60 || (seasFt != null && seasFt >= 4) || (s.thunder && s.rain >= 50)) return 'RED';
  if (s.windKt > 10 || s.gustKt > 20 || s.rain >= 40 || (seasFt != null && seasFt >= 2)) return 'YELLOW';
  return 'GREEN';
}

function uvWord(uv: number): string {
  if (uv <= 2) return 'low';
  if (uv <= 5) return 'moderate';
  if (uv <= 7) return 'high';
  if (uv <= 10) return 'very high';
  return 'extreme';
}

export function buildBoatMessage(data: BoatData): string {
  const { daylightPeriods: ps, gustByHourKt, tides, seas, alt, waterTempF, advisories, usedFallback } = data;
  if (!ps.length) {
    return `BOAT OUTLOOK — TOMORROW\n${data.dateLabel} · ${BOAT_CONFIG.locationName}\n\nForecast unavailable right now. Try again later.`;
  }

  const seg = (h0: number, h1: number) => ps.filter((p) => hourET(p.startTime) >= h0 && hourET(p.startTime) < h1);
  const segs = (
    [
      ['morning', 6, 12],
      ['afternoon', 12, 17],
      ['evening', 17, 21],
    ] as const
  )
    .map(([name, a, b]) => summarizeSegment(name, seg(a, b), gustByHourKt, alt))
    .filter((s): s is Seg => s !== null);

  // Seas: safety-max of NWS marine text vs Open-Meteo numeric waves.
  const altWaveMaxFt = alt ? Math.max(0, ...Object.values(alt.waveFtByHour)) : 0;
  const seasFt = Math.max(seas.ft ?? 0, altWaveMaxFt) || (seas.ft ?? null);

  const scored = segs.map((s) => ({ seg: s, score: scoreSeg(s, seasFt) }));
  // An active marine advisory/warning is an official no-go — hard override to RED.
  const hasAdvisory = advisories.length > 0;
  const dayScore: Score = hasAdvisory ? 'RED' : scored.reduce<Score>((w, s) => (RANK[s.score] > RANK[w] ? s.score : w), 'GREEN');

  // Day-wide numbers (NWS combined with alt via safety-max on the high end)
  const nwsKts = ps.map((p) => toKt(windMph(p.windSpeed)));
  const nwsHi = Math.max(...nwsKts);
  const altWinds = alt ? Object.values(alt.windKtByHour) : [];
  const altHi = altWinds.length ? Math.max(...altWinds) : 0;
  const loKt = Math.min(...nwsKts, ...(altWinds.length ? altWinds : [Infinity]));
  const hiKt = Math.max(nwsHi, altHi);

  const nwsMaxGust = Math.max(0, ...Object.values(gustByHourKt));
  const altMaxGust = alt ? Math.max(0, ...Object.values(alt.gustKtByHour)) : 0;
  const maxGust = Math.max(nwsMaxGust, altMaxGust);

  const dir = ps.find((p) => toKt(windMph(p.windSpeed)) === nwsHi)?.windDirection || ps[0].windDirection || '';
  const rain = Math.max(
    ...ps.map((p) => p.probabilityOfPrecipitation?.value || 0),
    ...(alt ? Object.values(alt.rainByHour) : [0]),
  );
  const thunder = ps.some((p) => /thunder|t-?storm/i.test(p.shortForecast || ''));
  const nwsTemps = ps.map((p) => p.temperature).filter((t): t is number => Number.isFinite(t));
  const altTemps = alt ? Object.values(alt.tempByHour) : [];
  const temps = [...nwsTemps, ...altTemps];
  const windWord = hiKt <= 10 ? 'light' : hiKt <= 15 ? 'moderate' : hiKt <= 20 ? 'brisk' : 'rough';

  // Low-confidence detection: sources disagree materially.
  const lowConfidence =
    !!alt &&
    (Math.abs(nwsHi - altHi) >= 8 ||
      Math.abs(nwsMaxGust - altMaxGust) >= 12 ||
      ((seas.ft ?? 0) < 2 !== altWaveMaxFt < 2 && Math.abs((seas.ft ?? 0) - altWaveMaxFt) >= 1.5));

  const highs = tides.filter((t) => t.type === 'H').map((t) => shortTime(t.local)).join(' & ');
  const lows = tides
    .filter((t) => t.type === 'L')
    .map((t) => `${shortTime(t.local)} (${t.height.toFixed(1)}ft${t.height < 0.5 ? ', skinny' : ''})`)
    .join(', ');
  const dayLow = tides
    .filter((t) => t.type === 'L' && t.hour >= 9 && t.hour <= 18)
    .sort((a, b) => a.height - b.height)[0] as TideEvent | undefined;

  const verdict =
    dayScore === 'GREEN' ? 'GREAT — go anytime' : dayScore === 'YELLOW' ? 'OK — pick your window' : 'ROUGH — better to skip';

  let bottom: string;
  if (dayScore === 'GREEN') {
    bottom = `Calm dawn to dusk with plenty of water. ${highs.includes('a') ? 'Morning glass-off is prime.' : 'Good all day.'}`;
  } else if (dayScore === 'RED') {
    const why = hasAdvisory
      ? advisories[0].toLowerCase()
      : hiKt > 15 ? `wind to ${hiKt}kt` : maxGust > 25 ? `gusts to ${maxGust}kt` : seasFt && seasFt >= 4 ? `${seas.text || 'big'} seas` : thunder ? 'storms' : 'rough conditions';
    bottom = `Tough day — ${why}. Probably one to skip.`;
  } else {
    const greenSegs = scored.filter((s) => s.score === 'GREEN').map((s) => s.seg.name);
    const bad = scored.find((s) => s.score !== 'GREEN');
    const goodWindow = greenSegs[0] || 'early';
    const why = bad
      ? bad.seg.thunder && bad.seg.rain >= 40
        ? `storms move in for the ${bad.seg.name}`
        : bad.seg.gustKt > 20
          ? `gusts build to ${bad.seg.gustKt}kt by ${bad.seg.name}`
          : bad.seg.windKt > 10
            ? `wind builds to ${bad.seg.windKt}kt by ${bad.seg.name}`
            : seasFt && seasFt >= 2
              ? `${seas.text || 'choppy'} chop`
              : `it deteriorates in the ${bad.seg.name}`
      : '';
    bottom = `Go in the ${goodWindow} — ${why}.`;
  }
  if (dayLow && dayLow.height < 0.5) {
    bottom += ` Watch the ${shortTime(dayLow.local)} low (${dayLow.height.toFixed(1)}ft) in shallow spots.`;
  }

  const windLine = `💨 WIND   ${dir} ${loKt === hiKt ? hiKt : `${loKt}-${hiKt}`} kt (${windWord})${maxGust > hiKt ? `, gusts ${maxGust}` : ''}`;

  const L: string[] = [];
  L.push('BOAT OUTLOOK — TOMORROW');
  L.push(`${data.dateLabel} · ${BOAT_CONFIG.locationName}`);
  L.push('');
  L.push(`${DOT[dayScore]} ${verdict}`);
  if (hasAdvisory) L.push(`🚩 ${advisories.join(' · ').toUpperCase()}`);
  L.push('');
  L.push(windLine);
  L.push(`🌊 SEAS   ${seas.text || (altWaveMaxFt ? `~${altWaveMaxFt.toFixed(1)} ft` : 'see local marine fcst')}`);
  if (waterTempF) L.push(`🌡️ WATER  ${waterTempF}°`);
  L.push(`🌧️ RAIN   ${rain}%${thunder ? ', storms possible' : ', no storms'}`);
  const uvStr = alt?.uvMax != null ? ` · UV ${Math.round(alt.uvMax)} (${uvWord(alt.uvMax)})` : '';
  if (temps.length) L.push(`🌤️ TEMP   ${Math.min(...temps)}-${Math.max(...temps)}°${uvStr}`);
  if (alt?.sunrise && alt?.sunset) L.push(`🌅 SUN    ${shortTime(alt.sunrise)} - ${shortTime(alt.sunset)}`);
  if (highs) L.push(`⬆️ HIGH TIDE  ${highs}`);
  if (lows) L.push(`⬇️ LOW TIDE   ${lows}`);
  L.push('');
  L.push(bottom);
  if (lowConfidence) {
    L.push('');
    L.push(`⚠️ Low confidence — forecasts disagree (NWS ~${nwsHi}kt vs models ~${altHi}kt). Double-check before you go.`);
  }
  if (usedFallback) {
    L.push('');
    L.push('(NWS feed down — using backup model data.)');
  }
  return L.join('\n');
}

export async function generateBoatOutlookSMS(target?: Date): Promise<string> {
  const data = await fetchBoatData(target);
  return buildBoatMessage(data);
}
