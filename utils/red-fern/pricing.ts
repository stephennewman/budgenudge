/**
 * The quote engine.
 *
 * One function turns a booking request into the itemized estimate that the
 * booking flow shows live, the confirmation email repeats, and the private
 * schedule totals up. Because it is pure, the number a guest sees on the page
 * and the number on their confirmation can't disagree.
 */

import {
  VENUE,
  type AddOn,
  type Experience,
  type RateUnit,
} from "./catalog";
import { dateRange, weekdayOf } from "./dates";

export type LineKind = "base" | "party" | "discount" | "surcharge" | "fee" | "add-on" | "tax";

export type QuoteLine = {
  id: string;
  label: string;
  detail?: string;
  amount: number;
  kind: LineKind;
  /** Lodging fees and taxes are not themselves taxable. */
  taxable?: boolean;
};

export type QuoteRequest = {
  experienceId: string;
  startDate: string;
  durationId: string;
  slotId: string;
  partySize: number;
  addOnIds: string[];
};

export type Quote = {
  experienceId: string;
  experienceName: string;
  startDate: string;
  days: number;
  slotId: string;
  slotLabel: string;
  startTime: string;
  hours: number;
  partySize: number;
  partyLabel: string;
  durationLabel: string;
  lines: QuoteLine[];
  subtotal: number;
  tax: number;
  total: number;
  depositDue: number;
  balanceDue: number;
  balanceDueDays: number;
  /** e.g. `$325 per gun, per morning`. */
  rateSummary: string;
};

