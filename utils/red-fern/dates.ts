/**
 * Calendar-date helpers for the Red Fern booking flow.
 *
 * Bookings are anchored to a plain `YYYY-MM-DD` local date and an `HH:MM`
 * local time, because a Saturday wedding is a Saturday wedding regardless of
 * where the guest is sitting when they book it. Everything converts to an
 * instant exactly once, on the way into an iCalendar file.
 */

import { VENUE_TIME_ZONE } from "./catalog";

export const DAY_MS = 86_400_000;

/** `2026-09-06` → the same wall date as a UTC-anchored Date. */
export function parseDateStamp(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function toDateStamp(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  return toDateStamp(new Date(parseDateStamp(date).getTime() + days * DAY_MS));
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((parseDateStamp(to).getTime() - parseDateStamp(from).getTime()) / DAY_MS);
}

/** 0 = Sunday, matching `Date.getDay()`. */
export function weekdayOf(date: string): number {
  return parseDateStamp(date).getUTCDay();
}

/** Every date from `start` for `days` days, inclusive of the first. */
export function dateRange(start: string, days: number): string[] {
  return Array.from({ length: Math.max(1, days) }, (_, i) => addDays(start, i));
}

/** Today's date at the venue, not in the caller's time zone. */
export function todayAtVenue(now: Date = new Date(), timeZone = VENUE_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** How far a zone sits from UTC at a given instant, in milliseconds. */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second")
  );
  return asUtc - instant.getTime();
}

/**
 * A local wall time at the venue as a real instant.
 *
 * The offset depends on the instant we're solving for, so the first guess is
 * corrected once — enough to land correctly on either side of a DST switch.
 */
export function venueTimeToUtc(date: string, time: string, timeZone = VENUE_TIME_ZONE): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);

  const firstGuess = wall - zoneOffsetMs(new Date(wall), timeZone);
  const corrected = wall - zoneOffsetMs(new Date(firstGuess), timeZone);
  return new Date(corrected);
}

/** `HH:MM` plus a number of hours, wrapping past midnight. */
export function addHours(time: string, hours: number): { time: string; dayOffset: number } {
  const [hour, minute] = time.split(":").map(Number);
  const total = hour * 60 + minute + Math.round(hours * 60);
  const dayOffset = Math.floor(total / 1_440);
  const withinDay = ((total % 1_440) + 1_440) % 1_440;
  const pad = (n: number) => String(n).padStart(2, "0");
  return { time: `${pad(Math.floor(withinDay / 60))}:${pad(withinDay % 60)}`, dayOffset };
}

/** `2026-11-21` → `Sat, Nov 21, 2026` */
export function formatDateLong(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parseDateStamp(date));
}

/** `2026-11-21` → `November 21, 2026` */
export function formatDateFull(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(parseDateStamp(date));
}

/** `05:30` → `5:30 AM` */
export function formatTime(time: string): string {
  const [hour, minute] = time.split(":").map(Number);
  const suffix = hour >= 12 ? "PM" : "AM";
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return minute === 0 ? `${twelve}:00 ${suffix}` : `${twelve}:${String(minute).padStart(2, "0")} ${suffix}`;
}

/** `Nov 21 – Nov 23, 2026`, collapsing a single day to `Nov 21, 2026`. */
export function formatDateSpan(start: string, days: number): string {
  if (days <= 1) return formatDateLong(start);
  const end = addDays(start, days - 1);
  const short = (date: string) =>
    new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" }).format(
      parseDateStamp(date)
    );
  return `${short(start)} – ${short(end)}, ${end.slice(0, 4)}`;
}

export function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** First day of the month containing `date`, as a stamp. */
export function startOfMonth(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

export function addMonths(date: string, months: number): string {
  const d = parseDateStamp(date);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
  ).getUTCDate();
  target.setUTCDate(Math.min(d.getUTCDate(), lastDay));
  return toDateStamp(target);
}

/** `2026-11` → `November 2026` */
export function formatMonthLabel(month: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(parseDateStamp(`${month}-01`));
}
