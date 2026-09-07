/**
 * The frond, as geometry.
 *
 * Kept apart from the component so the shape can be rendered and eyeballed on
 * its own (scripts/preview-fern.js) while it's being tuned, and so the numbers
 * that decide what the mark looks like sit in one readable place.
 */

export const BRAND = {
  brick: "#8e2b1e",
  brickLight: "#c25a45",
  charcoal: "#3c4143",
  cream: "#f4f2ef",
} as const;

export const VIEW_BOX = { width: 118, height: 208 } as const;

export type FrondOptions = {
  /** Leaflet pairs up the stem. */
  pairs: number;
  /** Where along the stem the first pair sits, leaving a bare stalk below. */
  firstPair: number;
  /** Longest leaflet, in user units, and how much shorter the tip pair is. */
  maxLength: number;
  tipShortening: number;
  /** Half-thickness of the widest leaflet. */
  maxWidth: number;
  /** Degrees the leaflets sweep up, at the base and at the tip. */
  liftBase: number;
  liftTip: number;
  /** How much each leaflet curves up along its own length. */
  curve: number;
  /** How far the tip of the frond leans off center. */
  lean: number;
};

export const FROND: FrondOptions = {
  pairs: 12,
  firstPair: 0.1,
  maxLength: 60,
  tipShortening: 0.42,
  maxWidth: 5.2,
  liftBase: 33,
  liftTip: 53,
  curve: 0.17,
  lean: 5,
};

const RACHIS_TOP = 14;
const RACHIS_BASE = 200;
const CENTER = VIEW_BOX.width / 2;

function rachisX(t: number, lean = FROND.lean): number {
  return CENTER + lean * t * t;
}

function rachisY(t: number): number {
  return RACHIS_BASE - t * (RACHIS_BASE - RACHIS_TOP);
}

/**
 * One pinna, drawn along +x with its base at the origin: a lanceolate leaflet,
 * toothed on the leading edge, smooth underneath and swept up along its
 * length. The teeth are what make a fern read as a fern and not a feather.
 */
export function pinnaPath(length: number, width: number, curve: number, teeth = 7): string {
  const rise = (u: number) => -curve * length * u * u;
  const profile = (u: number) => Math.sin(Math.PI * Math.pow(u, 0.62)) * width;
  const parts: string[] = ["M 0 0"];

  // Out along the leading edge, alternating full depth with a shallower cut:
  // that alternation is the serration.
  for (let i = 1; i <= teeth; i++) {
    const u = i / teeth;
    const depth = i % 2 === 0 ? 0.55 : 1;
    parts.push(`L ${(length * u).toFixed(2)} ${(rise(u) - profile(u) * depth).toFixed(2)}`);
  }
  parts.push(`L ${length.toFixed(2)} ${rise(1).toFixed(2)}`);
  // Back along the underside in one sweep, so each leaflet has a settled base.
  parts.push(
    `Q ${(length * 0.5).toFixed(2)} ${(rise(0.5) + width * 0.85).toFixed(2)} 0 0`
  );
  parts.push("Z");
  return parts.join(" ");
}

export type Pinna = { d: string; transform: string };
export type Frond = { pinnae: Pinna[]; rachis: string };

export function buildFrond(options: FrondOptions = FROND): Frond {
  const pinnae: Pinna[] = [];
  for (let i = 0; i < options.pairs; i++) {
    const step = i / (options.pairs - 1);
    const t = options.firstPair + step * (1 - options.firstPair);
    // Widest a little under halfway up, shorter at the stalk and at the tip —
    // the outline the sign has, rather than a straight-sided triangle.
    const taper = Math.sin(Math.PI * (0.17 + step * 0.75));
    const length = 13 + options.maxLength * taper * (1 - options.tipShortening * step);
    const width = 2.4 + options.maxWidth * taper;
    const lift = options.liftBase + (options.liftTip - options.liftBase) * step;
    const d = pinnaPath(length, width, options.curve);
    const x = rachisX(t, options.lean).toFixed(2);
    const y = rachisY(t).toFixed(2);
    // The left half is mirrored rather than rotated, so its teeth stay on the
    // leading edge instead of ending up underneath.
    for (const mirror of [true, false]) {
      pinnae.push({
        d,
        transform: `translate(${x} ${y})${mirror ? " scale(-1 1)" : ""} rotate(${-lift})`,
      });
    }
  }
  const rachis = `M ${rachisX(0, options.lean).toFixed(2)} ${rachisY(0).toFixed(2)} Q ${(
    rachisX(0.5, options.lean) - 1.5
  ).toFixed(2)} ${rachisY(0.5).toFixed(2)} ${rachisX(1, options.lean).toFixed(2)} ${rachisY(1).toFixed(
    2
  )}`;
  return { pinnae, rachis };
}

export const DEFAULT_FROND = buildFrond();
export const RACHIS_WIDTH = 3;
