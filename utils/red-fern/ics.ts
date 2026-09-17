/**
 * iCalendar output for Red Fern bookings.
 *
 * Two shapes come out of here:
 *  - `buildBookingInvite` — a single METHOD:REQUEST event emailed to the guest.
 *    A mail client shows that as an invitation with RSVP buttons rather than a
 *    file to download, and re-sending the same UID with a higher SEQUENCE
 *    updates the event already on their calendar instead of adding a second.
 *  - `buildVenueFeed` — the whole book of business as a subscribable
 *    METHOD:PUBLISH calendar for the family who runs the place.
 *
 * The RFC 5545 primitives are kept local so this folder compiles on its own
 * for the test runner.
 */

import {
  EXPERIENCES_BY_ID,
  VENUE,
  VENUE_TIME_ZONE,
  type Experience,
} from "./catalog";
import type { Booking } from "./availability";
import {
  addDays,
  addHours,
  formatDateFull,
  formatMoney,
  formatTime,
  venueTimeToUtc,
} from "./dates";

const PRODID = "-//Red Fern Plantation//Booking Calendar//EN";
const UID_DOMAIN = "redfernplantation.com";

export type Party = { email: string; name?: string };

export const VENUE_ORGANIZER: Party = { email: VENUE.email, name: VENUE.name };

/** Escape a value for a TEXT-typed property (RFC 5545 §3.3.11). */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Fold a content line to 75 octets, measured in UTF-8 bytes (§3.1). */
export function foldLine(line: string): string {
  const bytesOf = (s: string) => new TextEncoder().encode(s).length;
  if (bytesOf(line) <= 75) return line;

  const out: string[] = [];
  let current = "";
  let limit = 75;

  for (const char of line) {
    if (bytesOf(current) + bytesOf(char) > limit) {
      out.push(current);
      current = char;
      // Continuation lines carry a leading space, so they fit one byte less.
      limit = 74;
    } else {
      current += char;
    }
  }
  out.push(current);
  return out.join("\r\n ");
}

