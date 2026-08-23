"use client";

// Spark — a hidden page for two.
//
// Locked state: a card that looks stuck loading. Double-tap the word
// "Loading" for Stephen's side, the ";)" for Whitney's (same taps as the
// teaser card on the mirror). Unlocked state: a dealt hand of random
// categories; tapping one shows the four-level progression (X → XXXX) for
// that theme. All four levels are requested in parallel — each is a tiny
// one-idea generation — so cards pop in one at a time within a few seconds.

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Crown,
  Dices,
  Eye,
  Feather,
  Flame,
  Gamepad2,
  Gift,
  Hand,
  Heart,
  Home,
  Hourglass,
  MessageSquare,
  Mic,
  Move,
  Quote,
  Shirt,
  Shuffle,
  Sparkles,
  Sunrise,
  Timer,
  VenetianMask,
  Wine,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { CATEGORIES, type SparkCategory } from "./categories";

type Person = "stephen" | "whitney";

interface SparkIdea {
  level: number;
  title: string;
  body: string;
}

// Each level's card is a slot: still generating, failed (tap to retry), or done.
type Slot = "pending" | "error" | SparkIdea;

// Icons live here rather than in categories.ts so the shared data file stays
// importable by the server route without pulling lucide-react into it.
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  texts: MessageSquare,
  "dirty-talk": Quote,
  positions: Move,
  dares: Dices,
  foreplay: Flame,
  games: Gamepad2,
  roleplay: VenetianMask,
  "power-play": Crown,
  anticipation: Hourglass,
  "solo-show": Sparkles,
  sensory: Feather,
  "stolen-moments": Timer,
  "around-the-house": Home,
  massage: Hand,
  props: Gift,
  voice: Mic,
  undress: Shirt,
  morning: Sunrise,
  "kink-sampler": Zap,
  "date-finale": Wine,
  mirror: Eye,
  worship: Heart,
};

const PINK = "#ec4899";
const TEAL = "#14b8a6";

const DOUBLE_TAP_MS = 450;

// With no touches for this long, the page bails back to the mirror rotation
// (which also relocks it, since all state lives in the component). One screen
// holds a whole 4-level progression, so give plenty of reading time.
const IDLE_SECONDS = 45;

// How many categories are dealt per hand (4 columns x 3 rows on the tablet).
const HAND_SIZE = 12;

// A distinct emoji per level, repeated to match its number: smirk, fire,
// devil, splash.
const LEVEL_BADGES = [
  "\u{1F60F}",
  "\u{1F525}\u{1F525}",
  "\u{1F608}\u{1F608}\u{1F608}",
  "\u{1F4A6}\u{1F4A6}\u{1F4A6}\u{1F4A6}",
];
const LEVEL_NAMES = ["Warm", "Hot", "Wild", "Off the charts"];

// Daily cache: the first tap on a category generates fresh content per
// person; revisits that day reuse it so the progression opens instantly.
function todayKey(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(new Date());
}
// Version suffix busts previously cached content when the prompt changes
// materially (v2: fixed sender/receiver voice direction; v3: excluded
// breeding/pregnancy themes; v4: tightened perspective + level wording;
// v5: no names inside quoted texts/spoken lines; v6: shorter bodies).
const CACHE_PREFIX = "spark.prog6.";
const progressionCacheKey = (p: Person, categoryId: string) =>
  `${CACHE_PREFIX}${p}.${categoryId}.${todayKey()}`;

function readProgressionCache(p: Person, categoryId: string): SparkIdea[] | null {
  try {
    const raw = localStorage.getItem(progressionCacheKey(p, categoryId));
    const parsed = raw ? (JSON.parse(raw) as SparkIdea[]) : null;
    return Array.isArray(parsed) && parsed.length === 4 ? parsed : null;
  } catch {
    return null;
  }
}

function writeProgressionCache(p: Person, categoryId: string, ideas: SparkIdea[]) {
  try {
    // Drop stale days and older cache formats so storage never accumulates.
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (
        key?.startsWith("spark.") &&
        (!key.startsWith(CACHE_PREFIX) || !key.endsWith(todayKey()))
      ) {
        localStorage.removeItem(key);
      }
    }
    localStorage.setItem(progressionCacheKey(p, categoryId), JSON.stringify(ideas));
  } catch {
    // Storage full/unavailable: content still works, just regenerates.
  }
}

