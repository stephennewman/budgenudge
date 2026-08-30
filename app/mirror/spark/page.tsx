"use client";

// Spark — a hidden page for two.
//
// Locked: looks like a stuck loading card. Double-tap "Loading" (Stephen) or
// ";)" (Whitney). Unlocked: one idea at a time — adjust heat, regenerate in
// the same or a new category, or step back/forward through history. The next
// random idea preloads in the background so "Next" feels instant.

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlarmClock,
  ArrowLeft,
  Brain,
  ChevronLeft,
  ChevronRight,
  Crown,
  Dices,
  Eye,
  Feather,
  Flame,
  Gamepad2,
  Gift,
  Hand,
  Heart,
  HelpCircle,
  History,
  Home,
  Hourglass,
  ListChecks,
  Lock,
  Lollipop,
  MessageSquare,
  Mic,
  Move,
  Quote,
  RefreshCw,
  Shirt,
  Shuffle,
  Sparkles,
  Split,
  Star,
  Sunrise,
  Timer,
  VenetianMask,
  Wine,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { ACTION_TAGS, CATEGORIES, type SparkCategory } from "./categories";

type Person = "stephen" | "whitney";

interface SparkIdea {
  level: number;
  tag: string;
  title: string;
  body: string;
}

interface HistoryEntry {
  idea: SparkIdea;
  category: SparkCategory;
  level: number;
}

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
  hotpast: History,
  challenges: AlarmClock,
  confessions: Lock,
  "truth-or-dare": HelpCircle,
  "would-you-rather": Split,
  "bucket-list": ListChecks,
  "know-me": Brain,
  firsts: Star,
  oral: Lollipop,
};

const PINK = "#ec4899";
const TEAL = "#14b8a6";

const DOUBLE_TAP_MS = 450;
const IDLE_SECONDS = 45;

const HEAT_LEVELS = [
  { level: 1, badge: "\u{1F525}", name: "Warm" },
  { level: 2, badge: "\u{1F525}\u{1F525}", name: "Hot" },
  { level: 3, badge: "\u{1F525}\u{1F525}\u{1F525}", name: "Wild" },
  { level: 4, badge: "XXXX", name: "Off the charts" },
] as const;

export default function SparkPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-neutral-950" />}>
      <Spark />
    </Suspense>
  );
}

