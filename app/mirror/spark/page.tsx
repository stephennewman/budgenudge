"use client";

// Spark — a hidden page for two.
//
// Locked state: heavily blurred content behind a field of colored dots. Only
// two dots do anything — double-tap the pink dot to unlock Whitney's deck,
// double-tap the teal dot to unlock Stephen's. Every other dot is a decoy.
// A single tap anywhere while unlocked on the lock button re-blurs instantly.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

type Person = "stephen" | "whitney";

interface SparkIdea {
  title: string;
  body: string;
}

// ---------------------------------------------------------------------------
// Starter decks — shown immediately on unlock; "New batch" pulls fresh, hotter
// material from the generator API.
// ---------------------------------------------------------------------------

const STARTER: Record<Person, SparkIdea[]> = {
  stephen: [
    {
      title: "The Long Game",
      body: "Text Whitney one sentence this morning describing exactly what you plan to do to her tonight. Then don't touch her all day — not once — until the kids are down.",
    },
    {
      title: "Hands Behind Your Back",
      body: "Tonight you don't get to use your hands. Mouth only, everywhere she lets you, until she says otherwise.",
    },
    {
      title: "The Edge",
      body: "Take her right to the brink three times before you let her finish. Make her ask for it — properly.",
    },
    {
      title: "Shower Intercept",
      body: "Next time she showers, join her uninvited. Wash her hair slowly, then let your hands wander until the water runs cold.",
    },
    {
      title: "Solo Study",
      body: "Next time you have the house to yourself, take your time alone thinking only about her — and pay attention to what gets you there fastest. Tell her about it later, in detail.",
    },
    {
      title: "The Chair",
      body: "Sit her on your lap facing away, in front of a mirror. Make her watch. Don't let her look away.",
    },
  ],
  whitney: [
    {
      title: "Wear It All Day",
      body: "Put on the underwear you know he loves — under the most boring errand outfit you own. Tell him at dinner what he's been sitting across from all day.",
    },
    {
      title: "The Voice Note",
      body: "Send Stephen a voice message whispering one thing you want him to do to you tonight. Delete-after-listen optional. Follow-through is not.",
    },
    {
      title: "You Set the Pace",
      body: "Tonight he doesn't move unless you tell him to. Put him exactly where you want him and take what you want at your speed.",
    },
    {
      title: "Ten Minutes Early",
      body: "Get in bed ten minutes before him — and don't wait. Let him walk in and find you already started.",
    },
    {
      title: "The Countdown",
      body: "Text him a number at noon: how many hours until you plan to have him. Update him every couple of hours. No other explanation.",
    },
    {
      title: "Blindfold Him",
      body: "He wears the blindfold tonight. Take your time — make him guess what's coming next and get it wrong.",
    },
  ],
};

// ---------------------------------------------------------------------------

const PINK = "#ec4899";
const TEAL = "#14b8a6";

const DOUBLE_TAP_MS = 450;

// With no touches for this long, the page bails back to the mirror rotation
// (which also relocks it, since all state lives in the component).
const IDLE_SECONDS = 30;

// What each fire level asks the generator for (mirrors HEAT_LABELS in the API).
const HEAT_NAMES = ["Flirty", "Explicit", "No limits"];

// Rotates on the loading card while a batch generates (~10-17s).
const LOADING_LINES = [
  "Conjuring…",
  "Turning up the heat…",
  "Consulting the naughty archives…",
  "Locking the bedroom door…",
  "Finding just the right amount of trouble…",
  "Almost there…",
];

