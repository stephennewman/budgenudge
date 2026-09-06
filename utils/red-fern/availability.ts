/**
 * What can still be booked, and why not.
 *
 * A day is offered only when the season, the day of the week, the notice
 * period and the existing schedule all allow it. The same rules run on the
 * server before a booking is written, so a guest who leaves the page open
 * while somebody else takes the date gets a clear refusal instead of a double
 * booking.
 *
 * Two bookings collide when they overlap in date, in time, and on the ground
 * they need. A wedding is exclusive: it closes the whole plantation, so it
 * collides with everything that overlaps it.
 */

import {
  EXPERIENCES_BY_ID,
  isInSeason,
  seasonLabel,
  type Experience,
  type Resource,
} from "./catalog";
import { addDays, dateRange, daysBetween, weekdayOf } from "./dates";

export type BookingStatus = "requested" | "confirmed" | "hold" | "cancelled";

/** Snake_case throughout: these rows come back from Supabase as-is. */
export type Booking = {
  reference: string;
  experience_id: string;
  start_date: string;
  days: number;
  slot_id: string;
  start_time: string;
  hours: number;
  party_size: number;
  add_on_ids: string[];
  guest_name: string;
  guest_email: string;
  guest_phone: string | null;
  notes: string | null;
  status: BookingStatus;
  total: number;
  deposit_due: number;
  created_at: string;
  /** Bumped whenever the booking is rescheduled, so re-sent invites update. */
  sequence: number;
};

type Occupancy = {
  reference: string;
  resource: Resource;
  exclusive: boolean;
  dates: string[];
  startMinute: number;
  endMinute: number;
  allDay: boolean;
};

const WEEKDAY_NAMES = [
  "Sundays",
  "Mondays",
  "Tuesdays",
  "Wednesdays",
  "Thursdays",
  "Fridays",
  "Saturdays",
];

