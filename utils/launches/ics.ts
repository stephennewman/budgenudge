/**
 * iCalendar (RFC 5545) generator for the Florida launch feed.
 *
 * The contract that makes a subscription self-maintaining:
 *  - UID is derived from the upstream launch id, so a slipped launch rewrites
 *    the event the subscriber already has instead of adding a second one.
 *  - SEQUENCE comes from the stored row and only moves on a real schedule
 *    change, which is what prompts clients to re-alert.
 *  - Scrubbed launches stay in the feed as STATUS:CANCELLED so clients clear
 *    them; dropping them silently leaves a stale event behind forever.
 *
 * Pure string building, no Next.js or Supabase imports, so
 * test/launch-calendar-test.js can assert on the output directly.
 */

import { isTimedLaunch, type LaunchRecord } from "./source";

const PRODID = "-//Krezzo//Florida Launch Calendar//EN";
const CALENDAR_NAME = "Florida Rocket Launches";

/** Pads are on Florida's east coast, so all local formatting uses Eastern. */
export const LAUNCH_TIME_ZONE = "America/New_York";

/** Reminders ahead of T-0: one to wrap up, one to get outside and look up. */
const ALARM_OFFSETS = ["-PT60M", "-PT10M"];

const HOUR_MS = 3_600_000;
/** Longest slot to hold, for launches with a wide published window. */
const MAX_EVENT_MS = 4 * HOUR_MS;

/** The calendar-relevant fields; the sync adds bookkeeping to the API record. */
export type CalendarLaunch = LaunchRecord & {
  sequence: number;
  cancelled: boolean;
  last_change: string | null;
};

/** Escape a value for a TEXT-typed iCalendar property (RFC 5545 §3.3.11). */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Fold a content line to 75 octets (RFC 5545 §3.1). Measured in UTF-8 bytes
 * and split on character boundaries, so mission names with non-ASCII
 * characters can't be cut in half.
 */
export function foldLine(line: string): string {
  const bytesOf = (s: string) => new TextEncoder().encode(s).length;
  if (bytesOf(line) <= 75) return line;

  const out: string[] = [];
  let current = "";
  // Continuation lines carry a leading space, so they fit one byte less.
  let limit = 75;

  for (const char of line) {
    if (bytesOf(current) + bytesOf(char) > limit) {
      out.push(current);
      current = char;
      limit = 74;
    } else {
      current += char;
    }
  }
  out.push(current);
  return out.join("\r\n ");
}

/** `20260913T185000Z` */
export function formatUtcStamp(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`;
}

/** Calendar date in a given zone, as `20260913`. */
export function formatZonedDate(date: Date, timeZone = LAUNCH_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}${get("month")}${get("day")}`;
}

/**
 * The calendar day for an all-day event, as `20280705`.
 *
 * Day-precision launches upstream are parked at exactly midnight UTC: that is
 * a marker for a calendar day, not a real instant, so converting it to Eastern
 * would land the event on the day before. Anything with a real time of day is
 * converted normally, since the pads are on Eastern time.
 */
export function allDayDateStamp(net: Date): string {
  const isDatePlaceholder =
    net.getUTCHours() === 0 && net.getUTCMinutes() === 0 && net.getUTCSeconds() === 0;
  return isDatePlaceholder
    ? net.toISOString().slice(0, 10).replace(/-/g, "")
    : formatZonedDate(net);
}

/** e.g. `Sun, Sep 13, 2026 at 2:50 PM EDT` */
export function formatLocalTime(iso: string, timeZone = LAUNCH_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(iso));
}

