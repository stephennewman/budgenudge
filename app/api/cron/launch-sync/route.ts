import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { EMAIL_FROM_ALERTS, SITE_URL } from "@/lib/brand";
import { isAuthorizedCron } from "@/utils/auth/api-auth";
import { detectScrubs, diffLaunch, type StoredLaunch } from "@/utils/launches/changes";
import {
  DEFAULT_INVITE_COUNT,
  planLaunchInvites,
  sendLaunchInvites,
  type InvitableLaunch,
  type InviteEmail,
  type SendResult,
} from "@/utils/launches/invite";
import { fetchFloridaLaunches } from "@/utils/launches/source";

/** Resend reads `content_type`; the SDK's own type only declares `contentType`. */
type ResendAttachment = { filename: string; content: string; content_type: string };

/**
 * Keeps launch_schedule in step with the published Florida manifest, then
 * emails calendar invites for the launches coming up next.
 *
 * Runs hourly. Everything downstream is derived from this table, so the
 * subscribed calendar picks up a slipped T-0, a brand new launch, or a scrub
 * without anyone touching it.
 *
 * Pass ?dry=1 to see what the run would write and send without doing either.
 */
export const maxDuration = 60;

/** Recipient of the emailed invites. Unset disables them; the feed still works. */
const INVITE_EMAIL = process.env.LAUNCH_INVITE_EMAIL || "stephen.p.newman@gmail.com";

/** Scheduling identity on the invites; must be a domain Resend can send from. */
const ORGANIZER = { email: "alerts@krezzo.com", name: "Krezzo Launch Calendar" };

// Lazy-init so builds don't require RESEND_API_KEY at module load.
let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const inviteCount = () => {
  const parsed = Number(process.env.LAUNCH_INVITE_COUNT);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : DEFAULT_INVITE_COUNT;
};

async function deliverInvites(
  supabase: SupabaseClient,
  now: Date
): Promise<SendResult & { skipped?: string }> {
  const empty: SendResult = { sent: [], failed: [] };
  // Preview and local runs still sync the table and the feed; only production
  // emails invites, so a dry-run or a preview cron cannot hit the inbox.
  if (process.env.VERCEL_ENV !== "production") {
    return { ...empty, skipped: "invites only send in production" };
  }
  if (!INVITE_EMAIL) return { ...empty, skipped: "LAUNCH_INVITE_EMAIL not set" };
  if (!process.env.RESEND_API_KEY) return { ...empty, skipped: "RESEND_API_KEY not set" };

  const { data, error } = await supabase.from("launch_schedule").select("*").limit(2000);
  if (error) return { ...empty, skipped: error.message };

  const planned = planLaunchInvites((data ?? []) as InvitableLaunch[], {
    now,
    limit: inviteCount(),
  });
  if (planned.length === 0) return empty;

  return sendLaunchInvites(planned, {
    to: INVITE_EMAIL,
    from: EMAIL_FROM_ALERTS,
    organizer: ORGANIZER,
    subscribeUrl: `${SITE_URL}/launches`,
    now,
    send: async (email: InviteEmail) => {
      const { error: sendError } = await getResend().emails.send({
        from: email.from,
        to: email.to,
        subject: email.subject,
        text: email.text,
        html: email.html,
        // The SDK's Attachment type has no content_type field; see the note on
        // InviteEmail for why the snake_case one is the field that works.
        attachments: email.attachments as unknown as ResendAttachment[],
      });
      return { error: sendError ? sendError.message : null };
    },
    record: async (launchId, sequence) => {
      const { error: recordError } = await supabase
        .from("launch_schedule")
        .update({ invited_sequence: sequence, invited_at: now.toISOString() })
        .eq("launch_id", launchId);
      // Swallowing this would re-send the same invite every hour, so surface it
      // as a failure even though the mail itself went out.
      if (recordError) {
        throw new Error(`sent but not recorded: ${recordError.message}`);
      }
    },
  });
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
      // Preview the invites this run would send by applying the diffs in
      // memory, since nothing has been written for deliverInvites to read.
      const projected = new Map<string, InvitableLaunch>(
        stored.map((row) => [row.launch_id, row as InvitableLaunch])
      );
      for (const diff of changed) {
        const previous = projected.get(diff.launch_id);
        projected.set(diff.launch_id, {
          ...diff.row,
          invited_sequence: previous?.invited_sequence ?? null,
        });
      }

      return NextResponse.json({
        success: true,
        dryRun: true,
        ...report,
        wouldInvite: planLaunchInvites([...projected.values()], {
          now: runAt,
          limit: inviteCount(),
        }).map((p) => ({ launch: p.launch.name, reason: p.reason, method: p.method })),
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
