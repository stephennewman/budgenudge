/**
 * The Red Fern Plantation rate card.
 *
 * Everything the booking flow offers is described here: what can be booked,
 * when it can be booked, what it costs, and which part of the property it ties
 * up. Keeping it in one declarative table means the calendar, the quote, the
 * confirmation email and the private schedule all read from the same source,
 * so a rate change can't drift between the page and the invoice.
 *
 * Pure data and pure helpers only — no Next.js, Supabase or Resend imports —
 * so test/red-fern-test.js can compile this folder on its own.
 */

/** Valdosta, Georgia. Every date and time in the demo is Eastern. */
export const VENUE_TIME_ZONE = "America/New_York";

export const VENUE = {
  name: "Red Fern Plantation",
  city: "Valdosta",
  state: "Georgia",
  address: "4127 Red Fern Road, Valdosta, GA 31601",
  phone: "(229) 555-0134",
  email: "events@redfernplantation.com",
  latitude: 30.7749,
  longitude: -83.3088,
  acreage: 1_800,
  pavilionSquareFeet: 3_000,
  lodgeSleeps: 16,
  /** Lowndes County, GA combined sales tax. */
  taxRate: 0.08,
  /** Georgia's per-night state lodging fee. */
  lodgingFeePerNight: 5,
} as const;

/** How a base rate is multiplied out. */
export type RateUnit =
  | "flat" // one price for the whole property, per day
  | "per_gun" // per hunter, per day
  | "per_guest" // per guest, once
  | "per_person_per_day"
  | "per_night";

/**
 * The part of the property a booking ties up. Two bookings can share a day as
 * long as they need different ground; `property` takes everything.
 */
export type Resource =
  | "property"
  | "pavilion"
  | "lodge"
  | "duck-impoundments"
  | "quail-course"
  | "dove-field"
  | "clays-course";

export type Category = "tour" | "hunt" | "event" | "stay";

export type TimeSlot = {
  id: string;
  label: string;
  /** 24h local start, `HH:MM`. */
  start: string;
  /** Hours held, used for the calendar block and the invite. */
  hours: number;
};

/** A length option, e.g. a two-day hunt or a three-day wedding weekend. */
export type DurationOption = {
  id: string;
  label: string;
  /** Calendar days (or nights, for the lodge) the booking covers. */
  days: number;
  /** Package discount off the base rate, e.g. 0.1 for 10% off. */
  discount?: number;
  note?: string;
};

export type AddOn = {
  id: string;
  name: string;
  description: string;
  price: number;
  unit: RateUnit;
  /** Pre-checked in the booking flow; the guest can still remove it. */
  recommended?: boolean;
};

/** A window of the year an offering is open, inclusive, as `MM-DD`. */
export type Season = { label: string; start: string; end: string };

export type Experience = {
  id: string;
  name: string;
  category: Category;
  tagline: string;
  description: string;
  image: string;
  resource: Resource;
  /** True when the booking closes the whole plantation to other guests. */
  exclusive: boolean;
  unit: RateUnit;
  baseRate: number;
  /** Charged once per booking (cleaning, setup, field prep). */
  facilityFee?: number;
  /** What the party count means and how far it can move. */
  party: {
    label: string;
    singular: string;
    min: number;
    max: number;
    /** Guests covered by the base rate before per-head pricing kicks in. */
    included?: number;
    /** Charge for each head past `included`. */
    overagePrice?: number;
  };
  slots: TimeSlot[];
  durations: DurationOption[];
  /** Omitted when the offering runs year round. */
  seasons?: Season[];
  /** Days of the week it runs, 0 = Sunday. Omitted means any day. */
  daysOfWeek?: number[];
  /** Months (1-12) that carry a premium, e.g. wedding season. */
  peakMonths?: number[];
  peakSurcharge?: number;
  /** Saturdays command a premium on event rentals. */
  saturdaySurcharge?: number;
  /** Shortest notice accepted, in days. */
  leadTimeDays: number;
  /** Share of the total collected to hold the date. */
  depositRate: number;
  /** How far ahead of arrival the balance is due. */
  balanceDueDays: number;
  includes: string[];
  addOns: AddOn[];
};

const LODGING_ADD_ON: AddOn = {
  id: "lodge-bunk",
  name: "Lodge bunk",
  description: "A bed in the 16-bunk lodge, per hunter per night, breakfast included.",
  price: 185,
  unit: "per_gun",
};