function Spark() {
  const searchParams = useSearchParams();
  const paramPerson = searchParams.get("p");
  const initialPerson: Person | null =
    paramPerson === "stephen" || paramPerson === "whitney" ? paramPerson : null;

  const [person, setPerson] = useState<Person | null>(initialPerson);
  const [heatLevel, setHeatLevel] = useState(1);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [preloaded, setPreloaded] = useState<HistoryEntry | null>(null);

  const lastTap = useRef<{ id: string; at: number }>({ id: "", at: 0 });
  const [idleLeft, setIdleLeft] = useState(IDLE_SECONDS);
  const lastActivity = useRef(Date.now());
  const router = useRouter();
  const abortRef = useRef<AbortController | null>(null);
  const preloadAbortRef = useRef<AbortController | null>(null);
  const bootedRef = useRef(false);

  const current = history[historyIndex] ?? null;

  const touch = useCallback(() => {
    lastActivity.current = Date.now();
  }, []);

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

  const pickCategory = useCallback((excludeId?: string) => {
    const pool = excludeId
      ? CATEGORIES.filter((c) => c.id !== excludeId)
      : CATEGORIES;
    return pool[Math.floor(Math.random() * pool.length)] ?? CATEGORIES[0];
  }, []);

  const randomTag = () =>
    ACTION_TAGS[Math.floor(Math.random() * ACTION_TAGS.length)].id;

  const fetchIdea = useCallback(
    async (
      p: Person,
      cat: SparkCategory,
      level: number,
      avoid: string[],
      signal: AbortSignal
    ): Promise<SparkIdea> => {
      const res = await fetch("/api/mirror/spark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({
          person: p,
          category: cat.id,
          level,
          tag: randomTag(),
          avoid,
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { idea: SparkIdea };
      if (!data.idea?.body) throw new Error("empty");
      return data.idea;
    },
    []
  );

  const generateEntry = useCallback(
    async (
      p: Person,
      cat: SparkCategory,
      level: number,
      avoid: string[],
      signal: AbortSignal
    ): Promise<HistoryEntry> => {
      const idea = await fetchIdea(p, cat, level, avoid, signal);
      return { idea, category: cat, level };
    },
    [fetchIdea]
  );

  const startPreload = useCallback(
    (p: Person, level: number, excludeIds: string[] = []) => {
      preloadAbortRef.current?.abort();
      const ctrl = new AbortController();
      preloadAbortRef.current = ctrl;
      const cat = pickCategory(
        excludeIds.length ? excludeIds[excludeIds.length - 1] : undefined
      );
      generateEntry(p, cat, level, [], ctrl.signal)
        .then((entry) => {
          if (!ctrl.signal.aborted) setPreloaded(entry);
        })
        .catch(() => {
          if (!ctrl.signal.aborted) setPreloaded(null);
        });
    },
    [generateEntry, pickCategory]
  );

  const replaceAtIndex = useCallback(
    (index: number, entry: HistoryEntry, truncateForward = true) => {
      setHistory((prev) => {
        const next = truncateForward ? prev.slice(0, index + 1) : [...prev];
        next[index] = entry;
        return next;
      });
      setHistoryIndex(index);
      setError(false);
    },
    []
  );

  const loadFresh = useCallback(
    async (
      cat: SparkCategory,
      level: number,
      opts?: { avoid?: string[]; atIndex?: number; preload?: boolean }
    ) => {
      if (!person) return;
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      setError(false);
      touch();

      const avoid =
        opts?.avoid ??
        (current
          ? [current.idea.title || current.idea.body.slice(0, 60)]
          : []);

      try {
        const entry = await generateEntry(
          person,
          cat,
          level,
          avoid,
          ctrl.signal
        );
        if (ctrl.signal.aborted) return;
        const idx = opts?.atIndex ?? historyIndex;
        replaceAtIndex(idx, entry);
        if (opts?.preload !== false) {
          setPreloaded(null);
          startPreload(person, level, [cat.id]);
        }
      } catch {
        if (ctrl.signal.aborted) return;
        setError(true);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    },
    [
      person,
      current,
      historyIndex,
      generateEntry,
      replaceAtIndex,
      startPreload,
      touch,
    ]
  );

  const unlock = useCallback(
    (p: Person) => {
      setPerson(p);
      setHeatLevel(1);
      setHistory([]);
      setHistoryIndex(0);
      setPreloaded(null);
      bootedRef.current = false;
    },
    []
  );

  useEffect(() => {
    if (!person || bootedRef.current) return;
    bootedRef.current = true;
    const cat = pickCategory();
    loadFresh(cat, 1, { atIndex: 0 });
  }, [person, pickCategory, loadFresh]);

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

  const onHeat = useCallback(
    (level: number) => {
      if (!person || !current || loading) return;
      setHeatLevel(level);
      loadFresh(current.category, level);
    },
    [person, current, loading, loadFresh]
  );

  const onRegenSame = useCallback(() => {
    if (!person || !current || loading) return;
    loadFresh(current.category, heatLevel);
  }, [person, current, loading, heatLevel, loadFresh]);

  const onRegenNew = useCallback(() => {
    if (!person || loading) return;
    const cat = pickCategory(current?.category.id);
    loadFresh(cat, heatLevel);
  }, [person, current, loading, heatLevel, pickCategory, loadFresh]);

  const onNext = useCallback(() => {
    if (!person || loading) return;
    touch();

    if (historyIndex < history.length - 1) {
      setHistoryIndex((i) => i + 1);
      const nextEntry = history[historyIndex + 1];
      if (nextEntry) setHeatLevel(nextEntry.level);
      return;
    }

    if (preloaded) {
      const entry = preloaded;
      setHistory((prev) => [...prev, entry]);
      setHistoryIndex(history.length);
      setHeatLevel(entry.level);
      setPreloaded(null);
      startPreload(person, entry.level, [entry.category.id]);
      return;
    }

    const cat = pickCategory(current?.category.id);
    loadFresh(cat, heatLevel, { atIndex: history.length });
  }, [
    person,
    loading,
    historyIndex,
    history,
    preloaded,
    current,
    heatLevel,
    pickCategory,
    loadFresh,
    startPreload,
    touch,
  ]);

  const onBack = useCallback(() => {
    if (historyIndex <= 0 || loading) return;
    touch();
    const nextIdx = historyIndex - 1;
    setHistoryIndex(nextIdx);
    setHeatLevel(history[nextIdx]?.level ?? 1);
  }, [historyIndex, history, loading, touch]);

  const onRetry = useCallback(() => {
    if (!current) return;
    loadFresh(current.category, heatLevel);
  }, [current, heatLevel, loadFresh]);

  const accent = person === "whitney" ? PINK : TEAL;
  const canBack = historyIndex > 0;
  const atEnd = historyIndex >= history.length - 1;
  const Icon = current ? (CATEGORY_ICONS[current.category.id] ?? Sparkles) : Sparkles;
  const heatMeta = HEAT_LEVELS.find((h) => h.level === (current?.level ?? heatLevel));

  return (
    <div
      className="min-h-screen bg-neutral-950 text-neutral-100 select-none"
      onPointerDownCapture={touch}
    >
      {person === null ? (
        <div className="relative flex h-screen items-center justify-center overflow-hidden">
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
        <div className="mx-auto flex h-screen w-full max-w-2xl flex-col px-5 py-5">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/mirror")}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-neutral-700 px-3.5 py-1.5 text-xs font-medium text-neutral-300 hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to app
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

          {current && (
            <div className="mt-5 flex items-center gap-2.5">
              <Icon className="h-6 w-6" style={{ color: accent }} strokeWidth={1.8} />
              <span className="text-xl font-bold" style={{ color: accent }}>
                {current.category.name}
              </span>
            </div>
          )}

          <div
            className="mt-4 flex min-h-0 flex-1 flex-col rounded-3xl border bg-neutral-900 p-6"
            style={{ borderColor: `${accent}44` }}
          >
            {loading && !current ? (
              <div className="flex flex-1 animate-pulse flex-col justify-center gap-3">
                <div className="h-4 w-1/3 rounded bg-neutral-800" />
                <div className="h-4 w-full rounded bg-neutral-800" />
                <div className="h-4 w-5/6 rounded bg-neutral-800" />
              </div>
            ) : error ? (
              <button
                onClick={onRetry}
                className="flex flex-1 flex-col items-center justify-center gap-2 text-neutral-400"
              >
                <RefreshCw className="h-8 w-8" />
                <span className="text-sm">Didn&apos;t come through — tap to retry</span>
              </button>
            ) : current ? (
              <>
                <div className="flex shrink-0 items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    <span>{heatMeta?.badge}</span>
                    <span>{heatMeta?.name}</span>
                  </div>
                  {current.idea.tag && (
                    <span
                      className="rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                      style={{ borderColor: `${accent}66`, color: accent }}
                    >
                      {current.idea.tag}
                    </span>
                  )}
                </div>
                <div
                  className={`min-h-0 flex-1 overflow-y-auto ${loading ? "opacity-50" : ""}`}
                >
                  {current.idea.title && (
                    <div className="mt-4 text-lg font-bold" style={{ color: accent }}>
                      {current.idea.title}
                    </div>
                  )}
                  <p className="mt-2 text-base leading-relaxed text-neutral-200">
                    {current.idea.body}
                  </p>
                </div>
              </>
            ) : null}
          </div>

          <div className="mt-4">
            <p className="mb-2 text-center text-[11px] font-medium uppercase tracking-wider text-neutral-500">
              Hotter or colder
            </p>
            <div className="flex gap-2">
              {HEAT_LEVELS.map((h) => {
                const active = (current?.level ?? heatLevel) === h.level;
                return (
                  <button
                    key={h.level}
                    onClick={() => onHeat(h.level)}
                    className="flex flex-1 flex-col items-center gap-1 rounded-2xl border py-2.5 text-sm font-semibold transition"
                    style={{
                      borderColor: active ? accent : `${accent}33`,
                      color: active ? accent : `${accent}99`,
                      backgroundColor: active ? `${accent}15` : "transparent",
                    }}
                  >
                    <span className="text-base leading-none">{h.badge}</span>
                    <span className="text-[10px] font-medium uppercase tracking-wide opacity-80">
                      {h.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              onClick={onRegenSame}
              disabled={loading || !current}
              className="flex items-center justify-center gap-2 rounded-2xl border py-3 text-sm font-medium disabled:opacity-40"
              style={{ borderColor: accent, color: accent }}
            >
              <RefreshCw className="h-4 w-4" />
              Same category
            </button>
            <button
              onClick={onRegenNew}
              disabled={loading}
              className="flex items-center justify-center gap-2 rounded-2xl border py-3 text-sm font-medium disabled:opacity-40"
              style={{ borderColor: accent, color: accent }}
            >
              <Shuffle className="h-4 w-4" />
              New category
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 pb-1">
            <button
              onClick={onBack}
              disabled={!canBack || loading}
              className="flex items-center justify-center gap-1.5 rounded-2xl border border-neutral-700 py-3 text-sm font-medium text-neutral-300 disabled:opacity-30"
            >
              <ChevronLeft className="h-5 w-5" />
              Back
            </button>
            <button
              onClick={onNext}
              disabled={loading}
              className="flex items-center justify-center gap-1.5 rounded-2xl border py-3 text-sm font-medium disabled:opacity-40"
              style={{ borderColor: accent, color: accent }}
            >
              {loading && atEnd && !preloaded ? "Conjuring..." : "Next"}
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
