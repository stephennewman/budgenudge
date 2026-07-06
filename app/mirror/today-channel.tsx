"use client";

import { useEffect, useMemo, useState } from "react";
import { Cake, ExternalLink, Landmark, Newspaper, PartyPopper, X } from "lucide-react";
import { cn } from "@/utils/styles";

// "Today" channel for the mirror: news headlines organized by category, with
// the day's progress, fun national days, and a sprinkle of on-this-day
// history and birthdays. Rendered as a full channel (no widget grid).

type NationalDay = { name: string; url: string | null };
type HistoryItem = { year: number; text: string; url: string | null };
type BirthItem = { year: number; name: string; description: string | null };
type NewsItem = { title: string; link: string | null };
type NewsSection = { id: string; label: string; items: NewsItem[] };

type Reader = {
  headline: string; // RSS title, shown immediately while the body loads
  sectionLabel: string;
  url: string;
  paragraphs: string[] | null; // null = loading
};

// Headlines per category card.
const HEADLINES_SHOWN = 3;

// Accent color per news category.
const SECTION_ACCENT: Record<string, { icon: string; dot: string }> = {
  top: { icon: "bg-sky-400/25 text-sky-200", dot: "bg-sky-300/70" },
  politics: { icon: "bg-rose-400/25 text-rose-200", dot: "bg-rose-300/70" },
  business: { icon: "bg-emerald-400/25 text-emerald-200", dot: "bg-emerald-300/70" },
  technology: { icon: "bg-violet-400/25 text-violet-200", dot: "bg-violet-300/70" },
  science: { icon: "bg-cyan-400/25 text-cyan-200", dot: "bg-cyan-300/70" },
  culture: { icon: "bg-amber-400/25 text-amber-200", dot: "bg-amber-300/70" },
  sports: { icon: "bg-orange-400/25 text-orange-200", dot: "bg-orange-300/70" },
};

