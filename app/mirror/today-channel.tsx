"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Newspaper, X } from "lucide-react";

// "News" channel for the mirror: one big card with the top news stories as
// glanceable bullet points (tap to read in place).

type NewsItem = { title: string; link: string | null };
type NewsSection = { id: string; label: string; items: NewsItem[] };

type Reader = {
  headline: string; // RSS title, shown immediately while the body loads
  sectionLabel: string;
  url: string;
  paragraphs: string[] | null; // null = loading
};

// Headlines shown as bullet points.
const HEADLINES_SHOWN = 3;

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
      const newsRes = await fetch("/api/mirror/news?sections=1").catch(
        () => null
      );
      if (!active || !newsRes || !newsRes.ok) return;
      const d = await newsRes.json();
      setNewsSections(d.sections ?? []);
    };
    load();
    return () => {
      active = false;
    };
  }, [todayIso]);

  const topSection =
    newsSections.find((s) => s.id === "top") ?? newsSections[0] ?? null;

  const cardShell =
    "flex h-full min-h-0 flex-col rounded-3xl border border-white/10 bg-white/15 p-8 backdrop-blur-md";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* One big card: top stories as bullet points */}
      <div className={cardShell}>
        <div className="mb-6 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-400/25 text-sky-200">
            <Newspaper className="h-4 w-4" />
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-white/70">
            Top stories
          </span>
        </div>
        {topSection ? (
          <ul className="flex min-h-0 flex-1 flex-col justify-center gap-4 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {topSection.items.slice(0, HEADLINES_SHOWN).map((n, i) => (
              <li key={i}>
                <button
                  onClick={() => openArticle(n, "Top stories")}
                  disabled={!n.link}
                  className="flex w-full items-start gap-4 rounded-xl px-3 py-3 text-left transition hover:bg-white/10"
                >
                  <span className="mt-4 h-2 w-2 shrink-0 rounded-full bg-sky-300/70" />
                  <span className="text-[30px] font-medium leading-snug text-white/90">
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
