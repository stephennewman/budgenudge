import Link from "next/link";
import type { Metadata } from "next";
import BookingFlow from "./booking-flow";
import RedFernLogo from "./logo";
import {
  EXPERIENCES,
  VENUE,
  getExperience,
  seasonRangeText,
} from "@/utils/red-fern/catalog";
import { loadBookings } from "@/utils/red-fern/server/store";
import {
  addDays,
  formatDateSpan,
  formatMoney,
  formatTime,
  todayAtVenue,
} from "@/utils/red-fern/dates";

/**
 * The public face of Red Fern Plantation.
 *
 * Everything a guest needs in one page: what the place is, what it costs, what
 * dates are still open, and a booking flow that ends with an invitation on
 * their calendar. The schedule strip near the bottom is deliberately anonymous
 * — a guest can see that a Saturday is spoken for without seeing whose wedding
 * it is.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Red Fern Plantation — Weddings, Hunts & Events in Valdosta, Georgia",
  description:
    "1,800 acres in South Georgia: weddings under the live oaks, guided duck and quail hunts, corporate retreats, and a lodge that sleeps sixteen. Check open dates and book online.",
};

const GALLERY = [
  {
    src: "https://images.unsplash.com/photo-1523438885200-e635ba2c371e?auto=format&fit=crop&w=900&q=70",
    caption: "The pavilion, set for 180",
  },
  {
    src: "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=900&q=70",
    caption: "The lodge — sixteen bunks and a long porch",
  },
  {
    src: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=900&q=70",
    caption: "First light over the impoundments",
  },
  {
    src: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=900&q=70",
    caption: "Burned longleaf and wiregrass",
  },
];

const FAQS = [
  {
    question: "Can we bring our own caterer and bar?",
    answer:
      "Yes. Our kitchen is available and most folks use it, but any licensed caterer is welcome. Bar service has to be run by a licensed, insured bartender — ours or yours.",
  },
  {
    question: "What happens if it rains?",
    answer:
      "The pavilion is 3,000 square feet, heated and cooled, and seats 250 with room for a dance floor. Every ceremony has a covered plan B that doesn't cost extra.",
  },
  {
    question: "Do we need a hunting license?",
    answer:
      "A Georgia hunting license and, for waterfowl, a federal duck stamp and HIP certification. We sell shells and can loan you a gun; we can't sell you a license, but we'll point you at the right page.",
  },
  {
    question: "How far out should we book?",
    answer:
      "Saturdays in April, May, October and November go 12 to 18 months ahead. Hunts fill inside the season, usually two to six weeks out. Tours can be as soon as tomorrow.",
  },
  {
    question: "Where do guests stay?",
    answer:
      "The lodge sleeps sixteen and is the best seat in the house. There are another 300 hotel rooms within fifteen minutes off Exit 16 in Valdosta.",
  },
];

export default async function RedFernPage() {
  const today = todayAtVenue();
  const { bookings } = await loadBookings({ from: today });

  const upcoming = bookings
    .filter((booking) => booking.status !== "cancelled")
    .filter((booking) => booking.start_date <= addDays(today, 120))
    .slice(0, 8);

  return (
    <main className="min-h-screen bg-[#f4f2ef] text-[#3c4143]">
      <section className="relative isolate overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=2000&q=75"
          alt="Live oaks over the ceremony lawn at dusk"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#22262a]/80 via-[#22262a]/60 to-[#22262a]/90" />
        <div className="relative mx-auto flex min-h-[600px] max-w-6xl flex-col items-center justify-center px-4 py-20 text-center sm:px-6 sm:py-28">
          <RedFernLogo tone="light" size="lg" />
          <h1 className="sr-only">
            Red Fern Plantation — weddings, hunts and events in Valdosta, Georgia
          </h1>
          <p className="mt-7 text-[11px] font-semibold uppercase tracking-[0.3em] text-[#cf8577]">
            {VENUE.city}, {VENUE.state} · {VENUE.acreage.toLocaleString()} acres
          </p>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-[#e2e0dc] sm:text-lg">
            Weddings under the live oaks. Ducks at first light. A 3,000 square-foot pavilion, a
            lodge that sleeps sixteen, and 1,800 acres of South Georgia between them.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href="#plan"
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#8e2b1e] px-7 text-sm font-semibold text-[#f4f2ef] transition hover:brightness-110"
            >
              Check open dates
            </a>
            <a
              href="#plan"
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white/10 px-7 text-sm font-semibold text-[#f4f2ef] ring-1 ring-white/30 backdrop-blur transition hover:bg-white/20"
            >
              Request a tour — no charge
            </a>
          </div>
        </div>
      </section>

      <section className="border-y border-[#ddd9d3] bg-[#fbfaf8]">
        <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-y-6 px-4 py-8 sm:px-6 lg:grid-cols-4">
          {[
            { value: "3,000 sq ft", label: "Heated & cooled pavilion" },
            { value: "Sleeps 16", label: "Lodge on the pond" },
            { value: "1,800 acres", label: "Impoundments, longleaf & clays" },
            { value: "250 guests", label: "Seated, with a dance floor" },
          ].map((stat) => (
            <div key={stat.label} className="px-2">
              <dt className="rf-display text-2xl text-[#3c4143]">{stat.value}</dt>
              <dd className="mt-1 text-xs uppercase tracking-[0.14em] text-[#7e8385]">
                {stat.label}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="py-14 sm:py-20">
        <BookingFlow today={today} />
      </section>

      <section className="bg-[#3c4143] py-16 text-[#f4f2ef] sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#cf8577]">
              The place
            </p>
            <h2 className="mt-3 rf-display text-3xl leading-tight sm:text-4xl">
              Four generations of the same family, twenty minutes off I-75
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-[#d6d3ce] sm:text-base">
              Red Fern started as a quail place and grew into somewhere people get married, close
              deals, bury the hatchet at a reunion, and take their kids on a first duck hunt. Same
              dirt, same family, and one calendar that keeps it all from running into itself.
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {GALLERY.map((photo) => (
              <figure key={photo.src} className="overflow-hidden rounded-2xl bg-[#4d5355]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.src}
                  alt={photo.caption}
                  loading="lazy"
                  className="h-48 w-full object-cover"
                />
                <figcaption className="px-4 py-3 text-xs text-[#a8adaf]">{photo.caption}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8e2b1e]">
            What it runs
          </p>
          <h2 className="mt-3 rf-display text-3xl leading-tight sm:text-4xl">
            Published rates, multi-day discounts and all
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#5a6062]">
            No quote forms and no runaround. Saturdays and peak-season dates carry a premium, and
            everything below is before Georgia sales tax.
          </p>

          <div className="mt-8 overflow-hidden rounded-2xl bg-white ring-1 ring-[#ddd9d3]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[#ddd9d3] text-[11px] uppercase tracking-[0.14em] text-[#7e8385]">
                    <th className="px-4 py-3 font-semibold">Offering</th>
                    <th className="px-4 py-3 font-semibold">Base rate</th>
                    <th className="px-4 py-3 font-semibold">Longer stay</th>
                    <th className="px-4 py-3 font-semibold">Season</th>
                  </tr>
                </thead>
                <tbody>
                  {EXPERIENCES.map((experience) => {
                    const multi = experience.durations.filter((d) => d.days > 1);
                    const best = multi[multi.length - 1];
                    return (
                      <tr key={experience.id} className="border-b border-[#eceae6] last:border-0">
                        <th scope="row" className="px-4 py-4 font-semibold text-[#3c4143]">
                          {experience.name}
                          <span className="mt-0.5 block text-xs font-normal text-[#7e8385]">
                            {experience.party.min}–{experience.party.max}{" "}
                            {experience.party.label.toLowerCase()}
                          </span>
                        </th>
                        <td className="px-4 py-4 text-[#5a6062]">
                          {experience.baseRate === 0 ? (
                            <span className="font-semibold text-[#3f6b52]">No charge</span>
                          ) : (
                            <>
                              <span className="font-semibold text-[#3c4143]">
                                {formatMoney(experience.baseRate)}
                              </span>
                              <span className="block text-xs text-[#7e8385]">
                                {experience.unit === "flat"
                                  ? "per day"
                                  : experience.unit === "per_night"
                                    ? "per night"
                                    : experience.unit === "per_person_per_day"
                                      ? "per person, per day"
                                      : `per ${experience.party.singular}, per day`}
                              </span>
                            </>
                          )}
                        </td>
                        <td className="px-4 py-4 text-[#5a6062]">
                          {best ? (
                            <>
                              <span className="font-semibold text-[#3c4143]">{best.label}</span>
                              <span className="block text-xs text-[#7e8385]">
                                {best.note ?? `${best.days} days`}
                              </span>
                            </>
                          ) : (
                            <span className="text-xs text-[#9ea3a5]">Single session</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-xs text-[#5a6062]">
                          {seasonRangeText(experience.seasons)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <p className="mt-3 text-xs text-[#7e8385]">
            Wedding Saturdays add {formatMoney(getExperience("wedding")?.saturdaySurcharge ?? 0)};
            April, May, October and November add{" "}
            {formatMoney(getExperience("wedding")?.peakSurcharge ?? 0)}. Deposits hold the date and
            are credited to the balance.
          </p>
        </div>
      </section>

      <section className="bg-[#fbfaf8] py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8e2b1e]">
                On the book
              </p>
              <h2 className="mt-3 rf-display text-3xl leading-tight sm:text-4xl">
                What&apos;s already spoken for
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#5a6062]">
                These dates are taken. Whose wedding it is and what they paid stays between us and
                them — you just see the calendar close up.
              </p>
            </div>
            <Link
              href="/red-fern/schedule"
              className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold text-[#3c4143] ring-1 ring-[#ddd9d3] transition hover:bg-[#eceae6]"
            >
              Owners&apos; schedule →
            </Link>
          </div>

          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {upcoming.map((booking) => {
              const experience = getExperience(booking.experience_id);
              if (!experience) return null;
              return (
                <li
                  key={booking.reference}
                  className="flex items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-[#ddd9d3]"
                >
                  <span
                    className={`h-10 w-1.5 shrink-0 rounded-full ${
                      experience.exclusive ? "bg-[#8e2b1e]" : "bg-[#c07a6c]"
                    }`}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[#3c4143]">{experience.name}</p>
                    <p className="text-xs text-[#7e8385]">
                      {formatDateSpan(booking.start_date, booking.days)} ·{" "}
                      {booking.days > 1 || booking.hours >= 10
                        ? "All day"
                        : formatTime(booking.start_time)}
                      {experience.exclusive && " · property closed"}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
          {upcoming.length === 0 && (
            <p className="mt-8 rounded-2xl bg-white p-6 text-sm text-[#5a6062] ring-1 ring-[#ddd9d3]">
              Nothing on the book in the next few months — the whole calendar is yours.
            </p>
          )}
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_360px]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8e2b1e]">
              Questions we get
            </p>
            <h2 className="mt-3 rf-display text-3xl leading-tight sm:text-4xl">
              Before you call
            </h2>
            <div className="mt-8 flex flex-col divide-y divide-[#ddd9d3] border-y border-[#ddd9d3]">
              {FAQS.map((faq) => (
                <details key={faq.question} className="group py-4">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 font-semibold text-[#3c4143]">
                    {faq.question}
                    <span className="text-[#8e2b1e] transition group-open:rotate-45" aria-hidden>
                      +
                    </span>
                  </summary>
                  <p className="mt-2 text-sm leading-relaxed text-[#5a6062]">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>

          <aside className="rounded-2xl bg-[#3c4143] p-6 text-[#f4f2ef]">
            <h3 className="rf-display text-2xl">Come see it</h3>
            <p className="mt-3 text-sm leading-relaxed text-[#d6d3ce]">
              Nothing on this page beats standing on the lawn at five o&apos;clock in October. Tours
              run Monday through Saturday and take about forty-five minutes.
            </p>
            <a
              href="#plan"
              className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#8e2b1e] px-5 text-sm font-semibold text-[#f4f2ef] transition hover:brightness-110"
            >
              Request a tour
            </a>
            <dl className="mt-6 flex flex-col gap-3 border-t border-[#565c5e] pt-6 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-[0.14em] text-[#8b9294]">Call</dt>
                <dd>{VENUE.phone}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.14em] text-[#8b9294]">Write</dt>
                <dd className="break-all">{VENUE.email}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.14em] text-[#8b9294]">Find</dt>
                <dd>{VENUE.address}</dd>
              </div>
            </dl>
          </aside>
        </div>
      </section>

      <footer className="border-t border-[#ddd9d3] bg-[#fbfaf8] py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 text-xs text-[#7e8385] sm:px-6">
          <RedFernLogo size="sm" />
        </div>
        <div className="mx-auto mt-8 flex max-w-6xl flex-col gap-4 px-4 text-xs text-[#7e8385] sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            © {new Date().getFullYear()} {VENUE.name} · {VENUE.address}
          </p>
          <Link href="/red-fern/schedule" className="underline underline-offset-4 hover:text-[#3c4143]">
            Owners&apos; schedule
          </Link>
        </div>
      </footer>
    </main>
  );
}
