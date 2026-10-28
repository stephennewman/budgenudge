/**
 * A believable book of business.
 *
 * The private schedule and the "already taken" markers on the public calendar
 * are only convincing if there is something on the books, so the demo seeds
 * itself relative to whatever today is: each entry names the kind of booking
 * and roughly how far out it should sit, and the seeder walks forward to the
 * first date that is in season, on an offered day of the week, and clear of
 * everything placed before it.
 *
 * Pure: give it a date, get a schedule.
 */

import { getExperience } from "./catalog";
import { buildQuote } from "./pricing";
import { checkSlot, type Booking } from "./availability";
import { addDays, weekdayOf } from "./dates";

type SeedSpec = {
  reference: string;
  experienceId: string;
  slotId: string;
  durationId: string;
  partySize: number;
  addOnIds: string[];
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  notes?: string;
  status: Booking["status"];
  /** Earliest offset from today to consider, in days. */
  earliest: number;
  /** Preferred day of the week, when the story calls for one. */
  weekday?: number;
};

const SEEDS: SeedSpec[] = [
  {
    reference: "RF-4MQ7KD",
    experienceId: "wedding",
    slotId: "all-day",
    durationId: "3-day",
    partySize: 185,
    addOnIds: ["catering", "bar", "lodge-block", "string-lights"],
    guestName: "Caroline Hollis",
    guestEmail: "caroline.hollis@example.com",
    guestPhone: "(229) 555-0182",
    notes: "Ceremony under the oaks at 5:30, dinner in the pavilion. Sparkler send-off.",
    status: "confirmed",
    earliest: 33,
    weekday: 5,
  },
  {
    reference: "RF-9TXR2B",
    experienceId: "corporate-retreat",
    slotId: "business-day",
    durationId: "2-day",
    partySize: 26,
    addOnIds: ["clays-tournament", "fish-fry"],
    guestName: "Dale Whitfield",
    guestEmail: "dwhitfield@example.com",
    guestPhone: "(912) 555-0117",
    notes: "Regional sales kickoff. Need the projector and a whiteboard.",
    status: "confirmed",
    earliest: 47,
    weekday: 2,
  },
  {
    reference: "RF-6JHW5N",
    experienceId: "family-gathering",
    slotId: "day",
    durationId: "1-day",
    partySize: 140,
    addOnIds: ["bbq", "hay-ride"],
    guestName: "Marcus Pridgen",
    guestEmail: "pridgenfamily@example.com",
    guestPhone: "(229) 555-0143",
    notes: "Forty-second annual Pridgen reunion. Bringing a bounce house.",
    status: "confirmed",
    earliest: 24,
    weekday: 6,
  },
  {
    reference: "RF-2KDP8V",
    experienceId: "rehearsal-dinner",
    slotId: "evening",
    durationId: "1-day",
    partySize: 55,
    addOnIds: ["low-country-boil", "smores"],
    guestName: "Anne Marie Sutton",
    guestEmail: "am.sutton@example.com",
    guestPhone: "(850) 555-0166",
    status: "requested",
    earliest: 61,
    weekday: 5,
  },
  {
    reference: "RF-7QZ3LC",
    experienceId: "duck-hunt",
    slotId: "first-light",
    durationId: "3-day",
    partySize: 6,
    addOnIds: ["bird-cleaning", "breakfast", "lodge-bunk"],
    guestName: "Walt Chesser",
    guestEmail: "wchesser@example.com",
    guestPhone: "(229) 555-0198",
    notes: "Same group as last January. Two dogs coming with us.",
    status: "confirmed",
    earliest: 20,
  },
  {
    reference: "RF-5NWB4T",
    experienceId: "quail-hunt",
    slotId: "full-day",
    durationId: "2-day",
    partySize: 4,
    addOnIds: ["bird-cleaning", "field-lunch", "lodge-bunk"],
    guestName: "Hollis Braswell",
    guestEmail: "hbraswell@example.com",
    guestPhone: "(229) 555-0155",
    status: "confirmed",
    earliest: 26,
  },
  {
    reference: "RF-3VLM9K",
    experienceId: "dove-shoot",
    slotId: "afternoon",
    durationId: "1-day",
    partySize: 16,
    addOnIds: ["bird-cleaning", "dove-supper"],
    guestName: "Tripp Calhoun",
    guestEmail: "tcalhoun@example.com",
    guestPhone: "(229) 555-0121",
    notes: "Company shoot — sixteen guns, mixed experience.",
    status: "confirmed",
    earliest: 9,
  },
  {
    reference: "RF-8HRC6X",
    experienceId: "sporting-clays",
    slotId: "afternoon",
    durationId: "single",
    partySize: 10,
    addOnIds: ["loaner-gun", "clays-instruction"],
    guestName: "Beau Tillman",
    guestEmail: "btillman@example.com",
    guestPhone: "(229) 555-0109",
    notes: "Bachelor party. Half the group has never shot before.",
    status: "confirmed",
    earliest: 12,
    weekday: 6,
  },
  {
    reference: "RF-1XPF7G",
    experienceId: "lodge-stay",
    slotId: "check-in",
    durationId: "2-night",
    partySize: 10,
    addOnIds: ["stocked-kitchen"],
    guestName: "Rachel Odum",
    guestEmail: "rodum@example.com",
    guestPhone: "(404) 555-0173",
    status: "confirmed",
    earliest: 15,
  },
  {
    reference: "RF-6BQK2W",
    experienceId: "property-tour",
    slotId: "golden",
    durationId: "single",
    partySize: 4,
    addOnIds: [],
    guestName: "Jenna Whidby",
    guestEmail: "jwhidby@example.com",
    guestPhone: "(229) 555-0164",
    notes: "Bringing her mother and the planner. Fall wedding, 200ish.",
    status: "confirmed",
    earliest: 4,
  },
  {
    reference: "RF-4CTN8M",
    experienceId: "property-tour",
    slotId: "morning",
    durationId: "single",
    partySize: 2,
    addOnIds: [],
    guestName: "Andre Lott",
    guestEmail: "alott@example.com",
    guestPhone: "(229) 555-0188",
    status: "requested",
    earliest: 7,
  },
];

