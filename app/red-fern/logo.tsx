/**
 * The Red Fern mark.
 *
 * Drawn rather than a bitmap, so it stays crisp from a 32px header to a hero,
 * and so the brick of the frond and the charcoal of the wordmark come from the
 * same place as the rest of the palette. Geometry lives in ./fern-geometry.
 */

import { BRAND, DEFAULT_FROND, RACHIS_WIDTH, VIEW_BOX } from "./fern-geometry";

export { BRAND };

export function FernMark({
  className = "",
  color = BRAND.brick,
}: {
  className?: string;
  color?: string;
}) {
  return (
    <svg
      viewBox={`0 0 ${VIEW_BOX.width} ${VIEW_BOX.height}`}
      className={className}
      role="presentation"
      aria-hidden
      focusable="false"
    >
      <g fill={color}>
        {DEFAULT_FROND.pinnae.map((pinna, index) => (
          <path key={index} d={pinna.d} transform={pinna.transform} />
        ))}
      </g>
      <path
        d={DEFAULT_FROND.rachis}
        fill="none"
        stroke={color}
        strokeWidth={RACHIS_WIDTH}
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Fern over the wordmark, the way the sign at the gate reads.
 *
 * `tone` picks the wordmark color: charcoal on the cream pages, off-white on
 * the dark ones. The frond stays brick either way — it's the one thing that
 * shouldn't change.
 */
export default function RedFernLogo({
  className = "",
  tone = "dark",
  size = "md",
  align = "center",
  subtitle = "PLANTATION",
}: {
  className?: string;
  tone?: "dark" | "light";
  size?: "sm" | "md" | "lg";
  align?: "center" | "start";
  subtitle?: string | null;
}) {
  const wordmarkColor = tone === "light" ? BRAND.cream : BRAND.charcoal;
  const fernColor = tone === "light" ? BRAND.brickLight : BRAND.brick;
  const scale = {
    sm: {
      fern: "h-9",
      word: "text-lg tracking-[0.34em]",
      rule: "w-10",
      sub: "text-[8px] tracking-[0.4em]",
    },
    md: {
      fern: "h-14",
      word: "text-2xl tracking-[0.36em]",
      rule: "w-14",
      sub: "text-[10px] tracking-[0.44em]",
    },
    lg: {
      fern: "h-24 sm:h-28",
      word: "text-4xl sm:text-5xl tracking-[0.32em]",
      rule: "w-20 sm:w-24",
      sub: "text-[11px] sm:text-xs tracking-[0.5em]",
    },
  }[size];

  return (
    <span
      className={`flex flex-col ${align === "start" ? "items-start" : "items-center"} ${className}`}
    >
      <FernMark className={`${scale.fern} w-auto`} color={fernColor} />
      <span className={`rf-wordmark mt-3 leading-none ${scale.word}`} style={{ color: wordmarkColor }}>
        {/* Letterspacing leaves a gap after the last letter; the padding puts
            it back on the other side so the wordmark reads centered. */}
        <span className="pl-[0.34em]">REDFERN</span>
      </span>
      <span
        className={`mt-2 h-px ${scale.rule}`}
        style={{ backgroundColor: tone === "light" ? BRAND.brickLight : BRAND.brick }}
      />
      {subtitle && (
        <span className={`rf-wordmark mt-2 leading-none ${scale.sub}`} style={{ color: wordmarkColor }}>
          <span className="pl-[0.5em]">{subtitle}</span>
        </span>
      )}
    </span>
  );
}