/** Whole cents, so a 10% package discount can't leave a fraction behind. */
function round(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/** Clamp a requested party size into what the offering can actually host. */
export function clampParty(experience: Experience, requested: number): number {
  const size = Number.isFinite(requested) ? Math.round(requested) : experience.party.min;
  return Math.min(experience.party.max, Math.max(experience.party.min, size));
}

function unitSuffix(experience: Experience): string {
  switch (experience.unit) {
    case "per_gun":
      return `per ${experience.party.singular}, per day`;
    case "per_person_per_day":
      return "per person, per day";
    case "per_night":
      return "per night";
    case "per_guest":
      return "per guest";
    default:
      return "per day";
  }
}

/** How many times an add-on's price is charged. */
function addOnMultiplier(unit: RateUnit, partySize: number, days: number): number {
  switch (unit) {
    case "per_gun":
    case "per_person_per_day":
      return partySize * days;
    case "per_guest":
      return partySize;
    case "per_night":
      return days;
    default:
      return 1;
  }
}

function addOnDetail(addOn: AddOn, partySize: number, days: number): string | undefined {
  const multiplier = addOnMultiplier(addOn.unit, partySize, days);
  if (multiplier === 1) return undefined;
  const each = `$${addOn.price.toLocaleString("en-US")} ×`;
  switch (addOn.unit) {
    case "per_guest":
      return `${each} ${partySize} guests`;
    case "per_night":
      return `${each} ${days} night${days === 1 ? "" : "s"}`;
    default:
      return `${each} ${multiplier}`;
  }
}

export function resolveDuration(experience: Experience, durationId: string) {
  return (
    experience.durations.find((d) => d.id === durationId) ?? experience.durations[0]
  );
}

export function resolveSlot(experience: Experience, slotId: string) {
  return experience.slots.find((s) => s.id === slotId) ?? experience.slots[0];
}

/**
 * Price a request.
 *
 * Ordering matters for readability: what you're buying, who's coming, what it
 * saved you, what the calendar costs you, then fees, extras and tax.
 */
export function buildQuote(experience: Experience, request: QuoteRequest): Quote {
  const duration = resolveDuration(experience, request.durationId);
  const slot = resolveSlot(experience, request.slotId);
  const days = Math.max(1, duration.days);
  const partySize = clampParty(experience, request.partySize);
  const lines: QuoteLine[] = [];

  const dayWord = experience.unit === "per_night" ? "night" : "day";
  const baseUnits =
    experience.unit === "per_gun" || experience.unit === "per_person_per_day"
      ? partySize * days
      : days;
  const baseAmount = round(experience.baseRate * baseUnits);

  if (baseAmount > 0) {
    const detail =
      experience.unit === "per_gun" || experience.unit === "per_person_per_day"
        ? `$${experience.baseRate.toLocaleString("en-US")} × ${partySize} ${
            experience.party.label.toLowerCase()
          } × ${days} ${dayWord}${days === 1 ? "" : "s"}`
        : `$${experience.baseRate.toLocaleString("en-US")} × ${days} ${dayWord}${
            days === 1 ? "" : "s"
          }`;
    lines.push({
      id: "base",
      label: `${experience.name}${days > 1 ? ` — ${duration.label.toLowerCase()}` : ""}`,
      detail,
      amount: baseAmount,
      kind: "base",
      taxable: true,
    });
  } else {
    lines.push({
      id: "base",
      label: `${experience.name} — complimentary`,
      detail: "No charge, and no obligation",
      amount: 0,
      kind: "base",
    });
  }

  // Head count past what the flat rate covers. Charged per night for the
  // lodge, where an extra guest costs something every night, and once for an
  // event, where they cost a chair and a plate.
  const { included, overagePrice } = experience.party;
  if (included !== undefined && overagePrice && partySize > included) {
    const heads = partySize - included;
    const nights = experience.unit === "per_night" ? days : 1;
    lines.push({
      id: "party-overage",
      label: `Additional guests over ${included}`,
      detail: `$${overagePrice} × ${heads}${nights > 1 ? ` × ${nights} nights` : ""}`,
      amount: round(overagePrice * heads * nights),
      kind: "party",
      taxable: true,
    });
  }

  if (duration.discount) {
    const discountable = lines
      .filter((line) => line.kind === "base")
      .reduce((sum, line) => sum + line.amount, 0);
    const amount = round(-discountable * duration.discount);
    if (amount !== 0) {
      lines.push({
        id: "package-discount",
        label: duration.note ?? `${Math.round(duration.discount * 100)}% package rate`,
        detail: duration.label,
        amount,
        kind: "discount",
        taxable: true,
      });
    }
  }

  const dates = dateRange(request.startDate, days);

  if (experience.saturdaySurcharge && dates.some((date) => weekdayOf(date) === 6)) {
    lines.push({
      id: "saturday",
      label: "Saturday premium",
      detail: "Peak demand date",
      amount: experience.saturdaySurcharge,
      kind: "surcharge",
      taxable: true,
    });
  }

  if (experience.peakSurcharge && experience.peakMonths) {
    const month = Number(request.startDate.slice(5, 7));
    if (experience.peakMonths.includes(month)) {
      lines.push({
        id: "peak-season",
        label: "Peak season",
        detail: "April, May, October and November",
        amount: experience.peakSurcharge,
        kind: "surcharge",
        taxable: true,
      });
    }
  }

  if (experience.facilityFee) {
    lines.push({
      id: "facility-fee",
      label: "Setup, breakdown & cleaning",
      amount: experience.facilityFee,
      kind: "fee",
      taxable: true,
    });
  }

  const selected = new Set(request.addOnIds ?? []);
  for (const addOn of experience.addOns) {
    if (!selected.has(addOn.id)) continue;
    lines.push({
      id: `add-on:${addOn.id}`,
      label: addOn.name,
      detail: addOnDetail(addOn, partySize, days),
      amount: round(addOn.price * addOnMultiplier(addOn.unit, partySize, days)),
      kind: "add-on",
      taxable: true,
    });
  }

  // The state's per-night lodging fee is a pass-through, and Georgia doesn't
  // apply sales tax on top of it.
  if (experience.category === "stay") {
    lines.push({
      id: "lodging-fee",
      label: "Georgia lodging fee",
      detail: `$${VENUE.lodgingFeePerNight} × ${days} night${days === 1 ? "" : "s"}`,
      amount: round(VENUE.lodgingFeePerNight * days),
      kind: "fee",
      taxable: false,
    });
  }

  const subtotal = round(lines.reduce((sum, line) => sum + line.amount, 0));
  const taxable = round(
    lines.filter((line) => line.taxable).reduce((sum, line) => sum + line.amount, 0)
  );
  const tax = round(Math.max(0, taxable) * VENUE.taxRate);

  if (tax > 0) {
    lines.push({
      id: "tax",
      label: `Georgia sales tax (${(VENUE.taxRate * 100).toFixed(0)}%)`,
      amount: tax,
      kind: "tax",
    });
  }

  const total = round(subtotal + tax);
  const depositDue = round(total * experience.depositRate);

  return {
    experienceId: experience.id,
    experienceName: experience.name,
    startDate: request.startDate,
    days,
    slotId: slot.id,
    slotLabel: slot.label,
    startTime: slot.start,
    hours: slot.hours,
    partySize,
    partyLabel: experience.party.label,
    durationLabel: duration.label,
    lines,
    subtotal,
    tax,
    total,
    depositDue,
    balanceDue: round(total - depositDue),
    balanceDueDays: experience.balanceDueDays,
    rateSummary:
      experience.baseRate === 0
        ? "Complimentary"
        : `$${experience.baseRate.toLocaleString("en-US")} ${unitSuffix(experience)}`,
  };
}