const BIRD_CLEANING: AddOn = {
  id: "bird-cleaning",
  name: "Bird cleaning & packaging",
  description: "Birds dressed, vacuum-sealed and packed on ice for the ride home.",
  price: 35,
  unit: "per_gun",
  recommended: true,
};

const LOANER_GUN: AddOn = {
  id: "loaner-gun",
  name: "Loaner shotgun",
  description: "A fitted 12- or 20-gauge over/under for the day.",
  price: 45,
  unit: "per_gun",
};

const SHELLS: AddOn = {
  id: "shells",
  name: "Shells (two boxes)",
  description: "Two boxes of field loads per gun, per day.",
  price: 32,
  unit: "per_gun",
};

const PLANTATION_BREAKFAST: AddOn = {
  id: "breakfast",
  name: "Plantation breakfast",
  description: "Biscuits, sausage gravy, grits and coffee in the lodge before first light.",
  price: 24,
  unit: "per_gun",
  recommended: true,
};

export const EXPERIENCES: Experience[] = [
  {
    id: "property-tour",
    name: "Private Property Tour",
    category: "tour",
    tagline: "Walk the grounds with the family who runs them",
    description:
      "Forty-five minutes with an owner: the pavilion and covered porch, the ceremony lawn under the live oaks, the lodge, and a ride out to the impoundments. Bring your planner, your parents, or your whole wedding party.",
    image:
      "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=70",
    resource: "property",
    exclusive: false,
    unit: "flat",
    baseRate: 0,
    party: { label: "Guests", singular: "guest", min: 1, max: 12 },
    slots: [
      { id: "morning", label: "10:00 AM", start: "10:00", hours: 1 },
      { id: "midday", label: "1:00 PM", start: "13:00", hours: 1 },
      { id: "golden", label: "4:30 PM", start: "16:30", hours: 1 },
    ],
    durations: [{ id: "single", label: "45 minutes", days: 1 }],
    daysOfWeek: [1, 2, 3, 4, 5, 6],
    leadTimeDays: 1,
    depositRate: 0,
    balanceDueDays: 0,
    includes: [
      "Walk-through of the 3,000 sq ft pavilion and covered porch",
      "Ceremony lawn, bridal suite and lodge",
      "Ride out to the duck impoundments and quail course",
      "Rate sheet and preferred vendor list to take home",
    ],
    addOns: [],
  },
  {
    id: "duck-hunt",
    name: "Guided Duck Hunt",
    category: "hunt",
    tagline: "Flooded timber and managed impoundments at first light",
    description:
      "Meet at the lodge in the dark, ride out to a brushed blind, and hunt wood ducks, teal and mallards over 400 acres of managed impoundments. Guide, dog and decoys are ours; you bring a gun and waders.",
    image:
      "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1200&q=70",
    resource: "duck-impoundments",
    exclusive: false,
    unit: "per_gun",
    baseRate: 325,
    party: { label: "Guns", singular: "gun", min: 2, max: 8 },
    slots: [{ id: "first-light", label: "5:30 AM — first light", start: "05:30", hours: 5 }],
    durations: [
      { id: "1-day", label: "One morning", days: 1 },
      { id: "2-day", label: "Two mornings", days: 2, discount: 0.1, note: "10% package rate" },
      { id: "3-day", label: "Three mornings", days: 3, discount: 0.15, note: "15% package rate" },
    ],
    seasons: [{ label: "Duck season", start: "11-15", end: "01-31" }],
    leadTimeDays: 3,
    depositRate: 0.5,
    balanceDueDays: 7,
    includes: [
      "Licensed guide and retrieving dog",
      "Brushed blind, decoy spread and boat",
      "Coffee and a thermos of chicory before the ride out",
      "Cleaning station and cooler space",
    ],
    addOns: [BIRD_CLEANING, PLANTATION_BREAKFAST, SHELLS, LOANER_GUN, LODGING_ADD_ON],
  },
  {
    id: "quail-hunt",
    name: "Guided Quail Hunt",
    category: "hunt",
    tagline: "Pointing dogs, wiregrass and longleaf pine",
    description:
      "Classic South Georgia bobwhite over pointers and setters, hunted from a mule-drawn wagon or a truck, on 900 acres of burned longleaf. Half days run to lunch; full days include a field lunch and a second course after.",
    image:
      "https://images.unsplash.com/photo-1516934024742-b461fba47600?auto=format&fit=crop&w=1200&q=70",
    resource: "quail-course",
    exclusive: false,
    unit: "per_gun",
    baseRate: 450,
    party: { label: "Guns", singular: "gun", min: 2, max: 6 },
    slots: [
      { id: "half-morning", label: "8:00 AM — half day", start: "08:00", hours: 4 },
      { id: "full-day", label: "8:00 AM — full day", start: "08:00", hours: 8 },
      { id: "half-afternoon", label: "1:00 PM — half day", start: "13:00", hours: 4 },
    ],
    durations: [
      { id: "1-day", label: "One day", days: 1 },
      { id: "2-day", label: "Two days", days: 2, discount: 0.1, note: "10% package rate" },
      { id: "3-day", label: "Three days", days: 3, discount: 0.15, note: "15% package rate" },
    ],
    seasons: [{ label: "Quail season", start: "10-01", end: "03-31" }],
    leadTimeDays: 3,
    depositRate: 0.5,
    balanceDueDays: 7,
    includes: [
      "Two guides, a dog handler and a string of pointing dogs",
      "Wagon or truck transport between courses",
      "Bird count guaranteed or the day is re-run",
      "Use of the skinning shed and walk-in cooler",
    ],
    addOns: [
      BIRD_CLEANING,
      {
        id: "field-lunch",
        name: "Field lunch",
        description: "Fried chicken, field peas and cornbread served under the pines.",
        price: 38,
        unit: "per_gun",
        recommended: true,
      },
      LOANER_GUN,
      SHELLS,
      LODGING_ADD_ON,
    ],
  },
  {
    id: "dove-shoot",
    name: "Managed Dove Field",
    category: "hunt",
    tagline: "Sunflowers, browntop millet and a full field of shooters",
    description:
      "Forty acres planted and mowed for opening weekend and the late season. Numbered stands drawn at the tailgate, a wagon of ice and drinks in the middle, and a dove supper in the pavilion after.",
    image:
      "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=70",
    resource: "dove-field",
    exclusive: false,
    unit: "per_gun",
    baseRate: 175,
    party: { label: "Guns", singular: "gun", min: 4, max: 24 },
    slots: [{ id: "afternoon", label: "2:00 PM — afternoon shoot", start: "14:00", hours: 4 }],
    durations: [
      { id: "1-day", label: "One afternoon", days: 1 },
      { id: "2-day", label: "Two afternoons", days: 2, discount: 0.1, note: "10% package rate" },
    ],
    seasons: [
      { label: "Early season", start: "09-01", end: "10-15" },
      { label: "Late season", start: "12-15", end: "01-31" },
    ],
    leadTimeDays: 2,
    depositRate: 0.5,
    balanceDueDays: 7,
    includes: [
      "Planted and mowed field with numbered stands",
      "Ice, water and soft drinks on the wagon",
      "Field marshal and bird retrieval",
      "Cleaning station",
    ],
    addOns: [
      BIRD_CLEANING,
      SHELLS,
      {
        id: "dove-supper",
        name: "Dove supper in the pavilion",
        description: "Bacon-wrapped poppers, low-country boil and pound cake after the shoot.",
        price: 42,
        unit: "per_gun",
        recommended: true,
      },
    ],
  },
  {
    id: "sporting-clays",
    name: "Sporting Clays & Range Day",
    category: "hunt",
    tagline: "Fifteen stations through the hardwood bottom",
    description:
      "A walking course with fifteen stations, plus five-stand and a patterning board. Good for a groomsmen outing, a corporate afternoon, or knocking the rust off before opening day.",
    image:
      "https://images.unsplash.com/photo-1495563923587-bdcfe0f0d5e6?auto=format&fit=crop&w=1200&q=70",
    resource: "clays-course",
    exclusive: false,
    unit: "per_gun",
    baseRate: 85,
    party: { label: "Shooters", singular: "shooter", min: 2, max: 20 },
    slots: [
      { id: "morning", label: "9:00 AM", start: "09:00", hours: 3 },
      { id: "afternoon", label: "1:00 PM", start: "13:00", hours: 3 },
      { id: "evening", label: "4:00 PM", start: "16:00", hours: 3 },
    ],
    durations: [{ id: "single", label: "One round (100 targets)", days: 1 }],
    leadTimeDays: 1,
    depositRate: 0.25,
    balanceDueDays: 3,
    includes: [
      "100 targets per shooter",
      "Cart and course guide",
      "Eye and ear protection",
      "Five-stand and patterning board",
    ],
    addOns: [
      LOANER_GUN,
      SHELLS,
      {
        id: "clays-instruction",
        name: "Instructor for the round",
        description: "An NSCA-certified instructor walks the course with your group.",
        price: 225,
        unit: "flat",
      },
    ],
  },
  {
    id: "wedding",
    name: "Wedding Weekend",
    category: "event",
    tagline: "The whole plantation, yours from Friday to Sunday",
    description:
      "Ceremony under the live oaks, cocktails on the covered porch, dinner and dancing in the 3,000 sq ft pavilion. The rate closes the property — no hunts, no tours, nobody else on the place while you're here.",
    image:
      "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=70",
    resource: "property",
    exclusive: true,
    unit: "flat",
    baseRate: 6_800,
    facilityFee: 650,
    party: {
      label: "Guests",
      singular: "guest",
      min: 25,
      max: 300,
      included: 150,
      overagePrice: 14,
    },
    slots: [{ id: "all-day", label: "Full property, 10:00 AM to midnight", start: "10:00", hours: 14 }],
    durations: [
      { id: "1-day", label: "Wedding day only", days: 1 },
      {
        id: "2-day",
        label: "Rehearsal + wedding day",
        days: 2,
        discount: 0.2,
        note: "Second day at 60% of the day rate",
      },
      {
        id: "3-day",
        label: "Full weekend with day-after brunch",
        days: 3,
        discount: 0.25,
        note: "Best value for out-of-town guests",
      },
    ],
    daysOfWeek: [4, 5, 6, 0],
    peakMonths: [4, 5, 10, 11],
    peakSurcharge: 900,
    saturdaySurcharge: 750,
    leadTimeDays: 30,
    depositRate: 0.25,
    balanceDueDays: 30,
    includes: [
      "3,000 sq ft pavilion with chandeliers, heat and air",
      "Ceremony lawn, arbor and 250 white folding chairs",
      "Farm tables, china and glassware for 150",
      "Bridal suite and grooms' cabin from 10:00 AM",
      "Day-of coordinator and on-site maintenance",
      "Parking attendant and shuttle from the front gate",
    ],
    addOns: [
      {
        id: "catering",
        name: "Plated dinner service",
        description: "Our kitchen: choice of two entrées, three sides, bread and dessert.",
        price: 68,
        unit: "per_guest",
        recommended: true,
      },
      {
        id: "bar",
        name: "Bar service",
        description: "Licensed bartenders, beer, wine and two signature cocktails for four hours.",
        price: 28,
        unit: "per_guest",
      },
      {
        id: "lodge-block",
        name: "Lodge for the wedding party",
        description: "All 16 bunks, both nights, with breakfast.",
        price: 950,
        unit: "per_night",
        recommended: true,
      },
      {
        id: "string-lights",
        name: "Bistro lighting over the lawn",
        description: "Warm bistro strands across the ceremony lawn and porch.",
        price: 450,
        unit: "flat",
      },
      {
        id: "brunch",
        name: "Day-after brunch",
        description: "Biscuit bar and coffee in the pavilion the morning after.",
        price: 26,
        unit: "per_guest",
      },
      {
        id: "groomsmen-clays",
        name: "Groomsmen clays outing",
        description: "A round on the clays course Friday afternoon, up to 12 shooters.",
        price: 850,
        unit: "flat",
      },
    ],
  },
  {
    id: "rehearsal-dinner",
    name: "Rehearsal Dinner",
    category: "event",
    tagline: "The pavilion and porch for the evening",
    description:
      "A five-hour evening in the pavilion for the wedding party and out-of-town family, with the porch and fire pit open. Books on its own, or folds into a wedding weekend at a reduced rate.",
    image:
      "https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&w=1200&q=70",
    resource: "pavilion",
    exclusive: false,
    unit: "flat",
    baseRate: 1_450,
    facilityFee: 250,
    party: { label: "Guests", singular: "guest", min: 15, max: 120, included: 60, overagePrice: 12 },
    slots: [{ id: "evening", label: "6:00 PM to 11:00 PM", start: "18:00", hours: 5 }],
    durations: [{ id: "1-day", label: "One evening", days: 1 }],
    leadTimeDays: 14,
    depositRate: 0.25,
    balanceDueDays: 14,
    includes: [
      "Pavilion, covered porch and fire pit",
      "Farm tables and seating for 120",
      "Sound system and uplighting",
      "Setup, breakdown and cleaning",
    ],
    addOns: [
      {
        id: "low-country-boil",
        name: "Low-country boil",
        description: "Shrimp, sausage, corn and potatoes, served family style.",
        price: 44,
        unit: "per_guest",
        recommended: true,
      },
      {
        id: "bar",
        name: "Beer & wine bar",
        description: "Licensed bartender, regional beer and wine for three hours.",
        price: 22,
        unit: "per_guest",
      },
      {
        id: "smores",
        name: "Fire pit s'mores bar",
        description: "Wood, skewers and everything that goes with them.",
        price: 175,
        unit: "flat",
      },
    ],
  },
  {
    id: "corporate-retreat",
    name: "Corporate Retreat",
    category: "event",
    tagline: "Meeting room by day, clays and a fish fry by evening",
    description:
      "The pavilion set as a meeting space with AV, the lodge for overnight, and the property for whatever you want the afternoon to look like. Priced per person, per day, with a ten-person minimum.",
    image:
      "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=70",
    resource: "property",
    exclusive: true,
    unit: "per_person_per_day",
    baseRate: 185,
    facilityFee: 350,
    party: { label: "Attendees", singular: "attendee", min: 10, max: 60 },
    slots: [{ id: "business-day", label: "8:00 AM to 9:00 PM", start: "08:00", hours: 13 }],
    durations: [
      { id: "1-day", label: "One day", days: 1 },
      { id: "2-day", label: "Two days", days: 2, discount: 0.1, note: "10% multi-day rate" },
      { id: "3-day", label: "Three days", days: 3, discount: 0.15, note: "15% multi-day rate" },
    ],
    daysOfWeek: [1, 2, 3, 4, 5],
    leadTimeDays: 14,
    depositRate: 0.25,
    balanceDueDays: 14,
    includes: [
      "Pavilion set for meetings, with projector, screen and Wi-Fi",
      "Breakfast, lunch and afternoon coffee",
      "Breakout space on the porch and in the lodge great room",
      "Exclusive use of the property for your dates",
    ],
    addOns: [
      {
        id: "clays-tournament",
        name: "Clays tournament",
        description: "Flighted teams on the clays course, targets and scoring included.",
        price: 95,
        unit: "per_person_per_day",
        recommended: true,
      },
      {
        id: "fish-fry",
        name: "Low-country fish fry",
        description: "Catfish, hush puppies and cheese grits in the pavilion.",
        price: 46,
        unit: "per_person_per_day",
      },
      {
        id: "lodge-block",
        name: "Lodge overnight block",
        description: "All 16 bunks with breakfast, per night.",
        price: 950,
        unit: "per_night",
      },
    ],
  },
  {
    id: "family-gathering",
    name: "Family Reunion & Private Party",
    category: "event",
    tagline: "A whole day on the place, kids and dogs welcome",
    description:
      "Reunions, milestone birthdays, anniversary suppers, church picnics and graduation parties. The pavilion, the lawn, the pond and the pasture for a full day, with pricing that doesn't punish a big family.",
    image:
      "https://images.unsplash.com/photo-1529543544282-ea669407fca3?auto=format&fit=crop&w=1200&q=70",
    resource: "pavilion",
    exclusive: false,
    unit: "flat",
    baseRate: 2_400,
    facilityFee: 250,
    party: { label: "Guests", singular: "guest", min: 20, max: 250, included: 100, overagePrice: 18 },
    slots: [{ id: "day", label: "11:00 AM to 9:00 PM", start: "11:00", hours: 10 }],
    durations: [
      { id: "1-day", label: "One day", days: 1 },
      { id: "2-day", label: "Two days", days: 2, discount: 0.15, note: "15% multi-day rate" },
    ],
    leadTimeDays: 7,
    depositRate: 0.25,
    balanceDueDays: 14,
    includes: [
      "Pavilion, porch, lawn and pond dock",
      "Tables and seating for 150",
      "Catch-and-release fishing and hay ride",
      "Setup, breakdown and cleaning",
    ],
    addOns: [
      {
        id: "bbq",
        name: "Whole-hog barbecue",
        description: "Pulled pork, Brunswick stew, slaw and all the fixings.",
        price: 32,
        unit: "per_guest",
        recommended: true,
      },
      {
        id: "hay-ride",
        name: "Extended hay ride & bonfire",
        description: "A tractor-drawn loop of the property, ending at the bonfire.",
        price: 350,
        unit: "flat",
      },
      {
        id: "lodge-block",
        name: "Lodge overnight block",
        description: "All 16 bunks with breakfast, per night.",
        price: 950,
        unit: "per_night",
      },
    ],
  },
  {
    id: "lodge-stay",
    name: "Lodge Overnight Stay",
    category: "stay",
    tagline: "Sixteen bunks, a long porch and no cell service to speak of",
    description:
      "The lodge on its own, without a hunt or an event: heart-pine floors, a stone fireplace, a full kitchen and rocking chairs facing the pond. Rate covers eight guests; more are welcome for a per-head charge.",
    image:
      "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1200&q=70",
    resource: "lodge",
    exclusive: false,
    unit: "per_night",
    baseRate: 950,
    party: { label: "Guests", singular: "guest", min: 2, max: 16, included: 8, overagePrice: 85 },
    slots: [{ id: "check-in", label: "4:00 PM check-in", start: "16:00", hours: 18 }],
    durations: [
      { id: "1-night", label: "One night", days: 1 },
      { id: "2-night", label: "Two nights", days: 2 },
      { id: "3-night", label: "Three nights", days: 3, discount: 0.1, note: "10% off three or more" },
      { id: "5-night", label: "Five nights", days: 5, discount: 0.15, note: "15% off the week" },
    ],
    leadTimeDays: 2,
    depositRate: 0.5,
    balanceDueDays: 7,
    includes: [
      "Sixteen bunks in four rooms, linens provided",
      "Full kitchen, stone fireplace and screened porch",
      "Fire pit, grill and catch-and-release fishing",
      "Coffee, breakfast basket and firewood",
    ],
    addOns: [
      {
        id: "stocked-kitchen",
        name: "Stocked kitchen",
        description: "Groceries for the stay: breakfast, sandwiches and one supper.",
        price: 55,
        unit: "per_guest",
      },
      {
        id: "clays-round",
        name: "Round on the clays course",
        description: "100 targets per guest with a course guide.",
        price: 85,
        unit: "per_guest",
      },
    ],
  },
];

