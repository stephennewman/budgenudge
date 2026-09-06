/**
 * Where bookings live, and how mail goes out.
 *
 * The demo has to run in three situations, so both sides degrade instead of
 * failing:
 *  - Supabase configured and migrated → rows persist in `red_fern_bookings`.
 *  - No Supabase, or the migration hasn't run → an in-process store seeded with
 *    a plausible schedule, so the calendar still has something on it.
 *  - No Resend key → the confirmation email is built and returned for display
 *    rather than sent, which is what the confirmation screen renders.
 *
 * This is the only module in utils/red-fern that reaches outside the process,
 * which is what keeps the rest of the folder compilable on its own for tests.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Booking } from "../availability";
import type { BookingEmail } from "../email";
import { buildSeedBookings } from "../seed";
import { todayAtVenue } from "../dates";

const TABLE = "red_fern_bookings";

export type Backend = "supabase" | "memory";

type MemoryStore = { seededFor: string | null; bookings: Booking[] };

/**
 * Held on globalThis so the schedule survives Next's dev-mode module reloads;
 * a booking made in one request has to be visible to the next one.
 */
const memory: MemoryStore = ((globalThis as Record<string, unknown>).__redFernStore ??= {
  seededFor: null,
  bookings: [],
}) as MemoryStore;

function memoryBookings(now: Date): Booking[] {
  const today = todayAtVenue(now);
  // Re-seed when the demo rolls over to a new day so the schedule never drifts
  // into the past; anything booked through the flow is carried across.
  if (memory.seededFor !== today) {
    const guestBookings = memory.bookings.filter((booking) => !booking.reference.startsWith("RF-SEED"));
    const seeded = buildSeedBookings(today, now);
    const seededRefs = new Set(seeded.map((b) => b.reference));
    memory.bookings = [
      ...seeded,
      ...guestBookings.filter((booking) => !seededRefs.has(booking.reference)),
    ];
    memory.seededFor = today;
  }
  return memory.bookings;
}

function supabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  try {
    return createClient(url, key);
  } catch {
    return null;
  }
}

export type LoadResult = { bookings: Booking[]; backend: Backend };

/**
 * Every booking from `from` forward, oldest first.
 *
 * A Supabase error here means the project is reachable but the table isn't
 * there yet, which is a normal state for a demo that hasn't been migrated —
 * so it falls back rather than throwing.
 */
export async function loadBookings(options: { from?: string; now?: Date } = {}): Promise<LoadResult> {
  const now = options.now ?? new Date();
  const from = options.from ?? todayAtVenue(now);

  const supabase = supabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select("*")
        .gte("start_date", from)
        .order("start_date", { ascending: true })
        .limit(500);
      if (!error) {
        return { bookings: (data ?? []) as Booking[], backend: "supabase" };
      }
    } catch {
      // fall through to memory
    }
  }

  return {
    bookings: memoryBookings(now)
      .filter((booking) => booking.start_date >= from)
      .sort((a, b) => a.start_date.localeCompare(b.start_date)),
    backend: "memory",
  };
}

export async function saveBooking(booking: Booking): Promise<Backend> {
  const supabase = supabaseClient();
  if (supabase) {
    try {
      const { error } = await supabase.from(TABLE).insert(booking);
      if (!error) return "supabase";
    } catch {
      // fall through to memory
    }
  }

  memoryBookings(new Date());
  memory.bookings = [...memory.bookings.filter((b) => b.reference !== booking.reference), booking];
  return "memory";
}

export async function findBooking(reference: string): Promise<Booking | null> {
  const supabase = supabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select("*")
        .eq("reference", reference)
        .maybeSingle();
      if (!error && data) return data as Booking;
    } catch {
      // fall through to memory
    }
  }
  return memoryBookings(new Date()).find((booking) => booking.reference === reference) ?? null;
}

export type DeliveryResult = {
  delivered: boolean;
  /** Set when nothing was sent, so the UI can say why. */
  reason?: string;
  id?: string;
};

/**
 * Send the confirmation, if there's anything to send it with.
 *
 * Resend is called through its REST API rather than the SDK so the
 * `content_type` on the calendar attachment survives; without the `method=`
 * parameter a mail client shows a file to download instead of an invitation.
 */
export async function deliverEmail(email: BookingEmail): Promise<DeliveryResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { delivered: false, reason: "RESEND_API_KEY is not set — showing the message instead." };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: email.from,
        to: [email.to],
        reply_to: email.replyTo,
        subject: email.subject,
        text: email.text,
        html: email.html,
        attachments: email.attachments,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      return { delivered: false, reason: `Resend returned ${response.status}: ${detail.slice(0, 200)}` };
    }

    const body = (await response.json()) as { id?: string };
    return { delivered: true, id: body.id };
  } catch (e) {
    return { delivered: false, reason: e instanceof Error ? e.message : "Delivery failed" };
  }
}

/** The From: address, which has to be on a domain verified with Resend. */
export function senderAddress(): string {
  return process.env.RED_FERN_FROM_EMAIL ?? "Red Fern Plantation <onboarding@resend.dev>";
}
