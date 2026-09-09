"use client";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

// Spark's doorway, disguised as a channel card stuck loading. Mirrors the
// exact chrome of the other ChecklistChannel cards (watermark icon, chip +
// title header, big light body text) so it blends into the rotation.
// Tap anywhere to open a single sexy challenge for Whitney.

export function SparkTeaser() {
  const router = useRouter();

  return (
    <button
      type="button"
      aria-label="Open a challenge for Whitney"
      onPointerDown={() => router.push("/mirror/spark?p=whitney")}
      className="relative flex h-full w-full flex-col overflow-hidden rounded-3xl border border-white/10 p-6 text-left backdrop-blur-md md:p-8"
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
        <span className="flex min-h-11 min-w-11 items-center text-sm font-semibold uppercase tracking-wider text-white/75">
          Loading
        </span>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="my-auto py-2">
          <p className="flex items-center text-2xl font-light leading-relaxed text-white md:text-3xl lg:text-4xl">
            <span className="py-4">Loading</span>
            <span className="py-4 pl-2 pr-3">;)</span>
          </p>
        </div>
      </div>
    </button>
  );
}
