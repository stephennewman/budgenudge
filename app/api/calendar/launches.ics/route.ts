import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildLaunchFeed, type CalendarLaunch } from "@/utils/launches/ics";

/**
 * Subscribable iCalendar feed of Florida launches.
 *
 * Subscribe once in Google/Apple/Outlook Calendar and the client re-reads this
 * URL on its own schedule: new launches appear, slipped launches move, and
 * scrubbed launches disappear, with no further action.
 *
 * Set LAUNCH_FEED_TOKEN to require ?key=<token>. Calendar clients can't send
 * headers, so the secret has to ride in the query string.
 */
export const dynamic = "force-dynamic";

/**
 * UIDs are namespaced to a fixed domain rather than the request host, so a
 * preview deployment can't hand out events that duplicate the production ones.
 */
const UID_DOMAIN = "krezzo.com";

/** How much flown history to keep in the feed. */
const HISTORY_DAYS = 30;

export async function GET(request: NextRequest) {
  const requiredToken = process.env.LAUNCH_FEED_TOKEN;
  if (requiredToken && request.nextUrl.searchParams.get("key") !== requiredToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const since = new Date(Date.now() - HISTORY_DAYS * 86_400_000).toISOString();
    const { data, error } = await supabase
      .from("launch_schedule")
      .select("*")
      .gte("net", since)
      .order("net", { ascending: true })
      .limit(500);

    if (error) throw new Error(error.message);

    // An empty VCALENDAR is still valid, and is the right answer before the
    // first sync runs — better than handing the client an error it will cache.
    const body = buildLaunchFeed((data ?? []) as CalendarLaunch[], { domain: UID_DOMAIN });

    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="florida-launches.ics"',
        "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "unknown" },
      { status: 500 }
    );
  }
}
