"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Newspaper, PartyPopper, X } from "lucide-react";
import { cn } from "@/utils/styles";

// "Today" channel for the mirror: two glanceable columns — the day's progress
// with its national days, and the top news stories (tap to read in place).

type NationalDay = { name: string; url: string | null };
type NewsItem = { title: string; link: string | null };
type NewsSection = { id: string; label: string; items: NewsItem[] };

type Reader = {
  headline: string; // RSS title, shown immediately while the body loads
  sectionLabel: string;
  url: string;
  paragraphs: string[] | null; // null = loading
};

// Headlines shown in the top-stories column.
const HEADLINES_SHOWN = 3;

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
        setNationalDays((d.nationalDays ?? []).slice(0, 4));
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

  const topSection =
    newsSections.find((s) => s.id === "top") ?? newsSections[0] ?? null;

  const cardShell =
    "flex h-full min-h-0 flex-col rounded-3xl border border-white/10 bg-white/15 p-6 backdrop-blur-md";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-2">
        {/* Column 1: day progress + national days */}
        <div className={cardShell}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <span className="text-xl font-semibold text-white/90 md:text-2xl">
              Day {dayOfYear} of {daysInYear}
            </span>
            <span className="text-sm text-white/55">
              {daysInYear - dayOfYear} days left in {today.getFullYear()}
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-400/80 to-violet-400/80"
              style={{ width: `${yearPct}%` }}
            />
          </div>
          {nationalDays.length > 0 && (
            <div className="mt-6">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/60">
                <PartyPopper className="h-3.5 w-3.5 text-amber-300/90" />
                Today is
              </span>
              <div className="mt-3 flex flex-wrap items-center gap-2.5">
                {nationalDays.map((d, i) => (
                  <span
                    key={d.name}
                    className={cn(
                      "rounded-full px-4 py-1.5 text-sm font-medium md:text-base",
                      CHIP_STYLES[i % CHIP_STYLES.length]
                    )}
                  >
                    {d.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Column 2: top stories */}
        <div className={cardShell}>
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-400/25 text-sky-200">
              <Newspaper className="h-4 w-4" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-white/70">
              Top stories
            </span>
          </div>
          {topSection ? (
            <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {topSection.items.slice(0, HEADLINES_SHOWN).map((n, i) => (
                <li key={i}>
                  <button
                    onClick={() => openArticle(n, "Top stories")}
                    disabled={!n.link}
                    className="flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-white/10"
                  >
                    <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-300/70" />
                    <span className="text-base font-medium leading-snug text-white/90 md:text-lg">
                      {n.title}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-white/50">Loading today&apos;s news…</div>
          )}
        </div>
      </div>

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
