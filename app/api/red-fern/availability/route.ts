import { NextRequest, NextResponse } from "next/server";
import { getExperience } from "@/utils/red-fern/catalog";
import { buildAvailability } from "@/utils/red-fern/availability";
import { resolveDuration } from "@/utils/red-fern/pricing";
import { addDays, daysBetween, todayAtVenue } from "@/utils/red-fern/dates";
import { loadBookings } from "@/utils/red-fern/server/store";

/**
 * Open dates for one offering.
 *
 * The booking calendar asks for a month at a time; `duration` matters because
 * three mornings of duck hunting only opens a date when all three mornings are
 * clear. Guest details never leave the server — a day carries only what is on
 * it ("Private event", "Wedding Weekend"), never who booked it.
 */
export const dynamic = "force-dynamic";

/** A month of a calendar grid, plus the spill from neighbouring months. */
const MAX_RANGE_DAYS = 62;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const experience = getExperience(params.get("experience") ?? "");
  if (!experience) {
    return NextResponse.json({ error: "Unknown experience" }, { status: 400 });
  }

  const today = todayAtVenue();
  const from = params.get("from") ?? today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) {
    return NextResponse.json({ error: "from must be YYYY-MM-DD" }, { status: 400 });
  }

  const requestedTo = params.get("to");
  const to =
    requestedTo && /^\d{4}-\d{2}-\d{2}$/.test(requestedTo)
      ? requestedTo
      : addDays(from, 41);
  if (daysBetween(from, to) < 0 || daysBetween(from, to) > MAX_RANGE_DAYS) {
    return NextResponse.json({ error: "Range too wide" }, { status: 400 });
  }

  const duration = resolveDuration(experience, params.get("duration") ?? "");

  // A multi-day booking reaches past the end of the window, so the schedule is
  // read a little wider than the range being reported on.
  const { bookings, backend } = await loadBookings({
    from: addDays(from, -14),
  });

  const days = buildAvailability({
    experience,
    durationDays: Math.max(1, duration?.days ?? 1),
    from,
    to,
    bookings,
    today,
  });

  return NextResponse.json(
    { experienceId: experience.id, durationId: duration?.id, today, days, backend },
    { headers: { "Cache-Control": "no-store" } }
  );
}