// useSearchParams requires a Suspense boundary; the fallback is a plain black
// screen, only ever visible for a frame on a hard load.
export default function SparkPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-neutral-950" />}>
      <Spark />
    </Suspense>
  );
}

function Spark() {
  // Unlock during the very first render when the teaser passed ?p=, so the
  // locked "Loading ;)" screen never flashes on the way in. The initial hand
  // uses a per-day seeded shuffle (not Math.random) so server and client
  // render the same grid — no hydration mismatch on hard loads.
  const searchParams = useSearchParams();
  const paramPerson = searchParams.get("p");
  const initialPerson: Person | null =
    paramPerson === "stephen" || paramPerson === "whitney" ? paramPerson : null;

  const [person, setPerson] = useState<Person | null>(initialPerson);
  const [hand, setHand] = useState<SparkCategory[]>(() =>
    initialPerson
      ? seededShuffle(CATEGORIES, `${todayKey()}.${initialPerson}`).slice(0, HAND_SIZE)
      : []
  );
  const [category, setCategory] = useState<SparkCategory | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const lastTap = useRef<{ id: string; at: number }>({ id: "", at: 0 });
  const [idleLeft, setIdleLeft] = useState(IDLE_SECONDS);
  const lastActivity = useRef(Date.now());
  const router = useRouter();

  const touch = useCallback(() => {
    lastActivity.current = Date.now();
  }, []);

  // Idle watchdog: any tap resets the clock; when it runs out, return to the
  // mirror rotation. Unmounting relocks the page automatically.
  useEffect(() => {
    const id = setInterval(() => {
      const left =
        IDLE_SECONDS - Math.floor((Date.now() - lastActivity.current) / 1000);
      if (left <= 0) {
        router.push("/mirror");
      } else {
        setIdleLeft(left);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [router]);

  const unlock = useCallback((p: Person) => {
    setPerson(p);
    setCategory(null);
    setSlots([]);
    setHand(shuffle(CATEGORIES).slice(0, HAND_SIZE));
  }, []);

  // Fallback for direct visits without ?p=: same taps as the teaser card —
  // double-tap the word "Loading" for Stephen, the ";)" for Whitney.
  const onGlyphTap = useCallback(
    (glyph: "word" | "wink") => {
      const now = Date.now();
      const isDouble =
        lastTap.current.id === glyph && now - lastTap.current.at < DOUBLE_TAP_MS;
      lastTap.current = { id: glyph, at: now };
      if (!isDouble) return;
      unlock(glyph === "wink" ? "whitney" : "stephen");
    },
    [unlock]
  );

  // Switching categories mid-generation aborts the in-flight batch.
  const abortRef = useRef<AbortController | null>(null);
  // Collects finished ideas for the current batch so we can cache once all
  // four are in (state updates are functional, so we track alongside).
  const resultsRef = useRef<(SparkIdea | null)[]>([null, null, null, null]);

  // One level = one tiny request. Fired four at a time by generate(), or
  // singly when a failed slot is retried.
  const generateLevel = useCallback(
    async (cat: SparkCategory, level: number, ctrl: AbortController, avoid: string[]) => {
      if (!person) return;
      try {
        const res = await fetch("/api/mirror/spark", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: ctrl.signal,
          body: JSON.stringify({ person, category: cat.id, level, avoid }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { idea: SparkIdea };
        if (!data.idea?.body) throw new Error("empty");
        resultsRef.current[level - 1] = data.idea;
        setSlots((prev) => prev.map((s, i) => (i === level - 1 ? data.idea : s)));
        touch(); // reading time as cards land
        if (resultsRef.current.every((x): x is SparkIdea => x !== null)) {
          writeProgressionCache(person, cat.id, resultsRef.current);
        }
      } catch {
        if (ctrl.signal.aborted) return; // superseded
        setSlots((prev) => prev.map((s, i) => (i === level - 1 ? "error" : s)));
      }
    },
    [person, touch]
  );

  const generate = useCallback(
    (cat: SparkCategory, opts?: { fresh?: boolean }) => {
      if (!person) return;
      abortRef.current?.abort();

      // "New take" (fresh) skips the cache and avoids what's on screen now.
      const avoid = opts?.fresh
        ? resultsRef.current
            .filter((x): x is SparkIdea => x !== null)
            .map((i) => i.title || i.body.slice(0, 60))
        : [];
      if (!opts?.fresh) {
        const cached = readProgressionCache(person, cat.id);
        if (cached) {
          resultsRef.current = [...cached];
          setSlots(cached);
          return;
        }
      }

      const ctrl = new AbortController();
      abortRef.current = ctrl;
      resultsRef.current = [null, null, null, null];
      setSlots(["pending", "pending", "pending", "pending"]);
      for (let level = 1; level <= 4; level++) {
        generateLevel(cat, level, ctrl, avoid);
      }
    },
    [person, generateLevel]
  );

  const retryLevel = useCallback(
    (level: number) => {
      if (!category) return;
      const ctrl = abortRef.current ?? new AbortController();
      abortRef.current = ctrl;
      setSlots((prev) => prev.map((s, i) => (i === level - 1 ? "pending" : s)));
      generateLevel(category, level, ctrl, []);
    },
    [category, generateLevel]
  );

  const pickCategory = useCallback(
    (cat: SparkCategory) => {
      setCategory(cat);
      generate(cat);
    },
    [generate]
  );

  const backToHand = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setCategory(null);
    setSlots([]);
  }, []);

  const accent = person === "whitney" ? PINK : TEAL;
  const anyPending = slots.some((s) => s === "pending");

  return (
    <div
      className="min-h-screen bg-neutral-950 text-neutral-100 select-none"
      onPointerDownCapture={touch}
    >
      {person === null ? (
        // ------------------------------ LOCKED ------------------------------
        // Looks like a stuck loading screen. The word and the ";)" are the keys.
        <div className="relative flex h-screen items-center justify-center overflow-hidden">
          {/* Quiet exit back to the mirror (the iPad app has no browser chrome) */}
          <Link
            href="/mirror"
            aria-label="Back to mirror"
            className="absolute left-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full text-neutral-700 transition hover:bg-white/10 hover:text-neutral-400"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>

          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/10 p-8 backdrop-blur-md">
            <div className="flex animate-pulse items-center justify-center text-3xl font-light tracking-wide text-neutral-400">
              <span
                onPointerDown={() => onGlyphTap("word")}
                className="cursor-default py-4"
              >
                Loading
              </span>
              <span
                onPointerDown={() => onGlyphTap("wink")}
                className="cursor-default py-4 pl-2 pr-3"
              >
                ;)
              </span>
            </div>
          </div>
        </div>
      ) : (
        // ----------------------------- UNLOCKED -----------------------------
        // Sized for the iPad in landscape: wide container, 4x3 category grid,
        // 2x2 progression that fits above the fold without scrolling.
        <div className="mx-auto flex h-screen w-full max-w-6xl flex-col px-6 py-5">
          {/* Top bar: exit back to the mirror (or back to the hand from a
              progression), person label + auto-return countdown. */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => (category ? backToHand() : router.push("/mirror"))}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-neutral-700 px-3.5 py-1.5 text-xs font-medium text-neutral-300 hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {category ? "Categories" : "Back to app"}
            </button>
            <div className="ml-auto flex items-center gap-2">
              <span
                className="text-xs font-semibold uppercase tracking-[0.2em]"
                style={{ color: accent }}
              >
                {person === "whitney" ? "Whitney" : "Stephen"}
              </span>
              <span className="text-xs tabular-nums text-neutral-600">
                {idleLeft}s
              </span>
            </div>
          </div>

          {category === null ? (
            // -------------------------- CATEGORY HAND --------------------------
            <>
              <div className="mt-4 text-xs text-neutral-500">
                Pick a category — you&apos;ll get all four levels at once, warm to
                off the charts
              </div>
              <div className="mt-3 grid min-h-0 flex-1 grid-cols-2 grid-rows-6 gap-3 sm:grid-cols-3 sm:grid-rows-4 lg:grid-cols-4 lg:grid-rows-3">
                {hand.map((cat) => {
                  const Icon = CATEGORY_ICONS[cat.id] ?? Sparkles;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => pickCategory(cat)}
                      className="flex min-h-0 flex-col items-center justify-center gap-2.5 rounded-2xl border bg-neutral-900 px-3 text-base font-semibold text-neutral-200 transition hover:bg-neutral-800"
                      style={{ borderColor: `${accent}33` }}
                    >
                      <Icon className="h-7 w-7" style={{ color: accent }} strokeWidth={1.6} />
                      {cat.name}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 pb-1">
                <button
                  onClick={() => setHand(shuffle(CATEGORIES).slice(0, HAND_SIZE))}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border py-2.5 text-sm font-medium"
                  style={{ borderColor: accent, color: accent }}
                >
                  <Shuffle className="h-4 w-4" />
                  Deal new categories
                </button>
              </div>
            </>
          ) : (
            // -------------------------- PROGRESSION --------------------------
            <>
              <div className="mt-4 flex items-center gap-2.5">
                {(() => {
                  const Icon = CATEGORY_ICONS[category.id] ?? Sparkles;
                  return <Icon className="h-5 w-5" style={{ color: accent }} strokeWidth={1.8} />;
                })()}
                <span className="text-lg font-bold" style={{ color: accent }}>
                  {category.name}
                </span>
              </div>

              {/* 2x2 above the fold on the tablet — no scrolling to see all
                  four levels. Long bodies scroll inside their own card. */}
              <div className="mt-3 grid min-h-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 sm:grid-rows-2">
                {slots.map((slot, i) => {
                  const header = (
                    <div className="flex shrink-0 items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                      <span>{LEVEL_BADGES[i]}</span>
                      <span>{LEVEL_NAMES[i]}</span>
                    </div>
                  );
                  if (slot === "pending") {
                    return (
                      <div
                        key={i}
                        className="flex min-h-0 animate-pulse flex-col rounded-3xl border border-neutral-800 bg-neutral-900/60 p-5"
                      >
                        {header}
                        <div className="mt-3 h-3 w-2/3 rounded bg-neutral-800" />
                        <div className="mt-2 h-3 w-full rounded bg-neutral-800" />
                      </div>
                    );
                  }
                  if (slot === "error") {
                    return (
                      <button
                        key={i}
                        onClick={() => retryLevel(i + 1)}
                        className="flex min-h-0 flex-col rounded-3xl border border-neutral-800 bg-neutral-900/60 p-5 text-left"
                      >
                        {header}
                        <p className="mt-2 text-sm text-neutral-500">
                          Didn&apos;t come through — tap to retry
                        </p>
                      </button>
                    );
                  }
                  return (
                    <div
                      key={i}
                      className="flex min-h-0 flex-col rounded-3xl border bg-neutral-900 p-5"
                      style={{
                        borderColor: `${accent}${(22 + i * 22).toString(16).padStart(2, "0")}`,
                        boxShadow: i === 3 ? `0 0 40px ${accent}22` : undefined,
                      }}
                    >
                      {header}
                      <div className="min-h-0 overflow-y-auto">
                        {slot.title && (
                          <div className="mt-2 text-sm font-bold" style={{ color: accent }}>
                            {slot.title}
                          </div>
                        )}
                        <p className="mt-1 text-[13px] leading-snug text-neutral-300">
                          {slot.body}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 pb-1">
                <button
                  onClick={() => generate(category, { fresh: true })}
                  disabled={anyPending}
                  className="w-full rounded-2xl border py-3 text-sm font-medium disabled:opacity-40"
                  style={{ borderColor: accent, color: accent }}
                >
                  {anyPending ? "Conjuring..." : `New take on ${category.name}`}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Deterministic shuffle for the initial hand: seeded by day + person so SSR
// and the client agree. "Deal new categories" uses the random shuffle above.
function seededShuffle<T>(arr: T[], seed: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rand = () => {
    h = Math.imul(h ^ (h >>> 15), h | 1);
    h ^= h + Math.imul(h ^ (h >>> 7), h | 61);
    return ((h ^ (h >>> 14)) >>> 0) / 4294967296;
  };
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
