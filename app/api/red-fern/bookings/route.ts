import { NextRequest, NextResponse } from "next/server";
import { prepareBooking } from "@/utils/red-fern/booking";
import { checkSlot } from "@/utils/red-fern/availability";
import { buildBookingEmail } from "@/utils/red-fern/email";
import { VENUE_ORGANIZER } from "@/utils/red-fern/ics";
import { addDays, todayAtVenue } from "@/utils/red-fern/dates";
import { deliverEmail, loadBookings, saveBooking, senderAddress } from "@/utils/red-fern/server/store";

/**
 * Take a booking.
 *
 * The order matters. Validate and re-price on the server, because the browser's
 * copy of the rate card is a convenience and not the source of truth. Re-check
 * the slot against the live schedule immediately before writing, so a date that
 * filled while the guest was typing is refused rather than double-booked. Then
 * write, then send.
 *
 * The confirmation email is returned in the response either way: with a Resend
 * key it has already been sent, and without one the confirmation screen shows
 * the guest exactly what would have landed in their inbox.
 */
export const dynamic = "force-dynamic";

/**
 * How far back to read the schedule when checking a date.
 *
 * A booking that started last week can still be sitting on the date being
 * requested — a wedding weekend, a five-night lodge stay — so the conflict
 * check has to see rows that begin before the date it is testing.
 */
const LONGEST_BOOKING_DAYS = 14;

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON" }, { status: 400 });
  }

  const prepared = prepareBooking((body ?? {}) as Record<string, unknown>);
  if (!prepared.ok) {
    return NextResponse.json({ error: prepared.error, field: prepared.field }, { status: 400 });
  }

  const { booking, experience, quote } = prepared.value;
  const today = todayAtVenue();
  const { bookings } = await loadBookings({
    from: addDays(booking.start_date, -LONGEST_BOOKING_DAYS),
  });

  const check = checkSlot({
    experience,
    startDate: booking.start_date,
    days: booking.days,
    startTime: booking.start_time,
    hours: booking.hours,
    bookings,
    today,
  });
  if (!check.ok) {
    return NextResponse.json({ error: check.reason, field: "startDate" }, { status: 409 });
  }

  const backend = await saveBooking(booking);

  const origin = request.nextUrl.origin;
  const email = buildBookingEmail(booking, experience, quote, {
    from: senderAddress(),
    organizer: VENUE_ORGANIZER,
    manageUrl: `${origin}/red-fern`,
  });

  const delivery = await deliverEmail(email);

  return NextResponse.json({
    booking,
    quote,
    backend,
    delivery,
    email: {
      to: email.to,
      from: email.from,
      subject: email.subject,
      html: email.html,
      text: email.text,
      calendar: email.calendar,
    },
    inviteUrl: `/api/red-fern/bookings/${booking.reference}/invite.ics`,
  });
}
