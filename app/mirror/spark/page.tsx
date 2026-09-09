"use client";

// Spark — a hidden page for two.
//
// Locked state: a card that looks stuck loading. Tap it to open one sexy
// challenge for Whitney. Unlocked: that single challenge (spice, category,
// action tag). Generate and refresh step X→XX→XXX→XXXX→X with a new
// category each time. Flip switches to Stephen's cycle.

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Flame, RefreshCw } from "lucide-react";
import { ACTION_TAGS, CATEGORIES, type SparkCategory } from "./categories";

type Person = "stephen" | "whitney";

interface SparkIdea {
  level: number;
  tag: string;
  title: string;
  body: string;
}

const LEVEL_BADGES = [
  "\u{1F60F}",
  "\u{1F525}\u{1F525}",
  "\u{1F608}\u{1F608}\u{1F608}",
  "\u274C\u274C\u274C\u274C",
];
const LEVEL_NAMES = ["Warm", "Hot", "Wild", "Off the charts"];
const LEVEL_MARKS = ["X", "XX", "XXX", "XXXX"];

function pickCategory(excludeId?: string | null): SparkCategory {
  const pool = excludeId
    ? CATEGORIES.filter((c) => c.id !== excludeId)
    : CATEGORIES;
  return pool[Math.floor(Math.random() * pool.length)];
}

const nextSpice = (current: number) => (current % 4) + 1;

type CycleState = { level: number; categoryId: string | null };

const cycleKey = (p: Person) => `spark.cycle.v1.${p}`;

function readCycle(p: Person): CycleState {
  try {
    const raw = localStorage.getItem(cycleKey(p));
    if (!raw) return { level: 0, categoryId: null };
    const parsed = JSON.parse(raw) as CycleState;
    const level =
      typeof parsed.level === "number" && parsed.level >= 1 && parsed.level <= 4
        ? parsed.level
        : 0;
    return {
      level,
      categoryId: typeof parsed.categoryId === "string" ? parsed.categoryId : null,
    };
  } catch {
    return { level: 0, categoryId: null };
  }
}

function writeCycle(p: Person, level: number, categoryId: string | null) {
  try {
    localStorage.setItem(cycleKey(p), JSON.stringify({ level, categoryId }));
  } catch {
    // Storage full/unavailable: cycle still works in-session.
  }
}

const PINK = "#ec4899";
const TEAL = "#14b8a6";

const LOADING_LINES = [
  "Warming things up…",
  "Consulting the naughty archives…",
  "Checking the kids are asleep…",
  "Dimming the lights…",
  "Finding just the right amount of trouble…",
  "Almost there… don't finish without it…",
];

