import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isAuthorizedCron } from "@/utils/auth/api-auth";
import { detectScrubs, diffLaunch, type StoredLaunch } from "@/utils/launches/changes";
import {
  canSendLaunchInvites,
  listLaunchSubscriberEmails,
  loadInviteReceipts,
  planInvitesForSubscriber,
  sendPlannedInvitesToEmail,
} from "@/utils/launches/deliver";
import {
  DEFAULT_INVITE_COUNT,
  type InvitableLaunch,
  type SendResult,
} from "@/utils/launches/invite";
import { fetchFloridaLaunches } from "@/utils/launches/source";

/**
 * Keeps launch_schedule in step with the published Florida manifest, then
 * emails calendar invites to everyone on the subscribe list.
 *
 * Runs hourly. A new T-0, a slip, or a scrub is emailed to each subscriber
 * that does not already hold that version of the invite.
 *
 * Pass ?dry=1 to see what the run would write and send without doing either.
 */
export const maxDuration = 60;

const inviteCount = () => {
  const parsed = Number(process.env.LAUNCH_INVITE_COUNT);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : DEFAULT_INVITE_COUNT;
};

async function deliverInvites(
  supabase: SupabaseClient,
  now: Date
): Promise<(SendResult & { recipients: number; skipped?: string })> {
  const empty: SendResult & { recipients: number } = { sent: [], failed: [], recipients: 0 };
  if (!canSendLaunchInvites()) {
    return { ...empty, skipped: "invites only send in production" };
  }

  const { data, error } = await supabase.from("launch_schedule").select("*").limit(2000);
  if (error) return { ...empty, skipped: error.message };

  const subscribers = await listLaunchSubscriberEmails(supabase);
  if (subscribers.length === 0) return { ...empty, skipped: "no subscribers" };

  const launches = (data ?? []) as InvitableLaunch[];
  const combined: SendResult & { recipients: number } = {
    sent: [],
    failed: [],
    recipients: subscribers.length,
  };

  for (const email of subscribers) {
    const receipts = await loadInviteReceipts(supabase, email);
    const planned = planInvitesForSubscriber(launches, receipts, {
      now,
      limit: inviteCount(),
    });
    if (planned.length === 0) continue;
    const result = await sendPlannedInvitesToEmail(supabase, email, planned, now);
    combined.sent.push(...result.sent);
    combined.failed.push(...result.failed);
  }

  return combined;
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = request.nextUrl.searchParams.get("dry") === "1";

  try {
    const { launches, floridaSeen, complete } = await fetchFloridaLaunches();

    if (launches.length === 0 && !complete) {
      return NextResponse.json(
        { success: false, error: "Launch Library API unavailable" },
        { status: 502 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: existing, error: readError } = await supabase
      .from("launch_schedule")
      .select("*")
      .limit(2000);

    if (readError) {
      return NextResponse.json(
        { success: false, error: readError.message },
        { status: 500 }
      );
    }

    const stored = (existing ?? []) as StoredLaunch[];
    const byId = new Map(stored.map((row) => [row.launch_id, row]));

    const diffs = launches.map((launch) => diffLaunch(byId.get(launch.launch_id), launch));

    // A partial fetch can't tell "gone from the schedule" from "never paged in",
    // so a failed page means no cancellations this run.
    const scrubs = complete
      ? detectScrubs(stored, new Set(launches.map((l) => l.launch_id)))
      : [];

    const changed = [...diffs.filter((d) => d.kind !== "unchanged"), ...scrubs];
    const runAt = new Date();
    const now = runAt.toISOString();

    const report = {
      floridaSeen,
      schedulable: launches.length,
      added: diffs.filter((d) => d.kind === "new").length,
      rescheduled: diffs.filter((d) => d.kind === "rescheduled").length,
      updated: diffs.filter((d) => d.kind === "updated").length,
      unchanged: diffs.filter((d) => d.kind === "unchanged").length,
      cancelled: scrubs.length,
      changes: changed
        .filter((d) => d.summary)
        .map((d) => ({ launch: d.row.name, change: d.summary })),
      partialFetch: !complete,
    };

    if (dryRun) {
      const projected = new Map<string, InvitableLaunch>(
        stored.map((row) => [row.launch_id, row as InvitableLaunch])
      );
      for (const diff of changed) {
        projected.set(diff.launch_id, { ...diff.row });
      }
      const projectedRows = [...projected.values()];
      const subscribers = await listLaunchSubscriberEmails(supabase);
      const wouldInvite = [];
      for (const email of subscribers) {
        const receipts = await loadInviteReceipts(supabase, email);
        const planned = planInvitesForSubscriber(projectedRows, receipts, {
          now: runAt,
          limit: inviteCount(),
        });
        wouldInvite.push(
          ...planned.map((p) => ({
            to: email,
            launch: p.launch.name,
            reason: p.reason,
            method: p.method,
          }))
        );
      }

      return NextResponse.json({
        success: true,
        dryRun: true,
        ...report,
        recipients: subscribers.length,
        wouldInvite,
      });
    }

    if (changed.length > 0) {
      const { error: writeError } = await supabase.from("launch_schedule").upsert(
        changed.map((diff) => ({ ...diff.row, last_seen_at: now, updated_at: now })),
        { onConflict: "launch_id" }
      );
      if (writeError) {
        return NextResponse.json(
          { success: false, error: writeError.message },
          { status: 500 }
        );
      }
    }

    // Touch everything still on the manifest so a stale row is recognizable.
    if (launches.length > 0) {
      await supabase
        .from("launch_schedule")
        .update({ last_seen_at: now })
        .in(
          "launch_id",
          launches.map((l) => l.launch_id)
        );
    }

    const invites = await deliverInvites(supabase, runAt);

    return NextResponse.json({ success: true, ...report, invites });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "unknown" },
      { status: 500 }
    );
  }
}
