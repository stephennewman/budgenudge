"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  EyeOff,
  MapPin,
  MoreVertical,
  Ticket,
  X,
} from "lucide-react";
import { cn } from "@/utils/styles";

// Split-view events browser: compact month calendar with event-name chips on
// the left, a sortable/filterable feed on the right. Merges the two mirror
// sources — Ticketmaster (ticketed, ~45 days out) and the weekly "Around
// Town" snapshot (hyperlocal, ~14 days out).

const DAYS_OUT = 45;
const STORAGE_KEY = "mirror.location"; // same saved location as the mirror
const HIDDEN_KEY = "mirror.events.hidden"; // per-card curation, persisted locally

type MirrorEvent = {
  name: string;
  localDate: string;
  localTime: string | null;
  venue: string | null;
  city: string | null;
  distanceMiles: number | null;
  category: string | null;
  genre: string | null;
  priceMin: number | null;
  url: string | null;
};

type LocalItem = {
  title: string;
  date: string | null;
  schedule: string | null;
  time: string | null;
  venue: string | null;
  town: string | null;
  kind: "event" | "special";
  source: string | null;
};

type MediaItem = {
  type: "movie" | "tv";
  title: string;
  year: string | null;
  poster: string | null;
  tmdbScore: number | null;
  rtScore: string | null;
};

type CalEvent = {
  date: string; // YYYY-MM-DD
  time: string | null; // display string
  sortKey: string; // orders events within a day
  name: string;
  venue: string | null; // venue name only (for the venue filter)
  where: string | null;
  distanceMiles: number | null;
  category: string; // segment-level bucket used for filtering/coloring
  genre: string | null; // finer label, display only
  priceMin: number | null;
  url: string | null;
  origin: "ticketed" | "local";
};

type SortMode = "date" | "price" | "distance";
type SourceFilter = "all" | "ticketed" | "local";

// Chip/dot colors per category bucket.
const CATEGORY_STYLE: Record<string, { chip: string; dot: string }> = {
  Music: { chip: "bg-violet-400/30 text-violet-100", dot: "bg-violet-300" },
  Sports: { chip: "bg-emerald-400/30 text-emerald-100", dot: "bg-emerald-300" },
  "Arts & Theatre": { chip: "bg-rose-400/30 text-rose-100", dot: "bg-rose-300" },
  Family: { chip: "bg-amber-400/30 text-amber-100", dot: "bg-amber-300" },
  Film: { chip: "bg-sky-400/30 text-sky-100", dot: "bg-sky-300" },
  Local: { chip: "bg-cyan-400/30 text-cyan-100", dot: "bg-cyan-300" },
  Other: { chip: "bg-slate-400/30 text-slate-100", dot: "bg-slate-300" },
};

function categoryStyle(category: string) {
  return CATEGORY_STYLE[category] ?? CATEGORY_STYLE.Other;
}

function fmtTime(localTime: string | null): string | null {
  if (!localTime) return null;
  const [h, m] = localTime.split(":").map(Number);
  if (Number.isNaN(h)) return localTime;
  const d = new Date();
  d.setHours(h, m || 0, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function dayHeading(date: string, opts?: { short?: boolean }): string {
  const d = new Date(date + "T12:00:00");
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 86_400_000);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, tomorrow)) return "Tomorrow";
  return d.toLocaleDateString(undefined, {
    weekday: opts?.short ? "short" : "long",
    month: opts?.short ? "short" : "long",
    day: "numeric",
  });
}