// With no touches for this long, the page bails back to the mirror rotation
// (which also relocks it, since all state lives in the component).
const IDLE_SECONDS = 90;

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
  const searchParams = useSearchParams();
  const paramPerson = searchParams.get("p");
  const initialPerson: Person | null =
    paramPerson === "stephen" || paramPerson === "whitney" ? paramPerson : null;

  const [person, setPerson] = useState<Person>(initialPerson ?? "whitney");
  const [unlocked, setUnlocked] = useState(initialPerson !== null);
  const [idea, setIdea] = useState<SparkIdea | null>(null);
  const [level, setLevel] = useState(1);
  const [category, setCategory] = useState<SparkCategory | null>(null);
  const [loading, setLoading] = useState(initialPerson !== null);
  const [loadingLine, setLoadingLine] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [idleLeft, setIdleLeft] = useState(IDLE_SECONDS);
  const lastActivity = useRef(Date.now());
  const abortRef = useRef<AbortController | null>(null);
  const recentRef = useRef<string[]>([]);
  const router = useRouter();

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

  useEffect(() => {
    if (!loading) {
      setLoadingLine(0);
      return;
    }
    setLoadingLine(0);
    const id = setInterval(() => {
      setLoadingLine((l) => Math.min(l + 1, LOADING_LINES.length - 1));
    }, 1400);
    return () => clearInterval(id);
  }, [loading]);

  const generate = useCallback(
    async (forPerson: Person, nextLevel: number, excludeCategoryId?: string | null) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const nextCategory = pickCategory(excludeCategoryId);
      const tag = ACTION_TAGS[Math.floor(Math.random() * ACTION_TAGS.length)];
      setLevel(nextLevel);
      setCategory(nextCategory);
      setLoading(true);
      setError(null);
      touch();

      try {
        const res = await fetch("/api/mirror/spark", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: ctrl.signal,
          body: JSON.stringify({
            person: forPerson,
            category: nextCategory.id,
            level: nextLevel,
            tag: tag.id,
            avoid: recentRef.current,
          }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { idea: SparkIdea };
        if (!data.idea?.body) throw new Error("empty");
        const next = data.idea;
        recentRef.current = [
          next.body,
          next.title,
          ...recentRef.current,
        ].filter(Boolean).slice(0, 12);
        setIdea(next);
        writeCycle(forPerson, nextLevel, nextCategory.id);
        touch();
      } catch (err) {
        const aborted =
          ctrl.signal.aborted ||
          (err instanceof DOMException && err.name === "AbortError");
        if (aborted) return;
        setError("Didn't come through — try again");
      } finally {
        if (abortRef.current === ctrl) setLoading(false);
      }
    },
    [touch]
  );

  useEffect(() => {
    if (!unlocked) return;
    const saved = readCycle(person);
    void generate(person, nextSpice(saved.level), saved.categoryId);
    // Unlock, flip, and refresh continue the X→XXXX→X cycle with a new category.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked, person]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const unlock = () => {
    setPerson("whitney");
    setUnlocked(true);
  };

  const generateNext = () => {
    void generate(person, nextSpice(level), category?.id);
  };

  const flipPerson = () => {
    const next: Person = person === "whitney" ? "stephen" : "whitney";
    setIdea(null);
    setCategory(null);
    setPerson(next);
    router.replace(`/mirror/spark?p=${next}`, { scroll: false });
  };

  const accent = person === "whitney" ? PINK : TEAL;
  const otherName = person === "whitney" ? "Stephen" : "Whitney";

  return (
    <div
      className="min-h-screen bg-neutral-950 text-neutral-100 select-none"
      onPointerDownCapture={touch}
    >
      {!unlocked ? (
        <div className="relative flex h-screen items-center justify-center overflow-hidden">
          <Link
            href="/mirror"
            aria-label="Back to mirror"
            className="absolute left-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full text-neutral-700 transition hover:bg-white/10 hover:text-neutral-400"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>

          <button
            type="button"
            aria-label="Open a challenge for Whitney"
            onClick={unlock}
            className="w-full max-w-md rounded-2xl border border-white/10 bg-white/10 p-8 backdrop-blur-md"
          >
            <div className="flex animate-pulse items-center justify-center text-3xl font-light tracking-wide text-neutral-400">
              <span className="py-4">Loading</span>
              <span className="py-4 pl-2 pr-3">;)</span>
            </div>
          </button>
        </div>
      ) : (
        <div className="mx-auto flex h-screen w-full max-w-2xl flex-col px-6 py-5">
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
              <span className="text-xs tabular-nums text-neutral-600">{idleLeft}s</span>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col items-center justify-center py-6">
            <div
              className="flex w-full flex-col rounded-3xl border bg-neutral-900 p-8 md:p-10"
              style={{
                borderColor: `${accent}44`,
                boxShadow: `0 0 48px ${accent}18`,
              }}
            >
              <ChallengeLabels
                level={level}
                category={category}
                tag={idea?.tag}
                accent={accent}
              />
              {loading && !idea ? (
                <LoadingState line={LOADING_LINES[loadingLine]} accent={accent} />
              ) : idea ? (
                <>
                  {idea.title && (
                    <h2 className="mb-3 text-xl font-semibold tracking-tight text-white md:text-2xl">
                      {idea.title}
                    </h2>
                  )}
                  <p className="text-lg font-light leading-relaxed text-neutral-200 md:text-xl">
                    {idea.body}
                  </p>
                  {loading && (
                    <p className="mt-6 text-sm text-neutral-500">{LOADING_LINES[loadingLine]}</p>
                  )}
                </>
              ) : (
                <LoadingState line={error ?? LOADING_LINES[loadingLine]} accent={accent} />
              )}
            </div>

            <button
              type="button"
              onClick={generateNext}
              disabled={loading}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border py-3.5 text-sm font-medium disabled:opacity-40"
              style={{ borderColor: accent, color: accent }}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Conjuring…" : "Generate a new one"}
            </button>

            <button
              type="button"
              onClick={flipPerson}
              disabled={loading}
              className="mt-3 text-sm text-neutral-500 underline-offset-4 transition hover:text-neutral-300 hover:underline disabled:opacity-40"
            >
              Flip challenges to {otherName}
            </button>

            {error && idea && (
              <p className="mt-4 rounded-full bg-rose-500/20 px-4 py-1.5 text-sm text-rose-100">
                {error}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ChallengeLabels({
  level,
  category,
  tag,
  accent,
}: {
  level: number;
  category: SparkCategory | null;
  tag?: string;
  accent: string;
}) {
  const i = Math.min(3, Math.max(0, level - 1));
  return (
    <div className="mb-5">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider"
          style={{ borderColor: `${accent}66`, color: accent }}
        >
          <span>{LEVEL_BADGES[i]}</span>
          <span>
            {LEVEL_MARKS[i]} · {LEVEL_NAMES[i]}
          </span>
        </span>
        {tag && (
          <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-neutral-500">
            {tag}
          </span>
        )}
      </div>
      {category && (
        <div className="mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
            Random category
          </p>
          <p className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl" style={{ color: accent }}>
            {category.name}
          </p>
        </div>
      )}
    </div>
  );
}

function LoadingState({ line, accent }: { line: string; accent: string }) {
  return (
    <div className="flex flex-col items-center py-8 text-center">
      <Flame className="mb-5 h-10 w-10 animate-pulse" style={{ color: accent }} />
      <p className="text-lg font-light text-neutral-300">{line}</p>
    </div>
  );
}
