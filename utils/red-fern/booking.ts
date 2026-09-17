/**
 * Turning a form submission into a booking.
 *
 * Validation lives here rather than in the route so the same rules can be
 * exercised without a server: the API route reads the body, calls
 * `prepareBooking`, and either writes the row it gets back or returns the
 * message it was handed.
 */

import { getExperience, type Experience } from "./catalog";
import { buildQuote, clampParty, resolveDuration, resolveSlot, type Quote } from "./pricing";
import type { Booking } from "./availability";

export type BookingRequestInput = {
  experienceId?: unknown;
  startDate?: unknown;
  durationId?: unknown;
  slotId?: unknown;
  partySize?: unknown;
  addOnIds?: unknown;
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  notes?: unknown;
};

export type PreparedBooking = {
  booking: Booking;
  experience: Experience;
  quote: Quote;
};

export type PrepareResult =
  | { ok: true; value: PreparedBooking }
  | { ok: false; error: string; field?: string };

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
// Deliberately loose: the confirmation email is the real check on an address.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Unambiguous alphabet: no O/0, I/1, so a reference can be read over a phone. */
const REFERENCE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateReference(random: () => number = Math.random): string {
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += REFERENCE_ALPHABET[Math.floor(random() * REFERENCE_ALPHABET.length)];
  }
  return `RF-${out}`;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function prepareBooking(
  input: BookingRequestInput,
  options: { now?: Date; reference?: string; status?: Booking["status"] } = {}
): PrepareResult {
  const experience = getExperience(asString(input.experienceId));
  if (!experience) return { ok: false, error: "Pick what you'd like to book.", field: "experienceId" };

  const startDate = asString(input.startDate);
  if (!DATE_PATTERN.test(startDate)) {
    return { ok: false, error: "Pick a date on the calendar.", field: "startDate" };
  }

  const duration = resolveDuration(experience, asString(input.durationId));
  const slot = resolveSlot(experience, asString(input.slotId));
  if (!duration || !slot) {
    return { ok: false, error: "Pick a time to start.", field: "slotId" };
  }

  const requestedParty = Number(input.partySize);
  if (!Number.isFinite(requestedParty)) {
    return { ok: false, error: `How many ${experience.party.label.toLowerCase()}?`, field: "partySize" };
  }
  if (
    Math.round(requestedParty) < experience.party.min ||
    Math.round(requestedParty) > experience.party.max
  ) {
    return {
      ok: false,
      error: `${experience.name} takes ${experience.party.min} to ${experience.party.max} ${experience.party.label.toLowerCase()}.`,
      field: "partySize",
    };
  }
  const partySize = clampParty(experience, requestedParty);

  const offered = new Set(experience.addOns.map((addOn) => addOn.id));
  const addOnIds = Array.isArray(input.addOnIds)
    ? input.addOnIds.filter((id): id is string => typeof id === "string" && offered.has(id))
    : [];

  const name = asString(input.name);
  if (name.length < 2) return { ok: false, error: "Tell us who to put on the reservation.", field: "name" };

  const email = asString(input.email);
  if (!EMAIL_PATTERN.test(email)) {
    return { ok: false, error: "We need a working email to send the confirmation to.", field: "email" };
  }

  const quote = buildQuote(experience, {
    experienceId: experience.id,
    startDate,
    durationId: duration.id,
    slotId: slot.id,
    partySize,
    addOnIds,
  });

  const now = options.now ?? new Date();

  const booking: Booking = {
    reference: options.reference ?? generateReference(),
    experience_id: experience.id,
    start_date: startDate,
    days: quote.days,
    slot_id: slot.id,
    start_time: slot.start,
    hours: slot.hours,
    party_size: partySize,
    add_on_ids: addOnIds,
    guest_name: name,
    guest_email: email,
    guest_phone: asString(input.phone) || null,
    notes: asString(input.notes) || null,
    // A tour costs nothing and needs nothing but a slot, so it confirms itself.
    // Anything with money attached is held until a deposit clears.
    status: options.status ?? (quote.total === 0 ? "confirmed" : "requested"),
    total: quote.total,
    deposit_due: quote.depositDue,
    created_at: now.toISOString(),
    sequence: 0,
  };

  return { ok: true, value: { booking, experience, quote } };
}
