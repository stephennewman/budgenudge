import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAuthorizedCron } from "@/utils/auth/api-auth";
import { detectScrubs, diffLaunch, type StoredLaunch } from "@/utils/launches/changes";
import { fetchFloridaLaunches } from "@/utils/launches/source";

/**
 * Keeps launch_schedule in step with the published Florida manifest.
 *
 * Runs hourly. Everything downstream is derived from this table, so the
 * subscribed calendar picks up a slipped T-0, a brand new launch, or a scrub
 * without anyone touching it.
 *
 * Pass ?dry=1 to see what the run would write without writing it.
 */
export const maxDuration = 60;

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
    const now = new Date().toISOString();

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
      return NextResponse.json({ success: true, dryRun: true, ...report });
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

    return NextResponse.json({ success: true, ...report });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "unknown" },
      { status: 500 }
    );
  }
}