/** How far ahead the seeder will hunt for a workable date. */
const SEARCH_DAYS = 400;

/**
 * Build the demo schedule as of `today` (`YYYY-MM-DD`).
 *
 * Each seed is placed on the first date that satisfies the offering's own
 * rules and doesn't collide with a seed already placed, so the result is a
 * schedule the availability rules would have accepted.
 */
export function buildSeedBookings(today: string, now: Date = new Date()): Booking[] {
  const placed: Booking[] = [];

  for (const spec of SEEDS) {
    const experience = getExperience(spec.experienceId);
    if (!experience) continue;

    const slot = experience.slots.find((s) => s.id === spec.slotId) ?? experience.slots[0];
    const duration =
      experience.durations.find((d) => d.id === spec.durationId) ?? experience.durations[0];

    for (let offset = spec.earliest; offset < SEARCH_DAYS; offset++) {
      const date = addDays(today, offset);
      if (spec.weekday !== undefined && weekdayOf(date) !== spec.weekday) continue;

      const check = checkSlot({
        experience,
        startDate: date,
        days: duration.days,
        startTime: slot.start,
        hours: slot.hours,
        bookings: placed,
        today,
      });
      if (!check.ok) continue;

      const quote = buildQuote(experience, {
        experienceId: experience.id,
        startDate: date,
        durationId: duration.id,
        slotId: slot.id,
        partySize: spec.partySize,
        addOnIds: spec.addOnIds,
      });

      placed.push({
        reference: spec.reference,
        experience_id: experience.id,
        start_date: date,
        days: quote.days,
        slot_id: slot.id,
        start_time: slot.start,
        hours: slot.hours,
        party_size: spec.partySize,
        add_on_ids: spec.addOnIds,
        guest_name: spec.guestName,
        guest_email: spec.guestEmail,
        guest_phone: spec.guestPhone,
        notes: spec.notes ?? null,
        status: spec.status,
        total: quote.total,
        deposit_due: quote.depositDue,
        // Backdated so the schedule doesn't look like it was all booked today.
        created_at: new Date(now.getTime() - (offset + 3) * 86_400_000).toISOString(),
        sequence: 0,
      });
      break;
    }
  }

  return placed.sort((a, b) => a.start_date.localeCompare(b.start_date));
}
