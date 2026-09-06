/**
 * Emailed calendar invites for upcoming Florida launches.
 *
 * The subscribed feed is the zero-touch path, but a mail client refreshes an
 * external calendar on its own slow schedule, so a launch that slips the
 * morning of would reach a Google Calendar subscriber late. An invite lands
 * immediately, and because it carries the same UID and a higher SEQUENCE than
 * the last one sent, it updates the event already on the calendar instead of
 * adding a second one.
 *
 * Selection and message building are pure; delivery is injected so the caller
 * owns the Resend client.
 */

import {
  buildLaunchInvite,
  formatLocalTime,
  allDayDateStamp,
  humanDateFromStamp,
  launchSummary,
  type CalendarLaunch,
  type Party,
} from "./ics";

/** How many upcoming launches to keep invited by default. */
export const DEFAULT_INVITE_COUNT = 5;

/** How long after T-0 an update or cancellation is still worth sending. */
const PAST_GRACE_MS = 12 * 3_600_000;

export type InvitableLaunch = CalendarLaunch & {
  /** Absent on a row that was just built rather than read back from the table. */
  invited_sequence?: number | null;
};

export type InviteReason = "new" | "updated" | "cancelled";

export type PlannedInvite = {
  launch: InvitableLaunch;
  method: "REQUEST" | "CANCEL";
  reason: InviteReason;
};

/**
 * Decide which launches need an invite emailed right now.
 *
 * New invites are capped to the next `limit` launches, so the mailbox doesn't
 * fill up with a manifest that runs years out. Updates and cancellations are
 * not capped: once a launch has been invited it must be kept accurate, even
 * after it slips past the cutoff, or the recipient is left holding an event at
 * a time that no longer exists.
 */
export function planLaunchInvites(
  rows: InvitableLaunch[],
  options: { now?: Date; limit?: number } = {}
): PlannedInvite[] {
  const { now = new Date(), limit = DEFAULT_INVITE_COUNT } = options;
  const nowMs = now.getTime();

  const upcoming = rows
    .filter((row) => !row.cancelled && Date.parse(row.net) >= nowMs)
    .sort((a, b) => a.net.localeCompare(b.net));
  const nextUp = new Set(upcoming.slice(0, Math.max(0, limit)).map((r) => r.launch_id));

  const planned: PlannedInvite[] = [];
  for (const row of rows) {
    const t0 = Date.parse(row.net);
    if (Number.isNaN(t0)) continue;

    // A row assembled in memory has no invited_sequence at all; treat that the
    // same as never invited rather than as "invited at version undefined".
    const invitedSequence = row.invited_sequence ?? null;
    const alreadyInvited = invitedSequence !== null;
    const staleInvite = alreadyInvited && invitedSequence < row.sequence;

    if (row.cancelled) {
      // Withdrawing an invite nobody received would be noise.
      if (staleInvite && t0 >= nowMs - PAST_GRACE_MS) {
        planned.push({ launch: row, method: "CANCEL", reason: "cancelled" });
      }
      continue;
    }

    if (!alreadyInvited) {
      if (t0 >= nowMs && nextUp.has(row.launch_id)) {
        planned.push({ launch: row, method: "REQUEST", reason: "new" });
      }
      continue;
    }

    if (staleInvite && t0 >= nowMs - PAST_GRACE_MS) {
      planned.push({ launch: row, method: "REQUEST", reason: "updated" });
    }
  }

  return planned.sort((a, b) => a.launch.net.localeCompare(b.launch.net));
}

/** The launch title without the "Launch:" prefix the calendar entry carries. */
function bareTitle(launch: CalendarLaunch): string {
  return launchSummary(launch).replace(/^Launch(?: \(time TBD\))?: /, "");
}

/** When the launch is, phrased for a subject line. */
export function inviteWhen(launch: CalendarLaunch): string {
  if (launch.net_precision === "DAY") {
    return `${humanDateFromStamp(allDayDateStamp(new Date(launch.net)))}, time TBD`;
  }
  return formatLocalTime(launch.net);
}

const SUBJECT_PREFIX: Record<InviteReason, string> = {
  new: "Launch",
  updated: "Updated",
  cancelled: "Scrubbed",
};