export default function SparkPage() {
  const [person, setPerson] = useState<Person | null>(null);
  const [deck, setDeck] = useState<SparkIdea[]>([]);
  const [index, setIndex] = useState(0);
  const [heat, setHeat] = useState(2);
  const [loading, setLoading] = useState(false);
  const [loadingLine, setLoadingLine] = useState(0);
  const [genError, setGenError] = useState(false);
  const lastTap = useRef<{ id: string; at: number }>({ id: "", at: 0 });
  const [idleLeft, setIdleLeft] = useState(IDLE_SECONDS);
  const lastActivity = useRef(Date.now());
  const router = useRouter();

  const touch = useCallback(() => {
    lastActivity.current = Date.now();
  }, []);

  // Walk through the loading lines while a batch is generating.
  useEffect(() => {
    if (!loading) return;
    setLoadingLine(0);
    const id = setInterval(
      () => setLoadingLine((l) => Math.min(l + 1, LOADING_LINES.length - 1)),
      2500
    );
    return () => clearInterval(id);
  }, [loading]);

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

  const lock = useCallback(() => {
    setPerson(null);
    setDeck([]);
    setIndex(0);
    setGenError(false);
  }, []);

  const unlock = useCallback((p: Person) => {
    setPerson(p);
    setDeck(shuffle(STARTER[p]));
    setIndex(0);
  }, []);

  // The mirror's teaser card links here with ?p=stephen|whitney after its own
  // double-tap check, so arriving with the param opens that section directly.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("p");
    if (p === "stephen" || p === "whitney") unlock(p);
  }, [unlock]);

  // The ";" and ")" in "Loading ;)" are the secret unlocks: double-tap the
  // semicolon for Stephen, the parenthesis for Whitney.
  const onGlyphTap = useCallback(
    (glyph: "semi" | "paren") => {
      const now = Date.now();
      const isDouble =
        lastTap.current.id === glyph && now - lastTap.current.at < DOUBLE_TAP_MS;
      lastTap.current = { id: glyph, at: now };
      if (!isDouble) return;
      unlock(glyph === "paren" ? "whitney" : "stephen");
    },
    [unlock]
  );

  const generate = useCallback(
    async (heatOverride?: number) => {
      if (!person || loading) return;
      setLoading(true);
      setGenError(false);
      try {
        const res = await fetch("/api/mirror/spark", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            person,
            heat: heatOverride ?? heat,
            avoid: deck.slice(0, 12).map((d) => d.title || d.body.slice(0, 60)),
          }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { ideas: SparkIdea[] };
        if (!data.ideas?.length) throw new Error("empty");
        setDeck(data.ideas);
        setIndex(0);
      } catch {
        setGenError(true);
      } finally {
        setLoading(false);
        touch(); // full reading time after a slow generation
      }
    },
    [person, heat, deck, loading, touch]
  );

  const accent = person === "whitney" ? PINK : TEAL;
  const card = deck[index];

  return (
    <div
      className="min-h-screen bg-neutral-950 text-neutral-100 select-none"
      onPointerDownCapture={touch}
    >
      {person === null ? (
        // ------------------------------ LOCKED ------------------------------
        // Looks like a stuck loading screen. The ";" and ")" are the keys.
        <div className="relative flex h-screen items-center justify-center overflow-hidden">
          {/* Quiet exit back to the mirror (the iPad app has no browser chrome) */}
          <Link
            href="/mirror"
            aria-label="Back to mirror"
            className="absolute left-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full text-neutral-700 transition hover:bg-white/10 hover:text-neutral-400"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>

          {/* Styled like a mirror main-column card. The progress bar is really
              the 30s idle timer: it "finishes loading" right as the page
              returns to the rotation. */}
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/10 p-8 backdrop-blur-md">
            <div className="flex animate-pulse items-center justify-center text-3xl font-light tracking-wide text-neutral-400">
              <span>Loading</span>
              <span
                onPointerDown={() => onGlyphTap("semi")}
                className="cursor-default py-4 pl-1.5"
              >
                ;
              </span>
              <span
                onPointerDown={() => onGlyphTap("paren")}
                className="cursor-default py-4 pr-3"
              >
                )
              </span>
            </div>
            <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-white/40 transition-[width] duration-1000 ease-linear"
                style={{ width: `${((IDLE_SECONDS - idleLeft) / IDLE_SECONDS) * 100}%` }}
              />
            </div>
          </div>
        </div>
      ) : (
        // ----------------------------- UNLOCKED -----------------------------
        <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-6">
          <div className="flex items-center justify-between">
            <div
              className="text-xs font-semibold uppercase tracking-[0.3em]"
              style={{ color: accent }}
            >
              {person === "whitney" ? "For Whitney" : "For Stephen"}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs tabular-nums text-neutral-600">
                {idleLeft}s
              </span>
              <button
                onClick={lock}
                className="rounded-full border border-neutral-700 px-4 py-1.5 text-xs text-neutral-400 hover:text-neutral-200"
              >
                Lock
              </button>
            </div>
          </div>

          {/* Heat selector — controls how far the next generated batch goes */}
          <div className="mt-5 flex items-center gap-2">
            {[1, 2, 3].map((h) => (
              <button
                key={h}
                onClick={() => {
                  setHeat(h);
                  generate(h); // deal a fresh batch at the new heat right away
                }}
                disabled={loading}
                className="rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50"
                style={{
                  backgroundColor: heat === h ? accent : "transparent",
                  color: heat === h ? "#0a0a0a" : "#737373",
                  border: `1px solid ${heat === h ? accent : "#404040"}`,
                }}
              >
                {"\u{1F525}".repeat(h)}
              </button>
            ))}
            <span className="ml-1 text-[11px] text-neutral-500">
              {HEAT_NAMES[heat - 1]} — tap a level for a fresh batch
            </span>
          </div>

          {/* Card (or the loading card while a batch generates) */}
          <div className="mt-6 flex flex-1 flex-col justify-center">
            {loading ? (
              <div
                className="flex min-h-[180px] flex-col items-center justify-center rounded-3xl border bg-neutral-900 p-7"
                style={{ borderColor: `${accent}44`, boxShadow: `0 0 60px ${accent}18` }}
              >
                <div
                  className="h-8 w-8 animate-pulse rounded-full"
                  style={{ backgroundColor: accent, boxShadow: `0 0 24px ${accent}` }}
                />
                <p className="mt-5 animate-pulse text-sm text-neutral-400">
                  {LOADING_LINES[loadingLine]}
                </p>
              </div>
            ) : (
              card && (
                <div
                  className="rounded-3xl border bg-neutral-900 p-7"
                  style={{ borderColor: `${accent}44`, boxShadow: `0 0 60px ${accent}18` }}
                >
                  {card.title && (
                    <div className="text-xl font-bold" style={{ color: accent }}>
                      {card.title}
                    </div>
                  )}
                  <p className="mt-3 text-base leading-relaxed text-neutral-200">
                    {card.body}
                  </p>
                  <div className="mt-6 text-xs text-neutral-600">
                    {index + 1} / {deck.length}
                  </div>
                </div>
              )
            )}
          </div>

          {/* Controls */}
          <div className="mt-6 space-y-3 pb-4">
            <div className="flex gap-3">
              <button
                onClick={() => setIndex((i) => (i - 1 + deck.length) % deck.length)}
                disabled={loading}
                className="flex-1 rounded-2xl border border-neutral-800 py-3 text-sm text-neutral-400 disabled:opacity-40"
              >
                Back
              </button>
              <button
                onClick={() => setIndex((i) => (i + 1) % deck.length)}
                disabled={loading}
                className="flex-[2] rounded-2xl py-3 text-sm font-semibold text-neutral-950 disabled:opacity-40"
                style={{ backgroundColor: accent }}
              >
                Next
              </button>
            </div>
            <button
              onClick={() => generate()}
              disabled={loading}
              className="w-full rounded-2xl border py-3 text-sm font-medium disabled:opacity-50"
              style={{ borderColor: accent, color: accent }}
            >
              {loading ? "Conjuring..." : "New batch"}
            </button>
            {genError && (
              <div className="text-center text-xs text-neutral-500">
                Generator unavailable — enjoying the house deck instead.
              </div>
            )}
          </div>
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
