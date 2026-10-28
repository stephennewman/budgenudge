"use client";

import { useEffect, useState } from "react";
import { CalendarDays, PartyPopper } from "lucide-react";
import { cn } from "@/utils/styles";
import type { HolidayItem, NationalDay } from "@/app/api/mirror/today/route";

// "Today" channel: pacing through the year, today's holidays (fun national
// days + observances).

type TodayData = {
  nationalDays: NationalDay[];
  holidays: HolidayItem[];
};

// The channel remounts every time it rotates in; keep the day's data so it
// renders instantly instead of refetching.
let cached: { date: string; data: TodayData } | null = null;

const CHIP_STYLES = [
  "bg-amber-400/25 text-amber-100",
  "bg-rose-400/25 text-rose-100",
  "bg-sky-400/25 text-sky-100",
  "bg-emerald-400/25 text-emerald-100",
  "bg-violet-400/25 text-violet-100",
];

const CARD = "rounded-3xl border border-white/10 bg-white/10 p-5";
const LABEL =
  "mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/60";

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function TodayFactsChannel() {
  const [today] = useState(() => new Date());
  const todayIso = isoDate(today);
  const [data, setData] = useState<TodayData | null>(
    cached?.date === todayIso ? cached.data : null
  );

  useEffect(() => {
    if (cached?.date === todayIso) return;
    let active = true;
    fetch(`/api/mirror/today?date=${todayIso}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (!d) return;
        const next: TodayData = {
          nationalDays: d.nationalDays ?? [],
          holidays: d.holidays ?? [],
        };
        cached = { date: todayIso, data: next };
        if (active) setData(next);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [todayIso]);

  const year = today.getFullYear();
  const dayOfYear =
    Math.floor((today.getTime() - new Date(year, 0, 1).getTime()) / 86_400_000) + 1;
  const daysInYear = new Date(year, 1, 29).getDate() === 29 ? 366 : 365;
  const yearPct = Math.round((dayOfYear / daysInYear) * 100);
  const week = Math.ceil(dayOfYear / 7);

  const nationalDays = data?.nationalDays.slice(0, 8) ?? [];
  // Wikipedia lists dozens of saints' feast days; keep the real observances.
  const observances =
    data?.holidays.filter((h) => !/feast day/i.test(h.text)).slice(0, 3) ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {/* Pacing through the year */}
      <div className={CARD}>
        <div className={LABEL}>
          <CalendarDays className="h-4 w-4 text-sky-300" />
          {year} so far
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-4xl font-semibold leading-none">Day {dayOfYear}</span>
          <span className="text-4xl font-light leading-none text-white/80">{yearPct}%</span>
        </div>
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-400/80 to-violet-400/80"
            style={{ width: `${yearPct}%` }}
          />
        </div>
        <div className="mt-3 flex flex-wrap justify-between gap-x-4 gap-y-1 text-sm text-white/60">
          <span>Week {week} of 52</span>
          <span>
            {daysInYear - dayOfYear} days left of {daysInYear}
          </span>
        </div>
      </div>

      {/* Today's holidays */}
      <div className={CARD}>
        <div className={LABEL}>
          <PartyPopper className="h-4 w-4 text-amber-300" />
          Today is
        </div>
        {nationalDays.length > 0 || observances.length > 0 ? (
          <>
            <div className="flex flex-wrap gap-2">
              {nationalDays.map((d, i) => (
                <span
                  key={d.name}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-sm font-medium leading-tight",
                    CHIP_STYLES[i % CHIP_STYLES.length]
                  )}
                >
                  {d.name}
                </span>
              ))}
            </div>
            {observances.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm text-white/70">
                {observances.map((h) => (
                  <li key={h.text}>{h.text}</li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="text-sm text-white/50">{data ? "Just a regular day." : "Loading…"}</p>
        )}
      </div>
    </div>
  );
}
