// Beach Day / Boat Day scores (0-100) for the mirror dashboard.
//
// Reuses the existing Boat Outlook data pipeline (NWS + Open-Meteo marine +
// NOAA tides + active marine advisories) so the boat score stays consistent
// with the daily Boat Outlook SMS. The beach score uses the same data with
// beach-appropriate weighting (air temp, sun, rain, wind, water temp).
import { fetchBoatData, hourET, type BoatData } from "@/utils/boat/sources";
import { BOAT_CONFIG } from "@/utils/boat/config";

const MPH_TO_KT = 0.8689;
const windMph = (s: string | null) => {
  const n = (s || "").match(/\d+/g);
  return n ? Math.max(...n.map(Number)) : 0;
};
const toKt = (mph: number) => Math.round(mph * MPH_TO_KT);
const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

export interface ConditionScore {
  score: number; // 0-100
  label: string; // Great / Good / Fair / Poor / Skip
  reason: string; // one-line explanation
}

export interface MirrorConditions {
  date: string;
  location: string;
  beach: ConditionScore;
  boat: ConditionScore;
  detail: {
    windKt: number;
    gustKt: number;
    seasFt: number | null;
    rain: number;
    thunder: boolean;
    tempHiF: number | null;
    waterTempF: number | null;
    uv: number | null;
    advisory: string | null;
  };
}

function band(score: number): string {
  if (score >= 80) return "Great";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  if (score >= 20) return "Poor";
  return "Skip";
}

// Derive day-wide (daylight) figures from BoatData using the same safety-max
// philosophy as the boat outlook (take the rougher of NWS vs Open-Meteo).
function summarize(data: BoatData) {
  const ps = data.daylightPeriods;
  const alt = data.alt;

  const nwsKts = ps.map((p) => toKt(windMph(p.windSpeed)));
  const altWinds = alt ? Object.values(alt.windKtByHour) : [];
  const windKt = Math.max(0, ...nwsKts, ...altWinds);

  const nwsGust = Math.max(0, ...Object.values(data.gustByHourKt));
  const altGust = alt ? Math.max(0, ...Object.values(alt.gustKtByHour)) : 0;
  const gustKt = Math.max(nwsGust, altGust);

  const altWaveMaxFt = alt ? Math.max(0, ...Object.values(alt.waveFtByHour)) : 0;
  const seasFt = Math.max(data.seas.ft ?? 0, altWaveMaxFt) || (data.seas.ft ?? null);

  const rain = Math.max(
    0,
    ...ps.map((p) => p.probabilityOfPrecipitation?.value || 0),
    ...(alt ? Object.values(alt.rainByHour) : [0])
  );

  const thunder =
    ps.some((p) => /thunder|t-?storm/i.test(p.shortForecast || "")) ||
    (alt ? Object.values(alt.thunderByHour).some(Boolean) : false);

  const nwsTemps = ps
    .map((p) => p.temperature)
    .filter((t): t is number => Number.isFinite(t));
  const altTemps = alt ? Object.values(alt.tempByHour) : [];
  const temps = [...nwsTemps, ...altTemps];
  const tempHiF = temps.length ? Math.max(...temps) : null;

  return {
    windKt,
    gustKt,
    seasFt,
    rain,
    thunder,
    tempHiF,
    waterTempF: data.waterTempF,
    uv: alt?.uvMax ?? null,
    advisory: data.advisories[0] ?? null,
  };
}

function scoreBoat(d: ReturnType<typeof summarize>): ConditionScore {
  // Penalties calibrated to the boat outlook's GREEN/YELLOW/RED thresholds
  // (calm wind <=10kt, gusts, seas, rain, storms).
  let score = 100;
  score -= Math.max(0, d.windKt - 6) * 3; // 10kt ~ -12, 15kt ~ -27
  score -= Math.max(0, d.gustKt - 15) * 2; // 25kt ~ -20
  if (d.seasFt != null) score -= d.seasFt * 12; // 2ft ~ -24, 4ft ~ -48
  score -= d.rain * 0.4; // 60% ~ -24
  if (d.thunder) score -= 35;

  // An active marine advisory is an official no-go.
  if (d.advisory) score = Math.min(score, 12);

  score = clamp(Math.round(score));

  let reason: string;
  if (d.advisory) reason = d.advisory;
  else if (d.thunder) reason = "Storms possible";
  else if (d.seasFt != null && d.seasFt >= 3) reason = `Seas ~${d.seasFt.toFixed(0)} ft`;
  else if (d.gustKt > 22) reason = `Gusts to ${d.gustKt} kt`;
  else if (d.windKt > 12) reason = `Wind to ${d.windKt} kt`;
  else if (d.rain >= 50) reason = `${d.rain}% rain`;
  else reason = `Light wind, ${d.seasFt != null ? `~${d.seasFt.toFixed(0)} ft seas` : "calm water"}`;

  return { score, label: band(score), reason };
}

function scoreBeach(d: ReturnType<typeof summarize>): ConditionScore {
  let score = 100;

  // Air temperature: ideal 78-90F.
  if (d.tempHiF != null) {
    if (d.tempHiF < 78) score -= (78 - d.tempHiF) * 2.5;
    else if (d.tempHiF > 90) score -= (d.tempHiF - 90) * 2;
  }
  score -= d.rain * 0.5; // 60% ~ -30
  if (d.thunder) score -= 40;
  score -= Math.max(0, d.windKt - 10) * 1.5; // beach tolerates more wind than a boat
  // Cold water is less inviting for swimming.
  if (d.waterTempF != null && d.waterTempF < 72) score -= (72 - d.waterTempF) * 1.5;

  score = clamp(Math.round(score));

  let reason: string;
  if (d.thunder) reason = "Storms possible";
  else if (d.rain >= 50) reason = `${d.rain}% rain`;
  else if (d.tempHiF != null && d.tempHiF < 70) reason = `Cool, ${Math.round(d.tempHiF)}\u00b0`;
  else if (d.windKt > 16) reason = `Breezy, ${d.windKt} kt`;
  else if (d.waterTempF != null && d.waterTempF < 72) reason = `Cool water ${d.waterTempF}\u00b0`;
  else {
    const parts: string[] = [];
    if (d.tempHiF != null) parts.push(`${Math.round(d.tempHiF)}\u00b0`);
    if (d.waterTempF != null) parts.push(`${d.waterTempF}\u00b0 water`);
    if (d.uv != null) parts.push(`UV ${Math.round(d.uv)}`);
    reason = parts.length ? parts.join(" \u00b7 ") : "Sunny and warm";
  }

  return { score, label: band(score), reason };
}

export async function getMirrorConditions(): Promise<MirrorConditions> {
  // Score for TODAY (the boat pipeline defaults to tomorrow).
  const data = await fetchBoatData(new Date());
  const d = summarize(data);

  return {
    date: data.dateLabel,
    location: BOAT_CONFIG.locationName,
    beach: scoreBeach(d),
    boat: scoreBoat(d),
    detail: d,
  };
}