export const EXPERIENCES_BY_ID: Record<string, Experience> = Object.fromEntries(
  EXPERIENCES.map((experience) => [experience.id, experience])
);

export function getExperience(id: string): Experience | undefined {
  return EXPERIENCES_BY_ID[id];
}

export const CATEGORY_LABELS: Record<Category, string> = {
  tour: "See the place",
  hunt: "Hunting & shooting",
  event: "Weddings & events",
  stay: "Stay over",
};

/**
 * Whether a `YYYY-MM-DD` date falls inside a season window.
 *
 * Duck season runs 11-15 to 01-31, so a window whose end sorts before its
 * start wraps the new year and has to be matched as a union of two ranges.
 */
export function isInSeason(date: string, seasons?: Season[]): boolean {
  if (!seasons || seasons.length === 0) return true;
  const monthDay = date.slice(5);
  return seasons.some(({ start, end }) =>
    start <= end
      ? monthDay >= start && monthDay <= end
      : monthDay >= start || monthDay <= end
  );
}

/** The season window a date falls in, for labelling the calendar. */
export function seasonLabel(date: string, seasons?: Season[]): string | null {
  if (!seasons) return null;
  const monthDay = date.slice(5);
  const hit = seasons.find(({ start, end }) =>
    start <= end
      ? monthDay >= start && monthDay <= end
      : monthDay >= start || monthDay <= end
  );
  return hit?.label ?? null;
}

/** Human-readable season range, e.g. `Nov 15 – Jan 31`. */
export function seasonRangeText(seasons?: Season[]): string {
  if (!seasons || seasons.length === 0) return "Year round";
  const month = (md: string) =>
    new Date(Date.UTC(2001, Number(md.slice(0, 2)) - 1, Number(md.slice(3, 5))));
  const fmt = (md: string) =>
    new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" }).format(
      month(md)
    );
  return seasons.map((s) => `${fmt(s.start)} – ${fmt(s.end)}`).join(", ");
}

/** The lowest published price, for the "from $X" line on a card. */
export function startingPrice(experience: Experience): { amount: number; suffix: string } {
  const suffix: Record<RateUnit, string> = {
    flat: "per day",
    per_gun: `per ${experience.party.singular}`,
    per_guest: "per guest",
    per_person_per_day: "per person, per day",
    per_night: "per night",
  };
  return { amount: experience.baseRate, suffix: suffix[experience.unit] };
}
