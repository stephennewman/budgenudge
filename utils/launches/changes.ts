/**
 * Diffing between the stored launch schedule and what the API now reports.
 *
 * Distinguishes changes that should re-alert a subscriber (T-0 moved, pad
 * moved, launch scrubbed or reinstated) from routine churn (status wording,
 * weather odds, a filled-in mission blurb). Only the former bumps SEQUENCE,
 * because every bump is a fresh notification on someone's phone.
 *
 * Pure functions, no Next.js or Supabase imports.
 */

import { formatLocalTime } from "./ics";
import type { LaunchRecord } from "./source";

export type StoredLaunch = LaunchRecord & {
  sequence: number;
  cancelled: boolean;
  last_change: string | null;
};

export type ChangeKind = "new" | "rescheduled" | "updated" | "unchanged";

export type LaunchDiff = {
  launch_id: string;
  kind: ChangeKind;
  /** Human summary of a rescheduling, null for every other kind. */
  summary: string | null;
  /** The row to write, with sequence and cancelled already resolved. */
  row: StoredLaunch;
};

/**
 * Compare two timestamps by instant rather than by text. Rows read back from
 * Postgres carry a `+00:00` offset while the API sends `Z`, so comparing the
 * strings would report a reschedule on every single run.
 */
function sameInstant(a: string | null, b: string | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const left = Date.parse(a);
  const right = Date.parse(b);
  if (Number.isNaN(left) || Number.isNaN(right)) return false;
  return left === right;
}

/** Fields that change the calendar entry itself rather than its trimmings. */
function describeReschedule(previous: StoredLaunch, next: LaunchRecord): string | null {
  const parts: string[] = [];

  if (!sameInstant(previous.net, next.net)) {
    parts.push(
      `T-0 moved from ${formatLocalTime(previous.net)} to ${formatLocalTime(next.net)}`
    );
  }
  if (previous.net_precision !== next.net_precision) {
    // MIN -> DAY turns a timed event into an all-day one and vice versa.
    parts.push(`timing precision changed from ${previous.net_precision} to ${next.net_precision}`);
  }
  if (previous.pad_name !== next.pad_name) {
    parts.push(`pad moved from ${previous.pad_name ?? "unknown"} to ${next.pad_name ?? "unknown"}`);
  }
  if (previous.cancelled) {
    parts.push("back on the schedule");
  }

  if (parts.length === 0) return null;
  return parts.join("; ");
}

/** True when anything a subscriber reads on the event has changed. */
function hasContentChange(previous: StoredLaunch, next: LaunchRecord): boolean {
  const fields: (keyof LaunchRecord)[] = [
    "name",
    "provider",
    "rocket",
    "mission_name",
    "mission_description",
    "orbit",
    "pad_location",
    "status",
    "status_name",
    "probability",
    "webcast_url",
    "info_url",
    "image_url",
  ];
  if (fields.some((field) => previous[field] !== next[field])) return true;
  return (
    !sameInstant(previous.window_start, next.window_start) ||
    !sameInstant(previous.window_end, next.window_end)
  );
}

/**
 * Resolve one upstream launch against what is already stored.
 *
 * A launch seen for the first time starts at SEQUENCE 0 rather than being
 * treated as a change, so subscribing mid-manifest doesn't fire a burst of
 * "rescheduled" alerts.
 */
export function diffLaunch(previous: StoredLaunch | undefined, next: LaunchRecord): LaunchDiff {
  if (!previous) {
    return {
      launch_id: next.launch_id,
      kind: "new",
      summary: null,
      row: { ...next, sequence: 0, cancelled: false, last_change: null },
    };
  }

  const summary = describeReschedule(previous, next);
  if (summary) {
    return {
      launch_id: next.launch_id,
      kind: "rescheduled",
      summary,
      row: {
        ...next,
        sequence: previous.sequence + 1,
        cancelled: false,
        last_change: summary,
      },
    };
  }

  return {
    launch_id: next.launch_id,
    kind: hasContentChange(previous, next) ? "updated" : "unchanged",
    summary: null,
    // Same slot, same notification: carry the sequence forward untouched.
    row: {
      ...next,
      sequence: previous.sequence,
      cancelled: false,
      last_change: previous.last_change,
    },
  };
}

/**
 * Stored launches that have dropped off the upstream schedule.
 *
 * Two ways that happens: the launch is gone from the Florida manifest
 * entirely, or it slipped to a date too vague to calendar and so no longer
 * normalizes. Either way the subscriber should stop holding the slot, so the
 * row is kept and published as CANCELLED rather than deleted.
 *
 * Launches whose T-0 has already passed are left alone — they leave the
 * "upcoming" endpoint by flying, not by being scrubbed.
 */
export function detectScrubs(
  stored: StoredLaunch[],
  upstreamIds: Set<string>,
  options: { now?: Date; graceMs?: number } = {}
): LaunchDiff[] {
  const { now = new Date(), graceMs = 12 * 3_600_000 } = options;
  const cutoff = now.getTime() - graceMs;

  const scrubs: LaunchDiff[] = [];
  for (const row of stored) {
    if (row.cancelled) continue;
    if (upstreamIds.has(row.launch_id)) continue;
    if (Date.parse(row.net) < cutoff) continue;

    const summary = "Dropped from the published launch schedule";
    scrubs.push({
      launch_id: row.launch_id,
      kind: "rescheduled",
      summary,
      row: { ...row, sequence: row.sequence + 1, cancelled: true, last_change: summary },
    });
  }
  return scrubs;
}