export type InviteEmail = {
  to: string;
  from: string;
  subject: string;
  text: string;
  html: string;
  /** The raw iCalendar body, for inspection; the wire copy is base64 in `attachments`. */
  calendar: string;
  attachments: {
    filename: string;
    /** Base64, the form Resend documents for inline content. A raw string arrives mangled. */
    content: string;
    /**
     * Snake_case on purpose. Resend's REST API reads `content_type`; the Node
     * SDK's camelCase `contentType` field was dropped on the floor until
     * v4.8.0, and this repo is on 4.6.0. Without the content type the
     * attachment falls back to plain `text/calendar` derived from the
     * filename, losing the `method=` parameter that makes a mail client show
     * an invitation rather than a file to download.
     */
    content_type: string;
  }[];
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Build the message for one planned invite.
 *
 * The calendar part is attached with an explicit
 * `text/calendar; method=REQUEST` content type. Without the method parameter a
 * mail client treats the file as a download rather than an invitation.
 */
export function buildInviteEmail(
  planned: PlannedInvite,
  options: {
    to: string;
    from: string;
    organizer: Party;
    attendeeName?: string;
    subscribeUrl?: string;
    now?: Date;
    domain?: string;
  }
): InviteEmail {
  const { to, from, organizer, attendeeName, subscribeUrl, now, domain } = options;
  const { launch, method, reason } = planned;

  const calendar = buildLaunchInvite(launch, {
    organizer,
    attendee: { email: to, name: attendeeName },
    method,
    now,
    domain,
  });

  const title = bareTitle(launch);
  const when = inviteWhen(launch);
  const pad = [launch.pad_name, launch.pad_location].filter(Boolean).join(", ");
  const subject = `${SUBJECT_PREFIX[reason]}: ${title} — ${when}`;

  const facts: [string, string][] = [["When", when], ["Pad", pad]];
  if (launch.provider) facts.push(["Provider", launch.provider]);
  if (launch.rocket) facts.push(["Rocket", launch.rocket]);
  if (launch.mission_name) facts.push(["Mission", launch.mission_name]);
  if (launch.orbit) facts.push(["Orbit", launch.orbit]);
  if (launch.status_name) facts.push(["Status", launch.status_name]);
  if (launch.probability !== null && launch.probability >= 0) {
    facts.push(["Weather", `${launch.probability}% favorable`]);
  }

  const lead =
    reason === "cancelled"
      ? "This launch has come off the published schedule. Declining removes it from your calendar."
      : reason === "updated"
        ? launch.last_change ?? "The schedule for this launch changed."
        : "Accepting puts this on your calendar with reminders an hour and ten minutes before liftoff.";

  const text = [
    title,
    "",
    lead,
    "",
    ...facts.map(([label, value]) => `${label}: ${value}`),
    ...(launch.webcast_url ? ["", `Watch: ${launch.webcast_url}`] : []),
    ...(subscribeUrl
      ? ["", `Every Florida launch, kept up to date: ${subscribeUrl}`]
      : []),
  ].join("\n");

  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;color:#0f172a;line-height:1.5">
  <p style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#0284c7;margin:0 0 4px">${escapeHtml(SUBJECT_PREFIX[reason])}</p>
  <h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(title)}</h1>
  <p style="margin:0 0 16px;color:#475569">${escapeHtml(lead)}</p>
  <table style="border-collapse:collapse;font-size:14px">
    ${facts
      .map(
        ([label, value]) =>
          `<tr><td style="padding:3px 16px 3px 0;color:#64748b;white-space:nowrap">${escapeHtml(label)}</td><td style="padding:3px 0">${escapeHtml(value)}</td></tr>`
      )
      .join("\n    ")}
  </table>
  ${launch.webcast_url ? `<p style="margin:16px 0 0;font-size:14px"><a href="${escapeHtml(launch.webcast_url)}" style="color:#0284c7">Watch the launch</a></p>` : ""}
  ${subscribeUrl ? `<p style="margin:20px 0 0;font-size:12px;color:#94a3b8">Every Florida launch, kept up to date: <a href="${escapeHtml(subscribeUrl)}" style="color:#94a3b8">subscribe to the calendar</a></p>` : ""}
</div>`;

  return {
    to,
    from,
    subject,
    text,
    html,
    calendar,
    attachments: [
      {
        filename: "launch.ics",
        content: Buffer.from(calendar, "utf-8").toString("base64"),
        content_type: `text/calendar; charset=utf-8; method=${method}`,
      },
    ],
  };
}

export type SendResult = {
  sent: { launch: string; reason: InviteReason; subject: string }[];
  failed: { launch: string; error: string }[];
};

/**
 * Send the planned invites and record what was delivered.
 *
 * Delivery is recorded per launch as each send succeeds, so a failure part way
 * through re-sends only what didn't land. Resend's default rate limit is two
 * requests a second, hence the pause between sends.
 */
export async function sendLaunchInvites(
  planned: PlannedInvite[],
  options: {
    to: string;
    from: string;
    organizer: Party;
    attendeeName?: string;
    subscribeUrl?: string;
    now?: Date;
    domain?: string;
    send: (email: InviteEmail) => Promise<{ error?: string | null }>;
    record: (launchId: string, sequence: number) => Promise<void>;
    pauseMs?: number;
    sleep?: (ms: number) => Promise<void>;
  }
): Promise<SendResult> {
  const {
    send,
    record,
    pauseMs = 600,
    sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
    ...build
  } = options;

  const result: SendResult = { sent: [], failed: [] };

  for (const [index, item] of planned.entries()) {
    if (index > 0 && pauseMs > 0) await sleep(pauseMs);

    const email = buildInviteEmail(item, build);
    try {
      const { error } = await send(email);
      if (error) throw new Error(error);
      await record(item.launch.launch_id, item.launch.sequence);
      result.sent.push({
        launch: item.launch.name,
        reason: item.reason,
        subject: email.subject,
      });
    } catch (e) {
      result.failed.push({
        launch: item.launch.name,
        error: e instanceof Error ? e.message : "unknown",
      });
    }
  }

  return result;
}
