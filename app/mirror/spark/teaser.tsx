"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

// Spark's doorway, disguised as a channel card stuck loading. Mirrors the
// exact chrome of the other ChecklistChannel cards (watermark icon, chip +
// title header, big light body text) so it blends into the rotation.
// Double-tap the ";" for Stephen's section, the ")" for Whitney's.

const DOUBLE_TAP_MS = 450;

export function SparkTeaser() {
  const lastTap = useRef<{ id: string; at: number }>({ id: "", at: 0 });
  // Fake progress: rushes early then crawls toward ~95% and stalls, like a
  // download that's never quite done.
  const [progress, setProgress] = useState(8);

  useEffect(() => {
    const id = setInterval(() => {
      setProgress((p) => p + (95 - p) * 0.06);
    }, 900);
    return () => clearInterval(id);
  }, []);

  const onGlyphTap = (glyph: "semi" | "paren") => {
    const now = Date.now();
    const isDouble =
      lastTap.current.id === glyph && now - lastTap.current.at < DOUBLE_TAP_MS;
    lastTap.current = { id: glyph, at: now };
    if (!isDouble) return;
    window.location.href = `/mirror/spark?p=${glyph === "paren" ? "whitney" : "stephen"}`;
  };

  return (
    <div
      className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 p-6 backdrop-blur-md md:p-8"
      style={{
        background:
          "linear-gradient(135deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.08) 70%)",
      }}
    >
      {/* Oversized watermark icon, same treatment as the other cards. */}
      <Loader2
        aria-hidden
        className="pointer-events-none absolute -bottom-10 -right-10 h-52 w-52 text-white/[0.08] md:h-72 md:w-72"
        strokeWidth={0.9}
      />
      <div className="relative flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-white/70">
          <Loader2
            className="h-4.5 w-4.5 animate-spin [animation-duration:2.5s]"
            strokeWidth={2}
          />
        </span>
        <span className="text-sm font-semibold uppercase tracking-wider text-white/75">
          Loading
        </span>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="my-auto py-2">
          <p className="flex items-center text-2xl font-light leading-relaxed text-white md:text-3xl lg:text-4xl">
            <span>Loading</span>
            <span
              onPointerDown={() => onGlyphTap("semi")}
              className="cursor-default py-4 pl-2"
            >
              ;
            </span>
            <span
              onPointerDown={() => onGlyphTap("paren")}
              className="cursor-default py-4 pr-3"
            >
              )
            </span>
          </p>
          <div className="mt-6 h-1.5 w-full max-w-md overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-white/40 transition-[width] duration-1000 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