const CHIP_STYLES = [
  "bg-amber-400/25 text-amber-100",
  "bg-rose-400/25 text-rose-100",
  "bg-sky-400/25 text-sky-100",
  "bg-emerald-400/25 text-emerald-100",
  "bg-violet-400/25 text-violet-100",
  "bg-orange-400/25 text-orange-100",
];

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function TodayChannel({
  onHoldRotation,
}: {
  // Lets the mirror pause channel auto-rotation while an article is open.
  onHoldRotation?: (hold: boolean) => void;
}) {
  const today = useMemo(() => new Date(), []);
  const todayIso = isoDate(today);

  const [nationalDays, setNationalDays] = useState<NationalDay[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [births, setBirths] = useState<BirthItem[]>([]);
  const [newsSections, setNewsSections] = useState<NewsSection[]>([]);
  const [reader, setReader] = useState<Reader | null>(null);

  useEffect(() => {
    onHoldRotation?.(reader !== null);
    return () => onHoldRotation?.(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reader !== null]);

  const openArticle = (item: NewsItem, sectionLabel: string) => {
    if (!item.link) return;
    const url = item.link;
    setReader({ headline: item.title, sectionLabel, url, paragraphs: null });
    fetch(`/api/mirror/article?url=${encodeURIComponent(url)}`)
      .then((res) => (res.ok ? res.json() : { paragraphs: [] }))
      .then((d) => {
        setReader((r) =>
          // Ignore stale responses if another headline was opened meanwhile.
          r && r.url === url ? { ...r, paragraphs: d.paragraphs ?? [] } : r
        );
      })
      .catch(() => {
        setReader((r) => (r && r.url === url ? { ...r, paragraphs: [] } : r));
      });
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      const [todayRes, newsRes] = await Promise.allSettled([
        fetch(`/api/mirror/today?date=${todayIso}`),
        fetch("/api/mirror/news?sections=1"),
      ]);
      if (!active) return;
      if (todayRes.status === "fulfilled" && todayRes.value.ok) {
        const d = await todayRes.value.json();
        setNationalDays((d.nationalDays ?? []).slice(0, 6));
        setHistory((d.history ?? []).slice(0, 4));
        setBirths((d.births ?? []).slice(0, 4));
      }
      if (newsRes.status === "fulfilled" && newsRes.value.ok) {
        const d = await newsRes.value.json();
        setNewsSections(d.sections ?? []);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [todayIso]);

  const startOfYear = new Date(today.getFullYear(), 0, 1);
  const dayOfYear =
    Math.floor((today.getTime() - startOfYear.getTime()) / 86_400_000) + 1;
  const isLeap = new Date(today.getFullYear(), 1, 29).getDate() === 29;
  const daysInYear = isLeap ? 366 : 365;
  const yearPct = Math.round((dayOfYear / daysInYear) * 100);

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {/* Day progress + national days, one compact strip */}
      <div className="rounded-3xl border border-white/10 bg-white/15 p-5 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <span className="text-sm font-medium text-white/85">
            Day {dayOfYear} of {daysInYear}
          </span>
          <span className="text-sm text-white/55">
            {daysInYear - dayOfYear} days left in {today.getFullYear()}
          </span>
        </div>
        <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-400/80 to-violet-400/80"
            style={{ width: `${yearPct}%` }}
          />
        </div>
        {nationalDays.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/60">
              <PartyPopper className="h-3.5 w-3.5 text-amber-300/90" />
              Today is
            </span>
            {nationalDays.map((d, i) => (
              <span
                key={d.name}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium",
                  CHIP_STYLES[i % CHIP_STYLES.length]
                )}
              >
                {d.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* News, organized by category */}
      {newsSections.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/15 p-6 text-sm text-white/50 backdrop-blur-md">
          Loading today&apos;s news…
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {newsSections.map((s) => {
            const accent = SECTION_ACCENT[s.id] ?? SECTION_ACCENT.top;
            return (
              <div
                key={s.id}
                className="rounded-3xl border border-white/10 bg-white/15 p-5 backdrop-blur-md"
              >
                <div className="mb-3 flex items-center gap-2">
                  <span
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-lg",
                      accent.icon
                    )}
                  >
                    <Newspaper className="h-4 w-4" />
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-white/70">
                    {s.label}
                  </span>
                </div>
                <ul className="space-y-1">
                  {s.items.slice(0, HEADLINES_SHOWN).map((n, i) => (
                    <li key={i}>
                      <button
                        onClick={() => openArticle(n, s.label)}
                        disabled={!n.link}
                        className="flex w-full items-start gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/10"
                      >
                        <span
                          className={cn(
                            "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                            accent.dot
                          )}
                        />
                        <span className="text-sm leading-snug text-white/85">
                          {n.title}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}

          {/* Fun sprinkles alongside the news cards */}
          {history.length > 0 && (
            <div className="rounded-3xl border border-white/10 bg-white/15 p-5 backdrop-blur-md">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-400/25 text-violet-200">
                  <Landmark className="h-4 w-4" />
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-white/70">
                  On this day
                </span>
              </div>
              <ul className="space-y-3">
                {history.map((h, i) => (
                  <li key={i} className="flex gap-2.5">
                    <span className="mt-0.5 shrink-0 rounded-md bg-violet-400/20 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-violet-200">
                      {h.year}
                    </span>
                    <span className="text-sm leading-snug text-white/85">{h.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {births.length > 0 && (
            <div className="rounded-3xl border border-white/10 bg-white/15 p-5 backdrop-blur-md">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-400/25 text-rose-200">
                  <Cake className="h-4 w-4" />
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-white/70">
                  Born on this day
                </span>
              </div>
              <ul className="space-y-2.5">
                {births.map((b, i) => (
                  <li key={i} className="text-sm leading-snug">
                    <span className="font-medium text-white/90">{b.name}</span>
                    <span className="text-white/55">
                      {" "}
                      · {today.getFullYear() - b.year}
                      {b.description ? ` · ${b.description}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Slide-out article reader */}
      {reader && (
        <>
          <button
            className="fixed inset-0 z-40 cursor-default bg-black/40 backdrop-blur-[2px]"
            aria-label="Close article"
            onClick={() => setReader(null)}
          />
          <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-white/15 bg-slate-900/95 shadow-2xl backdrop-blur-xl">
            <div className="flex items-start justify-between gap-3 border-b border-white/10 p-5">
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-wider text-white/50">
                  {reader.sectionLabel}
                </div>
                <h2 className="mt-1 text-lg font-semibold leading-snug text-white/95">
                  {reader.headline}
                </h2>
              </div>
              <button
                onClick={() => setReader(null)}
                aria-label="Close"
                className="shrink-0 rounded-full bg-white/10 p-2 text-white/70 transition hover:bg-white/20 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {reader.paragraphs === null ? (
                <p className="text-sm text-white/50">Loading article…</p>
              ) : reader.paragraphs.length === 0 ? (
                <p className="text-sm text-white/60">
                  Couldn&apos;t load the article text here — use the link below to
                  read it at the source.
                </p>
              ) : (
                <div className="space-y-4">
                  {reader.paragraphs.map((p, i) => (
                    <p key={i} className="text-[15px] leading-relaxed text-white/85">
                      {p}
                    </p>
                  ))}
                </div>
              )}
            </div>
            <div className="border-t border-white/10 p-4">
              <a
                href={reader.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-white/85 transition hover:bg-white/20"
              >
                Read at source <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
