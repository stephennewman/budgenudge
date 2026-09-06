import Link from "next/link";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { getExperience, VENUE } from "@/utils/red-fern/catalog";
import { bookingsOnDate, occupancyOf, type Booking } from "@/utils/red-fern/availability";
import { balanceDueDate } from "@/utils/red-fern/ics";
import {
  addDays,
  addMonths,
  dateRange,
  formatDateFull,
  formatDateSpan,
  formatMonthLabel,
  formatMoney,
  formatTime,
  startOfMonth,
  todayAtVenue,
  weekdayOf,
} from "@/utils/red-fern/dates";
import { loadBookings } from "@/utils/red-fern/server/store";
import { isDemoCode, scheduleCode } from "@/utils/red-fern/server/access";

/**
 * The private side: the family's own book.
 *
 * Same data as the public calendar, with everything the public calendar
 * deliberately leaves out — who booked it, how to reach them, what they owe and
 * when it's due. Gated on a shared code, which is also what signs the iCalendar
 * feed, because a calendar client can only carry a secret in a query string.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Schedule — Red Fern Plantation",
  robots: { index: false, follow: false },
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_TONE: Record<string, string> = {
  confirmed: "bg-[#e6f0e6] text-[#2f6b46] ring-[#bcd8c3]",
  requested: "bg-[#fdf6e3] text-[#8a6d1f] ring-[#e6cf92]",
  hold: "bg-[#eef1f6] text-[#4a5a75] ring-[#c9d3e3]",
  cancelled: "bg-[#fdecea] text-[#8c2f22] ring-[#f0c3bc]",
};

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; month?: string }>;
}) {
  const params = await searchParams;
  const expected = scheduleCode();

  if ((params.code ?? "") !== expected) {
    return <Gate wrong={Boolean(params.code)} />;
  }

  const today = todayAtVenue();
  const month = /^\d{4}-\d{2}$/.test(params.month ?? "")
    ? `${params.month}-01`
    : startOfMonth(today);

  // Multi-day bookings can start before the window they're shown in.
  const { bookings, backend } = await loadBookings({ from: addDays(month, -21) });
  const live = bookings.filter((booking) => booking.status !== "cancelled");

  const monthEnd = addDays(addMonths(month, 1), -1);
  const monthDays = dateRange(month, Number(monthEnd.slice(8, 10)));
  const inMonth = live.filter((booking) => {
    const occupancy = occupancyOf(booking);
    return occupancy?.dates.some((date) => date >= month && date <= monthEnd) ?? false;
  });

  const booked = inMonth.reduce((sum, booking) => sum + booking.total, 0);
  const outstanding = inMonth
    .filter((booking) => booking.status === "requested")
    .reduce((sum, booking) => sum + booking.deposit_due, 0);
  const daysHeld = new Set(
    inMonth.flatMap((booking) => occupancyOf(booking)?.dates ?? []).filter((date) => date >= month && date <= monthEnd)
  ).size;

  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const feedUrl = `${protocol}://${host}/api/red-fern/calendar.ics?key=${encodeURIComponent(expected)}`;

  const monthHref = (target: string) =>
    `/red-fern/schedule?code=${encodeURIComponent(expected)}&month=${target.slice(0, 7)}`;

  return (
    <main className="min-h-screen bg-[#f7f3ea] px-4 py-8 text-[#16281f] sm:px-6 sm:py-12">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#c9a227]">
              Private · {VENUE.name}
            </p>
            <h1 className="mt-2 font-serif text-3xl sm:text-4xl">The book</h1>
            <p className="mt-2 text-sm text-[#5b5546]">
              Every tour, hunt, wedding and stay on the calendar, with the details guests never see.
            </p>
          </div>
          <Link
            href="/red-fern"
            className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold text-[#16281f] ring-1 ring-[#e2d9c6] transition hover:bg-white"
          >
            ← Public page
          </Link>
        </header>

        <section className="grid gap-3 sm:grid-cols-3">
          {[
            { value: formatMoney(booked), label: "Booked this month" },
            { value: formatMoney(outstanding), label: "Deposits not yet collected" },
            { value: `${daysHeld} of ${monthDays.length}`, label: "Days with something on them" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl bg-white p-4 ring-1 ring-[#e2d9c6]">
              <p className="font-serif text-2xl tabular-nums">{stat.value}</p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-[#8a7f6c]">
                {stat.label}
              </p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#e2d9c6] sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <Link
              href={monthHref(addMonths(month, -1))}
              className="flex h-11 w-11 items-center justify-center rounded-full ring-1 ring-[#e2d9c6] transition hover:bg-[#f1ecdf]"
              aria-label="Previous month"
            >
              ‹
            </Link>
            <h2 className="font-serif text-2xl">{formatMonthLabel(month.slice(0, 7))}</h2>
            <Link
              href={monthHref(addMonths(month, 1))}
              className="flex h-11 w-11 items-center justify-center rounded-full ring-1 ring-[#e2d9c6] transition hover:bg-[#f1ecdf]"
              aria-label="Next month"
            >
              ›
            </Link>
          </div>

          {/* The grid is the at-a-glance view; below 640px the list underneath
              is the readable one, so the grid steps aside. */}
          <div className="mt-5 hidden grid-cols-7 gap-1 sm:grid">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="pb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-[#a89e8a]"
              >
                {day}
              </div>
            ))}
            {Array.from({ length: weekdayOf(month) }).map((_, index) => (
              <div key={`pad-${index}`} />
            ))}
            {monthDays.map((date) => {
              const onThisDay = bookingsOnDate(live, date);
              const isToday = date === today;
              return (
                <div
                  key={date}
                  className={`flex min-h-24 flex-col gap-1 rounded-lg p-1.5 ring-1 ${
                    isToday ? "bg-[#f3f6f2] ring-[#16281f]" : "bg-[#faf7f0] ring-[#eee7d8]"
                  }`}
                >
                  <span
                    className={`text-[11px] ${isToday ? "font-bold text-[#16281f]" : "text-[#a89e8a]"}`}
                  >
                    {Number(date.slice(8, 10))}
                  </span>
                  {onThisDay.map((booking) => {
                    const experience = getExperience(booking.experience_id);
                    if (!experience) return null;
                    return (
                      <span
                        key={booking.reference}
                        title={`${experience.name} — ${booking.guest_name}`}
                        className={`truncate rounded px-1 py-0.5 text-[10px] leading-tight ${
                          experience.exclusive
                            ? "bg-[#8c2f22] text-white"
                            : experience.category === "hunt"
                              ? "bg-[#c9a227] text-[#16281f]"
                              : "bg-[#dce6dc] text-[#16281f]"
                        }`}
                      >
                        {booking.guest_name.split(" ").slice(-1)[0]} · {experience.name.split(" ")[0]}
                      </span>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8a7f6c]">
            {formatMonthLabel(month.slice(0, 7))} — {inMonth.length} on the book
          </h2>
          {inMonth
            .slice()
            .sort((a, b) => a.start_date.localeCompare(b.start_date))
            .map((booking) => (
              <BookingRow key={booking.reference} booking={booking} />
            ))}
          {inMonth.length === 0 && (
            <p className="rounded-2xl bg-white p-6 text-sm text-[#5b5546] ring-1 ring-[#e2d9c6]">
              Nothing booked this month.
            </p>
          )}
        </section>

        <section className="rounded-2xl bg-[#16281f] p-5 text-[#f7f3ea] sm:p-6">
          <h2 className="font-serif text-xl">Put this on your phone</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#cdd6cd]">
            Subscribe once and every booking — including anything taken through the website — shows
            up on your own calendar, names and phone numbers included.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <a
              href={feedUrl.replace(/^https?:/, "webcal:")}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-[#c9a227] px-4 text-sm font-semibold text-[#16281f] transition hover:brightness-110"
            >
              Apple Calendar / Outlook
            </a>
            <a
              href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(
                feedUrl.replace(/^https?:/, "webcal:")
              )}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl px-4 text-sm font-semibold text-[#f7f3ea] ring-1 ring-[#3c5245] transition hover:bg-[#1f3b2c]"
            >
              Google Calendar
            </a>
          </div>
          <p className="mt-3 break-all text-[11px] text-[#8fa294]">{feedUrl}</p>
        </section>

        <p className="text-center text-[11px] text-[#a89e8a]">
          {backend === "supabase"
            ? "Reading from Supabase."
            : "Demo schedule held in memory — bookings taken here last until the server restarts."}
        </p>
      </div>
    </main>
  );
}

function BookingRow({ booking }: { booking: Booking }) {
  const experience = getExperience(booking.experience_id);
  if (!experience) return null;

  const balance = booking.total - booking.deposit_due;
  const due = balanceDueDate(booking, experience);
  const addOns = booking.add_on_ids
    .map((id) => experience.addOns.find((addOn) => addOn.id === id)?.name)
    .filter(Boolean);

  return (
    <article className="rounded-2xl bg-white p-4 ring-1 ring-[#e2d9c6] sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-serif text-lg text-[#16281f]">{experience.name}</h3>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ring-1 ${
                STATUS_TONE[booking.status] ?? STATUS_TONE.hold
              }`}
            >
              {booking.status}
            </span>
            {experience.exclusive && (
              <span className="rounded-full bg-[#fdecea] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#8c2f22] ring-1 ring-[#f0c3bc]">
                Property closed
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-[#5b5546]">
            {formatDateSpan(booking.start_date, booking.days)} ·{" "}
            {booking.days > 1 || booking.hours >= 10 ? "all day" : formatTime(booking.start_time)} ·{" "}
            {booking.party_size} {experience.party.label.toLowerCase()}
          </p>
        </div>
        <div className="text-right">
          <p className="font-serif text-xl tabular-nums text-[#16281f]">
            {booking.total > 0 ? formatMoney(booking.total) : "No charge"}
          </p>
          {booking.deposit_due > 0 && (
            <p className="text-[11px] text-[#8a7f6c]">
              {formatMoney(booking.deposit_due)} deposit
              {balance > 0 && due ? ` · ${formatMoney(balance)} due ${formatDateFull(due)}` : ""}
            </p>
          )}
        </div>
      </div>

      <dl className="mt-3 grid gap-x-6 gap-y-1 border-t border-[#f1ecdf] pt-3 text-sm sm:grid-cols-2">
        <div className="flex gap-2">
          <dt className="text-[#8a7f6c]">Guest</dt>
          <dd className="min-w-0 truncate font-medium">{booking.guest_name}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-[#8a7f6c]">Ref</dt>
          <dd className="font-mono text-xs">{booking.reference}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-[#8a7f6c]">Email</dt>
          <dd className="min-w-0 truncate">
            <a className="underline underline-offset-2" href={`mailto:${booking.guest_email}`}>
              {booking.guest_email}
            </a>
          </dd>
        </div>
        {booking.guest_phone && (
          <div className="flex gap-2">
            <dt className="text-[#8a7f6c]">Phone</dt>
            <dd>
              <a className="underline underline-offset-2" href={`tel:${booking.guest_phone}`}>
                {booking.guest_phone}
              </a>
            </dd>
          </div>
        )}
        {addOns.length > 0 && (
          <div className="flex gap-2 sm:col-span-2">
            <dt className="text-[#8a7f6c]">Added</dt>
            <dd className="min-w-0">{addOns.join(", ")}</dd>
          </div>
        )}
        {booking.notes && (
          <div className="flex gap-2 sm:col-span-2">
            <dt className="shrink-0 text-[#8a7f6c]">Note</dt>
            <dd className="min-w-0 text-[#5b5546]">{booking.notes}</dd>
          </div>
        )}
      </dl>
    </article>
  );
}

function Gate({ wrong }: { wrong: boolean }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#16281f] px-4 py-16 text-[#f7f3ea]">
      <form
        method="get"
        className="w-full max-w-sm rounded-2xl bg-[#1f3b2c] p-6 ring-1 ring-[#3c5245]"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#c9a227]">
          {VENUE.name}
        </p>
        <h1 className="mt-2 font-serif text-2xl">The book</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#cdd6cd]">
          Guest names, phone numbers and balances live behind this. Enter the house code.
        </p>
        <input
          name="code"
          type="password"
          autoFocus
          placeholder="House code"
          className="mt-5 h-11 w-full rounded-xl bg-[#16281f] px-4 text-sm text-[#f7f3ea] ring-1 ring-[#3c5245] focus:outline-none focus:ring-2 focus:ring-[#c9a227]"
        />
        {wrong && <p className="mt-2 text-xs text-[#e8a99f]">That&apos;s not it. Try again.</p>}
        <button
          type="submit"
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#c9a227] px-4 text-sm font-semibold text-[#16281f] transition hover:brightness-110"
        >
          Open the book
        </button>
        {isDemoCode() && (
          <p className="mt-4 rounded-xl bg-[#16281f] px-3 py-2.5 text-[11px] leading-relaxed text-[#8fa294]">
            Demo: the code is <span className="font-mono text-[#c9a227]">redfern</span>. Set
            RED_FERN_SCHEDULE_CODE to change it.
          </p>
        )}
        <Link
          href="/red-fern"
          className="mt-4 block text-center text-xs text-[#8fa294] underline underline-offset-4"
        >
          Back to the public page
        </Link>
      </form>
    </main>
  );
}
