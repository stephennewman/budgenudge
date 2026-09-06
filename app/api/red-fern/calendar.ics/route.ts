import { NextRequest, NextResponse } from "next/server";
import { buildVenueFeed } from "@/utils/red-fern/ics";
import { addDays, todayAtVenue } from "@/utils/red-fern/dates";
import { loadBookings } from "@/utils/red-fern/server/store";
import { scheduleCode } from "@/utils/red-fern/server/access";

/**
 * The venue's own schedule as a subscribable calendar.
 *
 * This one carries guest names, phone numbers and money, so it is gated on the
 * same code as the private schedule page. Calendar clients can't send headers,
 * which is why the code rides in the query string.
 */
export const dynamic = "force-dynamic";

/** How much history to keep in the feed, so last weekend stays visible. */
const HISTORY_DAYS = 45;

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("key") !== scheduleCode()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { bookings } = await loadBookings({ from: addDays(todayAtVenue(), -HISTORY_DAYS) });
  const body = buildVenueFeed(bookings);

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="red-fern-schedule.ics"',
      "Cache-Control": "no-store",
    },
  });
}
