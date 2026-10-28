import { NextRequest, NextResponse } from "next/server";
import { buildBookingInvite, VENUE_ORGANIZER } from "@/utils/red-fern/ics";
import { findBooking } from "@/utils/red-fern/server/store";

/**
 * The calendar invitation for one booking, by confirmation code.
 *
 * The confirmation screen links here so a guest whose mail client swallowed the
 * attachment can still add the date, and so the demo can show a real .ics
 * without sending anything.
 */
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ reference: string }> }
) {
  const { reference } = await params;
  const booking = await findBooking(reference.toUpperCase());
  if (!booking) {
    return NextResponse.json({ error: "No booking with that confirmation code" }, { status: 404 });
  }

  const body = buildBookingInvite(booking, { organizer: VENUE_ORGANIZER });

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8; method=REQUEST",
      "Content-Disposition": `attachment; filename="red-fern-${booking.reference.toLowerCase()}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