/** Add days to a `YYYYMMDD` string without tripping over month lengths. */
function addDaysToDateStamp(stamp: string, days: number): string {
  const date = new Date(
    Date.UTC(
      Number(stamp.slice(0, 4)),
      Number(stamp.slice(4, 6)) - 1,
      Number(stamp.slice(6, 8))
    )
  );
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

export function launchUid(launchId: string, domain = "krezzo.com"): string {
  return `launch-${launchId}@${domain}`;
}

export function launchSummary(launch: CalendarLaunch): string {
  const vehicle = launch.rocket ?? launch.provider ?? "Rocket";
  const mission = launch.mission_name ?? launch.name;
  // Upstream names are usually "Falcon 9 Block 5 | Starlink 1-2"; avoid
  // repeating the vehicle when the mission name already carries it.
  const label = mission.includes("|")
    ? mission.split("|").slice(1).join("|").trim() || mission
    : mission;
  const title = label && label !== vehicle ? `${vehicle} — ${label}` : vehicle;
  return launch.net_precision === "DAY" ? `Launch (time TBD): ${title}` : `Launch: ${title}`;
}

function launchLocation(launch: CalendarLaunch): string {
  return [launch.pad_name, launch.pad_location].filter(Boolean).join(", ");
}

/** How long to block out. Uses the published window when it looks sane. */
function eventEnd(launch: CalendarLaunch): Date {
  const start = new Date(launch.net).getTime();
  const windowEnd = launch.window_end ? Date.parse(launch.window_end) : NaN;
  if (!Number.isNaN(windowEnd) && windowEnd > start) {
    return new Date(Math.min(windowEnd, start + MAX_EVENT_MS));
  }
  return new Date(start + HOUR_MS);
}

function launchDescription(launch: CalendarLaunch): string {
  const lines: string[] = [];

  if (launch.net_precision === "DAY") {
    lines.push(
      `T-0: ${humanDateFromStamp(allDayDateStamp(new Date(launch.net)))} — exact time not yet published`
    );
  } else {
    lines.push(`T-0: ${formatLocalTime(launch.net)}`);
    if (launch.window_start && launch.window_end && launch.window_start !== launch.window_end) {
      lines.push(
        `Window: ${formatLocalTime(launch.window_start)} to ${formatLocalTime(launch.window_end)}`
      );
    }
  }

  if (launch.provider) lines.push(`Provider: ${launch.provider}`);
  if (launch.rocket) lines.push(`Rocket: ${launch.rocket}`);
  if (launch.mission_name) lines.push(`Mission: ${launch.mission_name}`);
  if (launch.orbit) lines.push(`Orbit: ${launch.orbit}`);
  lines.push(`Pad: ${launchLocation(launch)}`);
  if (launch.status_name) lines.push(`Status: ${launch.status_name}`);
  if (launch.probability !== null && launch.probability >= 0) {
    lines.push(`Weather: ${launch.probability}% favorable`);
  }
  if (launch.cancelled) {
    lines.push("This launch is no longer on the published schedule.");
  }
  if (launch.last_change) lines.push(`Latest change: ${launch.last_change}`);

  if (launch.mission_description) lines.push("", launch.mission_description);

  const links: string[] = [];
  if (launch.webcast_url) links.push(`Watch: ${launch.webcast_url}`);
  if (launch.info_url) links.push(`Details: ${launch.info_url}`);
  if (links.length) lines.push("", ...links);

  lines.push(
    "",
    "Times shown are Eastern. Schedule changes are picked up automatically."
  );

  return lines.join("\n");
}

/** Render a `20280705` stamp as `Wed, Jul 5, 2028`. */
export function humanDateFromStamp(stamp: string): string {
  const date = new Date(
    Date.UTC(
      Number(stamp.slice(0, 4)),
      Number(stamp.slice(4, 6)) - 1,
      Number(stamp.slice(6, 8))
    )
  );
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function icsStatus(launch: CalendarLaunch): "CANCELLED" | "CONFIRMED" | "TENTATIVE" {
  if (launch.cancelled) return "CANCELLED";
  // TBC ("to be confirmed") and TBD ("to be determined") are still soft dates.
  if (launch.status === "TBD" || launch.status === "TBC" || launch.net_precision === "DAY") {
    return "TENTATIVE";
  }
  return "CONFIRMED";
}

/** An invite needs a scheduling identity on both sides; a published feed does not. */
export type Party = { email: string; name?: string };

function partyValue(prefix: string, party: Party, extraParams = ""): string {
  const cn = party.name ? `;CN=${escapeText(party.name)}` : "";
  return `${prefix}${cn}${extraParams}:mailto:${party.email}`;
}

/** Build the VEVENT lines for one launch. */
export function buildLaunchEvent(
  launch: CalendarLaunch,
  options: {
    now?: Date;
    domain?: string;
    organizer?: Party;
    attendee?: Party;
  } = {}
): string[] {
  const { now = new Date(), domain = "krezzo.com", organizer, attendee } = options;
  const timed = isTimedLaunch(launch);
  const start = new Date(launch.net);

  const lines: string[] = ["BEGIN:VEVENT", `UID:${launchUid(launch.launch_id, domain)}`];
  lines.push(`DTSTAMP:${formatUtcStamp(now)}`);
  lines.push(`SEQUENCE:${Math.max(0, Math.trunc(launch.sequence))}`);

  if (timed) {
    lines.push(`DTSTART:${formatUtcStamp(start)}`);
    lines.push(`DTEND:${formatUtcStamp(eventEnd(launch))}`);
    lines.push("TRANSP:OPAQUE");
  } else {
    // Day-precision launches get an all-day event, left transparent so a
    // placeholder doesn't read as a full day of busy.
    const day = allDayDateStamp(start);
    lines.push(`DTSTART;VALUE=DATE:${day}`);
    lines.push(`DTEND;VALUE=DATE:${addDaysToDateStamp(day, 1)}`);
    lines.push("TRANSP:TRANSPARENT");
  }

  lines.push(`SUMMARY:${escapeText(launchSummary(launch))}`);
  lines.push(`LOCATION:${escapeText(launchLocation(launch))}`);
  lines.push(`DESCRIPTION:${escapeText(launchDescription(launch))}`);
  lines.push(`STATUS:${icsStatus(launch)}`);
  lines.push("CATEGORIES:Rocket Launch");

  if (organizer) lines.push(partyValue("ORGANIZER", organizer));
  if (attendee) {
    lines.push(
      partyValue("ATTENDEE", attendee, ";ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE")
    );
  }

  const url = launch.webcast_url ?? launch.info_url;
  if (url) lines.push(`URL:${url}`);
  if (launch.pad_latitude !== null && launch.pad_longitude !== null) {
    lines.push(`GEO:${launch.pad_latitude};${launch.pad_longitude}`);
  }

  // Alarms on a cancelled or time-unknown event would fire for nothing.
  if (timed && !launch.cancelled) {
    for (const trigger of ALARM_OFFSETS) {
      lines.push(
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `TRIGGER:${trigger}`,
        `DESCRIPTION:${escapeText(launchSummary(launch))}`,
        "END:VALARM"
      );
    }
  }

  lines.push("END:VEVENT");
  return lines;
}

/**
 * Build the whole subscribable calendar.
 *
 * REFRESH-INTERVAL and X-PUBLISHED-TTL ask clients to re-poll hourly, which
 * matches the sync cron. Clients treat them as hints: Apple Calendar honors a
 * short interval, Google Calendar polls external URLs on its own slower cadence.
 */
export function buildLaunchFeed(
  launches: CalendarLaunch[],
  options: { now?: Date; domain?: string; calendarName?: string } = {}
): string {
  const { now = new Date(), domain = "krezzo.com", calendarName = CALENDAR_NAME } = options;

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    `X-WR-CALDESC:${escapeText("Rocket launches from Cape Canaveral and Kennedy Space Center, visible from the Tampa Bay area.")}`,
    `X-WR-TIMEZONE:${LAUNCH_TIME_ZONE}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];

  for (const launch of launches) {
    lines.push(...buildLaunchEvent(launch, { now, domain }));
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/**
 * Build a single-event calendar for emailing as an invite.
 *
 * METHOD:REQUEST is what makes a mail client show an event with RSVP buttons
 * instead of a file to download; re-sending the same UID with a higher
 * SEQUENCE updates the recipient's existing event. METHOD:CANCEL withdraws it.
 */
export function buildLaunchInvite(
  launch: CalendarLaunch,
  options: {
    organizer: Party;
    attendee: Party;
    method?: "REQUEST" | "CANCEL";
    now?: Date;
    domain?: string;
  }
): string {
  const { organizer, attendee, method = "REQUEST", now = new Date(), domain = "krezzo.com" } = options;

  // A CANCEL whose event isn't STATUS:CANCELLED is contradictory, so make the
  // two agree here rather than trusting every caller to line them up.
  const event = method === "CANCEL" ? { ...launch, cancelled: true } : launch;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    `METHOD:${method}`,
    ...buildLaunchEvent(event, { now, domain, organizer, attendee }),
    "END:VCALENDAR",
  ];

  return lines.map(foldLine).join("\r\n") + "\r\n";
}