function minutesOf(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

/** A booking long enough to swallow a day is treated as taking the whole day. */
function isAllDay(hours: number, days: number): boolean {
  return days > 1 || hours >= 10;
}

export function occupancyOf(booking: Booking): Occupancy | null {
  const experience = EXPERIENCES_BY_ID[booking.experience_id];
  if (!experience || booking.status === "cancelled") return null;

  const startMinute = minutesOf(booking.start_time);
  const allDay = isAllDay(booking.hours, booking.days);
  return {
    reference: booking.reference,
    resource: experience.resource,
    exclusive: experience.exclusive,
    dates: dateRange(booking.start_date, booking.days),
    startMinute: allDay ? 0 : startMinute,
    // Overnight blocks (a lodge stay, a wedding running to midnight) clamp to
    // the end of the day; the next day is already in `dates`.
    endMinute: allDay ? 1_440 : Math.min(1_440, startMinute + Math.round(booking.hours * 60)),
    allDay,
  };
}

function windowsOverlap(a: Occupancy, b: Occupancy): boolean {
  if (a.allDay || b.allDay) return true;
  return a.startMinute < b.endMinute && b.startMinute < a.endMinute;
}

/** The ground two bookings need is shared when either one takes the property. */
function competesFor(a: Occupancy, b: Occupancy): boolean {
  return a.exclusive || b.exclusive || a.resource === b.resource;
}

export function conflicts(a: Occupancy, b: Occupancy): boolean {
  if (a.reference === b.reference) return false;
  if (!competesFor(a, b)) return false;
  const bDates = new Set(b.dates);
  if (!a.dates.some((date) => bDates.has(date))) return false;
  return windowsOverlap(a, b);
}

export type SlotAvailability = {
  slotId: string;
  label: string;
  start: string;
  hours: number;
  available: boolean;
  reason?: string;
};

export type BusyMarker = {
  /** Public label; guest details never appear here. */
  label: string;
  category: string;
  allDay: boolean;
  startTime: string;
  exclusive: boolean;
};

export type DayStatus = "open" | "limited" | "unavailable";

export type DayAvailability = {
  date: string;
  weekday: number;
  status: DayStatus;
  reason?: string;
  season?: string | null;
  slots: SlotAvailability[];
  busy: BusyMarker[];
};

export type AvailabilityQuery = {
  experience: Experience;
  /** Nights or days the guest wants, so a multi-day request checks each date. */
  durationDays: number;
  from: string;
  to: string;
  bookings: Booking[];
  today: string;
};

/** A candidate booking, so an unsaved request can be tested the same way. */
function candidateOccupancy(
  experience: Experience,
  startDate: string,
  days: number,
  startTime: string,
  hours: number
): Occupancy {
  const allDay = isAllDay(hours, days);
  const startMinute = minutesOf(startTime);
  return {
    reference: "__candidate__",
    resource: experience.resource,
    exclusive: experience.exclusive,
    dates: dateRange(startDate, days),
    startMinute: allDay ? 0 : startMinute,
    endMinute: allDay ? 1_440 : Math.min(1_440, startMinute + Math.round(hours * 60)),
    allDay,
  };
}

/** Why a single date can't host this offering, ignoring the existing schedule. */
function calendarBlocker(
  experience: Experience,
  date: string,
  today: string
): string | undefined {
  if (daysBetween(today, date) < 0) return "Past date";
  if (daysBetween(today, date) < experience.leadTimeDays) {
    const notice = experience.leadTimeDays;
    return notice <= 1
      ? "Same-day requests: please call"
      : `Needs ${notice} days' notice`;
  }
  if (!isInSeason(date, experience.seasons)) return "Out of season";
  if (experience.daysOfWeek && !experience.daysOfWeek.includes(weekdayOf(date))) {
    return `Not offered ${WEEKDAY_NAMES[weekdayOf(date)]}`;
  }
  return undefined;
}

function busyMarkers(bookings: Booking[], date: string): BusyMarker[] {
  const markers: BusyMarker[] = [];
  for (const booking of bookings) {
    const occupancy = occupancyOf(booking);
    if (!occupancy || !occupancy.dates.includes(date)) continue;
    const experience = EXPERIENCES_BY_ID[booking.experience_id];
    if (!experience) continue;
    markers.push({
      label: experience.name,
      category: experience.category,
      allDay: occupancy.allDay,
      startTime: booking.start_time,
      exclusive: experience.exclusive,
    });
  }
  return markers.sort((a, b) => a.startTime.localeCompare(b.startTime));
}

/**
 * Availability for one offering across a date range.
 *
 * `durationDays` matters: asking for three mornings of duck hunting means a
 * date is only open if all three mornings are.
 */
export function buildAvailability(query: AvailabilityQuery): DayAvailability[] {
  const { experience, durationDays, from, to, bookings, today } = query;
  const span = Math.max(0, daysBetween(from, to));
  const live = bookings.filter((b) => b.status !== "cancelled");
  const occupancies = live.map(occupancyOf).filter((o): o is Occupancy => o !== null);
  const days: DayAvailability[] = [];

  for (let i = 0; i <= span; i++) {
    const date = addDays(from, i);
    const covered = dateRange(date, durationDays);

    // A multi-day stay has to clear every date it covers, so the first date
    // that fails supplies the reason shown on the start date.
    let blocker: string | undefined;
    for (const day of covered) {
      blocker = calendarBlocker(experience, day, today);
      if (blocker) {
        if (day !== date && blocker !== "Out of season") {
          blocker = `${blocker} for the full ${durationDays} days`;
        }
        break;
      }
    }

    const busy = busyMarkers(live, date);

    const slots: SlotAvailability[] = experience.slots.map((slot) => {
      if (blocker) {
        return { slotId: slot.id, label: slot.label, start: slot.start, hours: slot.hours, available: false, reason: blocker };
      }
      const candidate = candidateOccupancy(experience, date, durationDays, slot.start, slot.hours);
      const clash = occupancies.find((existing) => conflicts(candidate, existing));
      return {
        slotId: slot.id,
        label: slot.label,
        start: slot.start,
        hours: slot.hours,
        available: !clash,
        reason: clash ? (clash.exclusive ? "Private event on the property" : "Already booked") : undefined,
      };
    });

    const openCount = slots.filter((slot) => slot.available).length;
    const status: DayStatus =
      openCount === 0 ? "unavailable" : openCount === slots.length ? "open" : "limited";

    days.push({
      date,
      weekday: weekdayOf(date),
      status,
      reason: openCount === 0 ? blocker ?? slots[0]?.reason ?? "Unavailable" : undefined,
      season: seasonLabel(date, experience.seasons),
      slots,
      busy,
    });
  }

  return days;
}

export type SlotCheck = { ok: true } | { ok: false; reason: string };

/**
 * Re-check one request against the live schedule.
 *
 * The booking API calls this immediately before writing, which is what keeps a
 * stale page from taking a date that filled while the guest was typing.
 */
export function checkSlot(options: {
  experience: Experience;
  startDate: string;
  days: number;
  startTime: string;
  hours: number;
  bookings: Booking[];
  today: string;
}): SlotCheck {
  const { experience, startDate, days, startTime, hours, bookings, today } = options;

  for (const date of dateRange(startDate, days)) {
    const blocker = calendarBlocker(experience, date, today);
    if (blocker) return { ok: false, reason: blocker };
  }

  const candidate = candidateOccupancy(experience, startDate, days, startTime, hours);
  const clash = bookings
    .filter((b) => b.status !== "cancelled")
    .map(occupancyOf)
    .filter((o): o is Occupancy => o !== null)
    .find((existing) => conflicts(candidate, existing));

  if (clash) {
    return {
      ok: false,
      reason: clash.exclusive
        ? "The property is closed for a private event on those dates."
        : "That time was just taken. Pick another slot and we'll hold it.",
    };
  }

  return { ok: true };
}

/** Bookings that touch a given date, newest schedule first. */
export function bookingsOnDate(bookings: Booking[], date: string): Booking[] {
  return bookings
    .filter((booking) => {
      const occupancy = occupancyOf(booking);
      return occupancy?.dates.includes(date) ?? false;
    })
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
}