/** `20261121T143000Z` */
export function formatUtcStamp(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`;
}

/** `2026-11-21` → `20261121`, the form a VALUE=DATE property takes. */
function dateValue(date: string): string {
  return date.replace(/-/g, "");
}

export function bookingUid(reference: string, domain = UID_DOMAIN): string {
  return `redfern-${reference.toLowerCase()}@${domain}`;
}

function partyValue(prefix: string, party: Party, extraParams = ""): string {
  const cn = party.name ? `;CN=${escapeText(party.name)}` : "";
  return `${prefix}${cn}${extraParams}:mailto:${party.email}`;
}

export function bookingTitle(booking: Booking, experience: Experience): string {
  return `${experience.name} at ${VENUE.name}`;
}

/** The venue's own calendar wants to know whose party it is at a glance. */
export function scheduleTitle(booking: Booking, experience: Experience): string {
  const surname = booking.guest_name.trim().split(/\s+/).slice(-1)[0] || booking.guest_name;
  const size = `${booking.party_size} ${experience.party.label.toLowerCase()}`;
  return `${experience.name} — ${surname} party (${size})`;
}

/** When the balance comes due, or null when nothing is owed later. */
export function balanceDueDate(booking: Booking, experience: Experience): string | null {
  if (booking.total <= 0 || experience.balanceDueDays <= 0) return null;
  return addDays(booking.start_date, -experience.balanceDueDays);
}

function bookingDescription(
  booking: Booking,
  experience: Experience,
  options: { audience: "guest" | "venue"; manageUrl?: string }
): string {
  const lines: string[] = [];
  const balance = booking.total - booking.deposit_due;

  if (options.audience === "venue") {
    lines.push(`${booking.guest_name} — ${booking.guest_email}`);
    if (booking.guest_phone) lines.push(booking.guest_phone);
    lines.push(`Confirmation ${booking.reference} (${booking.status})`);
    lines.push("");
  }

  lines.push(
    `${booking.party_size} ${experience.party.label.toLowerCase()} · ${
      booking.days > 1 ? `${booking.days} days` : formatTime(booking.start_time)
    }`
  );

  if (booking.days > 1) {
    lines.push(
      `Starts ${formatDateFull(booking.start_date)} at ${formatTime(booking.start_time)}`
    );
  }

  if (booking.total > 0) {
    lines.push(`Total ${formatMoney(booking.total)}`);
    if (booking.deposit_due > 0) {
      lines.push(`Deposit ${formatMoney(booking.deposit_due)} to hold the date`);
    }
    const due = balanceDueDate(booking, experience);
    if (balance > 0 && due) {
      lines.push(`Balance ${formatMoney(balance)} due ${formatDateFull(due)}`);
    }
  } else {
    lines.push("No charge — this is a look-around, not a commitment.");
  }

  const addOns = booking.add_on_ids
    .map((id) => experience.addOns.find((addOn) => addOn.id === id)?.name)
    .filter(Boolean);
  if (addOns.length) lines.push(`Added: ${addOns.join(", ")}`);

  if (booking.notes) lines.push("", `Notes: ${booking.notes}`);

  if (options.audience === "guest") {
    lines.push("", "What's included:", ...experience.includes.map((item) => `• ${item}`));
    lines.push(
      "",
      VENUE.address,
      `Questions: ${VENUE.phone} or ${VENUE.email}`,
      `Confirmation ${booking.reference}`
    );
    if (options.manageUrl) lines.push(options.manageUrl);
  }

  return lines.join("\n");
}

/**
 * The VEVENT lines for one booking.
 *
 * A single-day booking is a timed event so it lands at the right hour; a
 * multi-day hunt or stay becomes an all-day span, which is how a guest thinks
 * about three mornings in a duck blind.
 */
export function buildBookingEvent(
  booking: Booking,
  options: {
    now?: Date;
    domain?: string;
    audience?: "guest" | "venue";
    organizer?: Party;
    attendee?: Party;
    manageUrl?: string;
    cancelled?: boolean;
  } = {}
): string[] {
  const experience = EXPERIENCES_BY_ID[booking.experience_id];
  if (!experience) return [];

  const {
    now = new Date(),
    domain = UID_DOMAIN,
    audience = "guest",
    organizer,
    attendee,
    manageUrl,
    cancelled = booking.status === "cancelled",
  } = options;

  const lines: string[] = [
    "BEGIN:VEVENT",
    `UID:${bookingUid(booking.reference, domain)}`,
    `DTSTAMP:${formatUtcStamp(now)}`,
    `SEQUENCE:${Math.max(0, Math.trunc(booking.sequence))}`,
  ];

  if (booking.days > 1) {
    lines.push(`DTSTART;VALUE=DATE:${dateValue(booking.start_date)}`);
    // DTEND on an all-day event is exclusive, so it points at the morning after.
    lines.push(`DTEND;VALUE=DATE:${dateValue(addDays(booking.start_date, booking.days))}`);
  } else {
    const { time: endTime, dayOffset } = addHours(booking.start_time, booking.hours);
    lines.push(`DTSTART:${formatUtcStamp(venueTimeToUtc(booking.start_date, booking.start_time))}`);
    lines.push(
      `DTEND:${formatUtcStamp(
        venueTimeToUtc(addDays(booking.start_date, dayOffset), endTime)
      )}`
    );
  }

  lines.push("TRANSP:OPAQUE");
  lines.push(
    `SUMMARY:${escapeText(
      audience === "venue" ? scheduleTitle(booking, experience) : bookingTitle(booking, experience)
    )}`
  );
  lines.push(`LOCATION:${escapeText(VENUE.address)}`);
  lines.push(`DESCRIPTION:${escapeText(bookingDescription(booking, experience, { audience, manageUrl }))}`);
  lines.push(`STATUS:${cancelled ? "CANCELLED" : booking.status === "confirmed" ? "CONFIRMED" : "TENTATIVE"}`);
  lines.push(`CATEGORIES:${escapeText(experience.name)}`);
  lines.push(`GEO:${VENUE.latitude};${VENUE.longitude}`);

  if (organizer) lines.push(partyValue("ORGANIZER", organizer));
  if (attendee) {
    lines.push(
      partyValue("ATTENDEE", attendee, ";ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE")
    );
  }

  // A reminder the night before is the one that matters for a 5:30 AM hunt;
  // the two-hour alarm is for everything else. Neither is useful once the
  // booking is off the books.
  if (!cancelled) {
    for (const trigger of ["-P1D", "-PT2H"]) {
      lines.push(
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `TRIGGER:${trigger}`,
        `DESCRIPTION:${escapeText(bookingTitle(booking, experience))}`,
        "END:VALARM"
      );
    }
  }

  lines.push("END:VEVENT");
  return lines;
}

/**
 * A single-event calendar to attach to the confirmation email.
 *
 * METHOD:CANCEL withdraws a booking; the event status is forced to match so
 * the two can't contradict each other.
 */
export function buildBookingInvite(
  booking: Booking,
  options: {
    organizer?: Party;
    attendee?: Party;
    method?: "REQUEST" | "CANCEL";
    now?: Date;
    domain?: string;
    manageUrl?: string;
  } = {}
): string {
  const {
    organizer = VENUE_ORGANIZER,
    attendee = { email: booking.guest_email, name: booking.guest_name },
    method = "REQUEST",
    now,
    domain,
    manageUrl,
  } = options;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    `METHOD:${method}`,
    `X-WR-TIMEZONE:${VENUE_TIME_ZONE}`,
    ...buildBookingEvent(booking, {
      now,
      domain,
      audience: "guest",
      organizer,
      attendee,
      manageUrl,
      cancelled: method === "CANCEL",
    }),
    "END:VCALENDAR",
  ];

  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/** The venue's own book of business, as a subscribable feed. */
export function buildVenueFeed(
  bookings: Booking[],
  options: { now?: Date; domain?: string; calendarName?: string } = {}
): string {
  const { now, domain, calendarName = `${VENUE.name} — Schedule` } = options;

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    `X-WR-CALDESC:${escapeText(
      "Every tour, hunt, wedding and lodge stay on the books at Red Fern Plantation."
    )}`,
    `X-WR-TIMEZONE:${VENUE_TIME_ZONE}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];

  for (const booking of bookings) {
    lines.push(...buildBookingEvent(booking, { now, domain, audience: "venue" }));
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