export default function MirrorEventsPage() {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [specials, setSpecials] = useState<LocalItem[]>([]);
  const [movies, setMovies] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);

  // View state.
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [monthOffset, setMonthOffset] = useState(0);
  const [source, setSource] = useState<SourceFilter>("all");
  const [category, setCategory] = useState<string | null>(null);
  const [venue, setVenue] = useState<string | null>(null);
  const [sort, setSort] = useState<SortMode>("date");

  // Hidden events (curation). "names" hides every occurrence of an event by
  // name; "occurrences" hides a single date|name instance. Persisted locally.
  const [hidden, setHidden] = useState<{ names: Set<string>; occurrences: Set<string> }>(
    () => ({ names: new Set(), occurrences: new Set() })
  );
  const [showHidden, setShowHidden] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HIDDEN_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { names?: string[]; occurrences?: string[] };
        setHidden({
          names: new Set(parsed.names ?? []),
          occurrences: new Set(parsed.occurrences ?? []),
        });
      }
    } catch {
      /* start fresh */
    }
  }, []);

  const updateHidden = (fn: (prev: { names: Set<string>; occurrences: Set<string> }) => {
    names: Set<string>;
    occurrences: Set<string>;
  }) => {
    setHidden((prev) => {
      const next = fn(prev);
      try {
        localStorage.setItem(
          HIDDEN_KEY,
          JSON.stringify({ names: [...next.names], occurrences: [...next.occurrences] })
        );
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  };

  const isHidden = (ev: CalEvent) =>
    hidden.names.has(ev.name) || hidden.occurrences.has(`${ev.date}|${ev.name}`);

  const hideEvent = (ev: CalEvent, mode: "occurrence" | "always") =>
    updateHidden((prev) => {
      const names = new Set(prev.names);
      const occurrences = new Set(prev.occurrences);
      if (mode === "always") names.add(ev.name);
      else occurrences.add(`${ev.date}|${ev.name}`);
      return { names, occurrences };
    });

  const unhideEvent = (ev: CalEvent) =>
    updateHidden((prev) => {
      const names = new Set(prev.names);
      const occurrences = new Set(prev.occurrences);
      names.delete(ev.name);
      occurrences.delete(`${ev.date}|${ev.name}`);
      return { names, occurrences };
    });

  // Scroll-spy: the sticky filter bar shows the day currently at the top of
  // the feed, updating as day groups scroll past.
  const controlsRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());
  const [activeDay, setActiveDay] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      let qs = `?days=${DAYS_OUT}`;
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const loc = JSON.parse(raw) as { lat?: number; lon?: number };
          if (loc.lat && loc.lon) qs += `&lat=${loc.lat}&lon=${loc.lon}`;
        }
      } catch {
        /* server default (Palm Harbor) */
      }

      try {
        const [tmRes, localRes, moviesRes] = await Promise.all([
          fetch(`/api/mirror/events${qs}`),
          fetch("/api/mirror/local"),
          fetch("/api/mirror/movies"),
        ]);
        const tm = tmRes.ok ? await tmRes.json() : { items: [] };
        const loc = localRes.ok ? await localRes.json() : { items: [] };
        const mov = moviesRes.ok ? await moviesRes.json() : { sections: [] };
        if (!active) return;
        const sections = (mov.sections ?? []) as {
          id: string;
          items: MediaItem[];
        }[];
        setMovies(sections.find((s) => s.id === "theaters")?.items ?? []);

        const merged: CalEvent[] = [];
        for (const ev of (tm.items ?? []) as MirrorEvent[]) {
          const bucket =
            ev.category && CATEGORY_STYLE[ev.category] ? ev.category : "Other";
          merged.push({
            date: ev.localDate,
            time: fmtTime(ev.localTime),
            sortKey: ev.localTime ?? "99",
            name: ev.name,
            venue: ev.venue,
            where: [ev.venue, ev.city].filter(Boolean).join(", ") || null,
            distanceMiles: ev.distanceMiles,
            category: bucket,
            genre:
              ev.genre && ev.genre !== "Miscellaneous" && ev.genre !== bucket
                ? ev.genre
                : null,
            priceMin: ev.priceMin,
            url: ev.url,
            origin: "ticketed",
          });
        }
        const localItems = (loc.items ?? []) as LocalItem[];
        for (const it of localItems) {
          if (it.kind === "event" && it.date) {
            merged.push({
              date: it.date,
              time: it.time,
              sortKey: it.time ?? "99",
              name: it.title,
              venue: it.venue,
              where: [it.venue, it.town].filter(Boolean).join(", ") || null,
              distanceMiles: null,
              category: "Local",
              genre: null,
              priceMin: null,
              url: it.source ? `https://${it.source}` : null,
              origin: "local",
            });
          }
        }
        merged.sort((a, b) =>
          a.date === b.date
            ? a.sortKey.localeCompare(b.sortKey)
            : a.date.localeCompare(b.date)
        );
        setEvents(merged);
        setSpecials(localItems.filter((it) => it.kind === "special"));
      } catch {
        /* leave empty */
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  // Stable per mount — the page is a kiosk view that reloads periodically.
  const today = useMemo(() => new Date(), []);
  const todayIso = isoDate(today);

  const byDate = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const ev of events) {
      if (isHidden(ev)) continue;
      const list = map.get(ev.date) ?? [];
      list.push(ev);
      map.set(ev.date, list);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, hidden]);

  const categories = useMemo(() => {
    const present = new Set(events.map((e) => e.category));
    // Stable order: known buckets first, in the style map's order.
    return Object.keys(CATEGORY_STYLE).filter((c) => present.has(c));
  }, [events]);

  // Venues ranked by upcoming event count (Tropicana Field, Jannus Live, ...).
  const venues = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of events) {
      if (e.date < todayIso || !e.venue) continue;
      counts.set(e.venue, (counts.get(e.venue) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 40);
  }, [events, todayIso]);

  // Count of upcoming events currently hidden (drives the "Hidden" pill).
  const hiddenCount = useMemo(
    () => events.filter((e) => e.date >= todayIso && isHidden(e)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, todayIso, hidden]
  );

  // Feed after filters + sort.
  const filtered = useMemo(() => {
    let out = events.filter((e) => e.date >= todayIso);
    out = out.filter((e) => (showHidden ? isHidden(e) : !isHidden(e)));
    if (selectedDate) out = out.filter((e) => e.date === selectedDate);
    if (source !== "all") out = out.filter((e) => e.origin === source);
    if (category) out = out.filter((e) => e.category === category);
    if (venue) out = out.filter((e) => e.venue === venue);

    if (sort === "price") {
      out = [...out].sort((a, b) => {
        if (a.priceMin === null && b.priceMin === null) return a.date.localeCompare(b.date);
        if (a.priceMin === null) return 1;
        if (b.priceMin === null) return -1;
        return a.priceMin - b.priceMin || a.date.localeCompare(b.date);
      });
    } else if (sort === "distance") {
      out = [...out].sort((a, b) => {
        if (a.distanceMiles === null && b.distanceMiles === null)
          return a.date.localeCompare(b.date);
        if (a.distanceMiles === null) return 1;
        if (b.distanceMiles === null) return -1;
        return a.distanceMiles - b.distanceMiles || a.date.localeCompare(b.date);
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, todayIso, selectedDate, source, category, venue, sort, hidden, showHidden]);

  // Date sort keeps day-heading groups; price/distance sorts render flat.
  const grouped = useMemo(() => {
    if (sort !== "date") return null;
    const out: { date: string; items: CalEvent[] }[] = [];
    for (const ev of filtered) {
      const last = out[out.length - 1];
      if (last && last.date === ev.date) last.items.push(ev);
      else out.push({ date: ev.date, items: [ev] });
    }
    return out;
  }, [filtered, sort]);

  // Track which day group is under the sticky bar while scrolling.
  useEffect(() => {
    if (!grouped || grouped.length === 0) {
      setActiveDay(null);
      return;
    }
    let raf = 0;
    const compute = () => {
      raf = 0;
      const barBottom =
        (controlsRef.current?.getBoundingClientRect().bottom ?? 0) + 12;
      let current: string | null = null;
      for (const { date } of grouped) {
        const el = sectionRefs.current.get(date);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= barBottom) current = date;
        else break;
      }
      setActiveDay(current ?? grouped[0]?.date ?? null);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(compute);
    };
    compute();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [grouped]);

  // Calendar month being displayed (bounded by today .. today + DAYS_OUT).
  const maxMonthOffset = useMemo(() => {
    const end = new Date(today.getTime() + DAYS_OUT * 86_400_000);
    return (
      (end.getFullYear() - today.getFullYear()) * 12 +
      (end.getMonth() - today.getMonth())
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const viewMonth = useMemo(
    () => new Date(today.getFullYear(), today.getMonth() + monthOffset, 1),
    [today, monthOffset]
  );

  const cells = useMemo(() => {
    const first = new Date(viewMonth);
    const out: (Date | null)[] = [];
    for (let i = 0; i < first.getDay(); i++) out.push(null);
    const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    for (let d = 1; d <= days; d++)
      out.push(new Date(first.getFullYear(), first.getMonth(), d));
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [viewMonth]);

  const pill = (active: boolean) =>
    cn(
      "rounded-full px-3 py-1.5 text-xs font-medium transition",
      active ? "bg-white/30 text-white" : "bg-white/10 text-white/65 hover:bg-white/20"
    );

  return (
    <div
      className="min-h-screen w-full text-white antialiased"
      style={{
        background: "linear-gradient(160deg, #020111 0%, #0a1a3f 55%, #20305f 100%)",
      }}
    >
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <header className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-light tracking-tight md:text-3xl">
              Out &amp; About
            </h1>
            <p className="mt-0.5 text-xs text-white/55 md:text-sm">
              Within 50 miles · next {DAYS_OUT} days
            </p>
          </div>
          <Link
            href="/mirror"
            className="flex shrink-0 items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-white/80 backdrop-blur-md transition hover:bg-white/20"
          >
            <ArrowLeft className="h-4 w-4" />
            Mirror
          </Link>
        </header>

        <div className="grid gap-5 md:grid-cols-[minmax(300px,370px)_1fr]">
          {/* Left: compact calendar + weekly specials. The column is pinned,
              so it scrolls internally when taller than the viewport —
              otherwise the specials card below the calendar is unreachable. */}
          <div className="space-y-5 md:sticky md:top-4 md:max-h-[calc(100vh-2rem)] md:self-start md:overflow-y-auto md:pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur-md">
              <div className="mb-3 flex items-center justify-between">
                <button
                  onClick={() => setMonthOffset((m) => Math.max(0, m - 1))}
                  disabled={monthOffset === 0}
                  className="rounded-full p-1.5 transition hover:bg-white/15 disabled:opacity-30"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-xs font-semibold uppercase tracking-wider text-white/85">
                  {viewMonth.toLocaleDateString(undefined, {
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                <button
                  onClick={() => setMonthOffset((m) => Math.min(maxMonthOffset, m + 1))}
                  disabled={monthOffset >= maxMonthOffset}
                  className="rounded-full p-1.5 transition hover:bg-white/15 disabled:opacity-30"
                  aria-label="Next month"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                  <div
                    key={i}
                    className="pb-1 text-center text-[10px] font-semibold text-white/40"
                  >
                    {d}
                  </div>
                ))}
                {cells.map((d, i) => {
                  if (!d) return <div key={i} />;
                  const iso = isoDate(d);
                  const isPast = iso < todayIso;
                  const dayEvents = isPast ? [] : byDate.get(iso) ?? [];
                  const isToday = iso === todayIso;
                  const isSelected = iso === selectedDate;
                  const preview = dayEvents.slice(0, 2);
                  return (
                    <button
                      key={i}
                      onClick={() =>
                        !isPast &&
                        dayEvents.length > 0 &&
                        setSelectedDate(isSelected ? null : iso)
                      }
                      disabled={isPast || dayEvents.length === 0}
                      className={cn(
                        "flex min-h-[52px] flex-col items-stretch gap-0.5 rounded-lg p-1 text-left transition",
                        isPast && "opacity-30",
                        !isPast && dayEvents.length > 0 && "hover:bg-white/10",
                        isToday && !isSelected && "ring-1 ring-white/40",
                        isSelected && "bg-white/20"
                      )}
                    >
                      <span
                        className={cn(
                          "px-0.5 text-[10px] leading-none",
                          isToday ? "font-bold text-white" : "text-white/60"
                        )}
                      >
                        {d.getDate()}
                      </span>
                      {preview.map((ev, j) => (
                        <span
                          key={j}
                          className={cn(
                            "truncate rounded px-1 py-px text-[8px] leading-tight",
                            categoryStyle(ev.category).chip
                          )}
                        >
                          {ev.name}
                        </span>
                      ))}
                      {dayEvents.length > 2 && (
                        <span className="px-0.5 text-[8px] leading-none text-white/50">
                          +{dayEvents.length - 2} more
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {specials.length > 0 && (
              <div className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur-md">
                <div className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-amber-200/85">
                  Weekly specials
                </div>
                <ul className="space-y-2">
                  {specials.map((it, i) => (
                    <li key={`${it.title}-${i}`} className="text-sm">
                      <span className="block text-white/90">
                        {it.schedule ? `${it.schedule}: ` : ""}
                        {it.title}
                      </span>
                      <span className="block text-xs text-white/55">
                        {[it.time, [it.venue, it.town].filter(Boolean).join(", ")]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {movies.length > 0 && (
              <div className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur-md">
                <div className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-fuchsia-200/85">
                  In theaters
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {movies.slice(0, 6).map((m) => (
                    <div key={m.title} className="min-w-0">
                      {m.poster ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.poster}
                          alt={m.title}
                          className="aspect-[2/3] w-full rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex aspect-[2/3] w-full items-center justify-center rounded-lg bg-white/10 p-1 text-center text-[10px] text-white/60">
                          {m.title}
                        </div>
                      )}
                      <div className="mt-1 truncate text-[11px] text-white/85">
                        {m.title}
                      </div>
                      <div className="text-[10px] text-white/50">
                        {m.rtScore
                          ? `🍅 ${m.rtScore}`
                          : m.tmdbScore !== null
                            ? `${m.tmdbScore}%`
                            : ""}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: filter/sort controls + feed */}
          <div className="min-w-0">
            <div
              ref={controlsRef}
              className="sticky top-0 z-30 -mx-1 mb-4 space-y-2.5 rounded-b-2xl bg-[#0a1533]/85 px-1 pb-3 pt-3 backdrop-blur-md"
            >
              <div className="flex flex-wrap items-center gap-2">
                {(
                  [
                    ["all", "All sources"],
                    ["ticketed", "Ticketed"],
                    ["local", "Around town"],
                  ] as [SourceFilter, string][]
                ).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setSource(value)}
                    className={pill(source === value)}
                  >
                    {label}
                  </button>
                ))}
                <span className="mx-1 h-4 w-px bg-white/15" />
                <span className="text-[11px] uppercase tracking-wider text-white/45">
                  Sort
                </span>
                {(
                  [
                    ["date", "Date"],
                    ["price", "Price"],
                    ["distance", "Distance"],
                  ] as [SortMode, string][]
                ).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setSort(value)}
                    className={pill(sort === value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={venue ?? ""}
                  onChange={(e) => setVenue(e.target.value || null)}
                  className={cn(
                    "max-w-[220px] appearance-none rounded-full px-3 py-1.5 text-xs font-medium outline-none transition",
                    venue
                      ? "bg-white/30 text-white"
                      : "bg-white/10 text-white/65 hover:bg-white/20"
                  )}
                >
                  <option value="" className="bg-slate-900 text-white">
                    All venues
                  </option>
                  {venues.map(([name, count]) => (
                    <option key={name} value={name} className="bg-slate-900 text-white">
                      {name} ({count})
                    </option>
                  ))}
                </select>
                <button onClick={() => setCategory(null)} className={pill(!category)}>
                  All categories
                </button>
                {categories.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategory(category === c ? null : c)}
                    className={cn(
                      pill(category === c),
                      "flex items-center gap-1.5"
                    )}
                  >
                    <span
                      className={cn("h-1.5 w-1.5 rounded-full", categoryStyle(c).dot)}
                    />
                    {c}
                  </button>
                ))}
                {selectedDate && (
                  <button
                    onClick={() => setSelectedDate(null)}
                    className="flex items-center gap-1.5 rounded-full bg-white/25 px-3 py-1.5 text-xs font-medium transition hover:bg-white/35"
                  >
                    {dayHeading(selectedDate, { short: true })}
                    <X className="h-3 w-3" />
                  </button>
                )}
                {(hiddenCount > 0 || showHidden) && (
                  <button
                    onClick={() => setShowHidden((v) => !v)}
                    className={cn(pill(showHidden), "flex items-center gap-1.5")}
                  >
                    <EyeOff className="h-3 w-3" />
                    Hidden ({hiddenCount})
                  </button>
                )}
                <span className="ml-auto text-xs text-white/45">
                  {filtered.length} event{filtered.length === 1 ? "" : "s"}
                </span>
              </div>
              {sort === "date" && !selectedDate && activeDay && (
                <div className="border-t border-white/10 pt-2 text-sm font-semibold text-white/90">
                  {dayHeading(activeDay)}
                  <span className="ml-2 font-normal text-white/45">
                    {new Date(activeDay + "T12:00:00").toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              )}
            </div>

            {loading && <p className="text-white/60">Loading events…</p>}
            {!loading && filtered.length === 0 && (
              <p className="text-white/60">Nothing matches those filters.</p>
            )}

            {grouped ? (
              <div className="space-y-5">
                {grouped.map(({ date, items }) => (
                  <section
                    key={date}
                    ref={(el) => {
                      if (el) sectionRefs.current.set(date, el);
                      else sectionRefs.current.delete(date);
                    }}
                  >
                    <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-white/70">
                      {dayHeading(date)}
                      <span className="ml-2 font-normal normal-case text-white/40">
                        {new Date(date + "T12:00:00").toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </h2>
                    <ul className="space-y-2">
                      {items.map((ev, i) => (
                        <EventRow
                          key={`${ev.name}-${i}`}
                          ev={ev}
                          hiddenView={showHidden}
                          onHide={hideEvent}
                          onUnhide={unhideEvent}
                        />
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            ) : (
              <ul className="space-y-2">
                {filtered.map((ev, i) => (
                  <EventRow
                    key={`${ev.name}-${i}`}
                    ev={ev}
                    showDate
                    hiddenView={showHidden}
                    onHide={hideEvent}
                    onUnhide={unhideEvent}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EventRow({
  ev,
  showDate,
  hiddenView,
  onHide,
  onUnhide,
}: {
  ev: CalEvent;
  showDate?: boolean;
  hiddenView?: boolean;
  onHide: (ev: CalEvent, mode: "occurrence" | "always") => void;
  onUnhide: (ev: CalEvent) => void;
}) {
  const style = categoryStyle(ev.category);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  const menuItem =
    "flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-white/85 transition hover:bg-white/15";

  return (
    <li
      className={cn(
        "rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-md",
        hiddenView && "opacity-70"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg",
                ev.origin === "ticketed"
                  ? "bg-lime-400/25 text-lime-200"
                  : "bg-cyan-400/25 text-cyan-200"
              )}
            >
              {ev.origin === "ticketed" ? (
                <Ticket className="h-3.5 w-3.5" />
              ) : (
                <MapPin className="h-3.5 w-3.5" />
              )}
            </span>
            <span className="truncate font-medium text-white/95">{ev.name}</span>
          </div>
          <div className="mt-1.5 text-sm text-white/65">
            {[
              showDate ? dayHeading(ev.date, { short: true }) : null,
              ev.time,
              ev.where,
              ev.distanceMiles !== null ? `${ev.distanceMiles} mi` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider",
                style.chip
              )}
            >
              {ev.category}
            </span>
            {ev.genre && (
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/60">
                {ev.genre}
              </span>
            )}
            {ev.priceMin !== null && (
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/60">
                from ${Math.round(ev.priceMin)}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {ev.url && (
            <a
              href={ev.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/80 transition hover:bg-white/20"
            >
              {ev.origin === "ticketed" ? "Tickets" : "Info"}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          <div ref={menuRef} className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="rounded-full p-1.5 text-white/60 transition hover:bg-white/15 hover:text-white/90"
              aria-label="Event options"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full z-40 mt-1 w-48 overflow-hidden rounded-xl border border-white/15 bg-[#131f42] shadow-xl">
                {hiddenView ? (
                  <button
                    className={menuItem}
                    onClick={() => {
                      setMenuOpen(false);
                      onUnhide(ev);
                    }}
                  >
                    <EyeOff className="h-3.5 w-3.5" />
                    Unhide
                  </button>
                ) : (
                  <>
                    <button
                      className={menuItem}
                      onClick={() => {
                        setMenuOpen(false);
                        onHide(ev, "occurrence");
                      }}
                    >
                      <EyeOff className="h-3.5 w-3.5" />
                      Hide this date
                    </button>
                    <button
                      className={menuItem}
                      onClick={() => {
                        setMenuOpen(false);
                        onHide(ev, "always");
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                      Hide always
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
