"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CATEGORY_LABELS,
  EXPERIENCES,
  VENUE,
  getExperience,
  seasonRangeText,
  type Category,
  type Experience,
} from "@/utils/red-fern/catalog";
import { buildQuote, clampParty } from "@/utils/red-fern/pricing";
import type { Booking, DayAvailability } from "@/utils/red-fern/availability";
import {
  addDays,
  addMonths,
  formatDateLong,
  formatDateSpan,
  formatMonthLabel,
  formatMoney,
  formatTime,
  startOfMonth,
  weekdayOf,
} from "@/utils/red-fern/dates";

/**
 * The booking flow: pick what you want, size it up, take a date, get an email.
 *
 * Pricing runs in the browser off the same rate card the server prices with,
 * so the estimate moves the instant a guest adds a gun or a night. The server
 * re-prices and re-checks the date on submit — the browser's copy is for
 * responsiveness, never for authority.
 */

type Step = 1 | 2 | 3 | 4 | 5;

const STEP_LABELS: Record<number, string> = {
  1: "What brings you out",
  2: "Your plans",
  3: "Pick a date",
  4: "Your details",
};

const WEEKDAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];

type BookingResponse = {
  booking: Booking;
  delivery: { delivered: boolean; reason?: string };
  email: { to: string; from: string; subject: string; html: string; text: string };
  inviteUrl: string;
  backend: "supabase" | "memory";
};

export default function BookingFlow({ today }: { today: string }) {
  const [step, setStep] = useState<Step>(1);
  const [experienceId, setExperienceId] = useState<string | null>(null);
  const [durationId, setDurationId] = useState<string>("");
  const [slotId, setSlotId] = useState<string>("");
  const [partySize, setPartySize] = useState<number>(2);
  const [addOnIds, setAddOnIds] = useState<string[]>([]);
  const [month, setMonth] = useState<string>(startOfMonth(today));
  const [days, setDays] = useState<DayAvailability[]>([]);
  const [loadingDays, setLoadingDays] = useState(false);
  const [date, setDate] = useState<string | null>(null);
  const [contact, setContact] = useState({ name: "", email: "", phone: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BookingResponse | null>(null);

  const experience = experienceId ? getExperience(experienceId) ?? null : null;

  const quote = useMemo(() => {
    if (!experience) return null;
    return buildQuote(experience, {
      experienceId: experience.id,
      startDate: date ?? today,
      durationId,
      slotId,
      partySize,
      addOnIds,
    });
  }, [experience, date, today, durationId, slotId, partySize, addOnIds]);

  const chooseExperience = useCallback(
    (next: Experience) => {
      setExperienceId(next.id);
      setDurationId(next.durations[0].id);
      setSlotId(next.slots[0].id);
      setPartySize(next.party.included ?? Math.max(next.party.min, 2));
      setAddOnIds(next.addOns.filter((addOn) => addOn.recommended).map((addOn) => addOn.id));
      setDate(null);
      setMonth(startOfMonth(today));
      setError(null);
      setStep(2);
    },
    [today]
  );

  // Availability depends on the offering and on how long they're staying, so
  // it is re-read whenever either changes — three mornings of duck hunting
  // opens far fewer dates than one.
  useEffect(() => {
    if (!experience || step !== 3) return;
    const controller = new AbortController();
    const from = month;
    const to = addDays(addMonths(month, 1), -1);

    setLoadingDays(true);
    fetch(
      `/api/red-fern/availability?experience=${experience.id}&from=${from}&to=${to}&duration=${durationId}`,
      { signal: controller.signal }
    )
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("Availability unavailable"))))
      .then((body: { days: DayAvailability[] }) => setDays(body.days))
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError("Couldn't load the calendar. Try again in a moment.");
      })
      .finally(() => setLoadingDays(false));

    return () => controller.abort();
  }, [experience, step, month, durationId]);

  const selectedDay = days.find((day) => day.date === date) ?? null;
  const openSlots = selectedDay?.slots.filter((slot) => slot.available) ?? [];

  async function submit() {
    if (!experience || !date) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/red-fern/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          experienceId: experience.id,
          startDate: date,
          durationId,
          slotId,
          partySize,
          addOnIds,
          name: contact.name,
          email: contact.email,
          phone: contact.phone,
          notes: contact.notes,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error ?? "Something went wrong. Give us a call and we'll sort it out.");
        return;
      }
      setResult(body as BookingResponse);
      setStep(5);
    } catch {
      setError("Couldn't reach the lodge. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function startOver() {
    setResult(null);
    setExperienceId(null);
    setDate(null);
    setContact({ name: "", email: "", phone: "", notes: "" });
    setError(null);
    setStep(1);
  }

  return (
    <div id="plan" className="scroll-mt-4">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-8 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#c9a227]">
            Book the place
          </p>
          <h2 className="mt-3 font-serif text-3xl leading-tight text-[#16281f] sm:text-4xl">
            {step === 5 ? "You're on the book" : "What brings you out to Red Fern?"}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-[#5b5546]">
            Pick what you have in mind and we&apos;ll show you the open dates, what it runs, and put
            the invitation straight on your calendar.
          </p>
        </div>

        {step < 5 && <Stepper step={step} onBack={(target) => setStep(target)} />}

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div className="min-w-0">
            {step === 1 && <ExperiencePicker onChoose={chooseExperience} />}

            {step === 2 && experience && (
              <PlanStep
                experience={experience}
                durationId={durationId}
                onDuration={setDurationId}
                partySize={partySize}
                onParty={(value) => setPartySize(clampParty(experience, value))}
                addOnIds={addOnIds}
                onToggleAddOn={(id) =>
                  setAddOnIds((current) =>
                    current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
                  )
                }
                onBack={() => setStep(1)}
                onNext={() => setStep(3)}
              />
            )}

            {step === 3 && experience && (
              <DateStep
                experience={experience}
                month={month}
                today={today}
                days={days}
                loading={loadingDays}
                date={date}
                slotId={slotId}
                openSlots={openSlots}
                selectedDay={selectedDay}
                durationDays={quote?.days ?? 1}
                onMonth={setMonth}
                onDate={(next) => {
                  setDate(next);
                  const day = days.find((d) => d.date === next);
                  const first = day?.slots.find((slot) => slot.available);
                  if (first) setSlotId(first.slotId);
                }}
                onSlot={setSlotId}
                onBack={() => setStep(2)}
                onNext={() => setStep(4)}
              />
            )}

            {step === 4 && experience && quote && date && (
              <DetailsStep
                experience={experience}
                contact={contact}
                onContact={(patch) => setContact((current) => ({ ...current, ...patch }))}
                onBack={() => setStep(3)}
                onSubmit={submit}
                submitting={submitting}
              />
            )}

            {step === 5 && result && <Confirmation result={result} onAgain={startOver} />}

            {error && (
              <p className="mt-4 rounded-xl bg-[#fdecea] px-4 py-3 text-sm text-[#8c2f22] ring-1 ring-[#f0c3bc]">
                {error}
              </p>
            )}
          </div>

          {step > 1 && step < 5 && experience && quote && (
            <aside className="lg:sticky lg:top-6">
              <QuoteCard
                experience={experience}
                quote={quote}
                date={date}
                slotLabel={
                  experience.slots.find((slot) => slot.id === slotId)?.label ?? quote.slotLabel
                }
              />
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}

function Stepper({ step, onBack }: { step: Step; onBack: (step: Step) => void }) {
  return (
    <ol className="mx-auto flex max-w-2xl items-center justify-between gap-1 text-[11px] font-semibold uppercase tracking-[0.12em]">
      {([1, 2, 3, 4] as Step[]).map((value) => {
        const done = value < step;
        const active = value === step;
        return (
          <li key={value} className="flex min-w-0 flex-1 items-center gap-2">
            <button
              type="button"
              disabled={!done}
              onClick={() => done && onBack(value)}
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1 transition ${
                active
                  ? "bg-[#16281f] text-[#f7f3ea] ring-[#16281f]"
                  : done
                    ? "bg-[#c9a227] text-[#16281f] ring-[#c9a227] hover:brightness-110"
                    : "bg-transparent text-[#a89e8a] ring-[#ddd3bf]"
              }`}
              aria-label={`Step ${value}: ${STEP_LABELS[value]}`}
            >
              {done ? "✓" : value}
            </button>
            <span
              className={`hidden truncate sm:block ${active ? "text-[#16281f]" : "text-[#a89e8a]"}`}
            >
              {STEP_LABELS[value]}
            </span>
            {value < 4 && <span className="h-px flex-1 bg-[#ddd3bf]" />}
          </li>
        );
      })}
    </ol>
  );
}

function ExperiencePicker({ onChoose }: { onChoose: (experience: Experience) => void }) {
  const groups = (["tour", "event", "hunt", "stay"] as Category[]).map((category) => ({
    category,
    items: EXPERIENCES.filter((experience) => experience.category === category),
  }));

  return (
    <div className="flex flex-col gap-8">
      {groups.map(({ category, items }) => (
        <section key={category}>
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8a7f6c]">
            {CATEGORY_LABELS[category]}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {items.map((experience) => (
              <button
                key={experience.id}
                type="button"
                onClick={() => onChoose(experience)}
                className="group flex flex-col overflow-hidden rounded-2xl bg-white text-left ring-1 ring-[#e2d9c6] transition hover:-translate-y-0.5 hover:shadow-lg hover:ring-[#c9a227] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#16281f]"
              >
                <div className="relative h-36 w-full overflow-hidden bg-[#e8e1d2]">
                  {/* Static marketing imagery; next/image would add no value here. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={experience.image}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                  <span className="absolute left-3 top-3 rounded-full bg-[#16281f]/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#f7f3ea]">
                    {experience.baseRate === 0
                      ? "No charge"
                      : `From ${formatMoney(experience.baseRate)}`}
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <h4 className="font-serif text-lg leading-snug text-[#16281f]">{experience.name}</h4>
                  <p className="text-sm leading-relaxed text-[#5b5546]">{experience.tagline}</p>
                  <p className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-[11px] uppercase tracking-[0.12em] text-[#8a7f6c]">
                    <span>{seasonRangeText(experience.seasons)}</span>
                    <span aria-hidden>·</span>
                    <span>
                      {experience.party.min}–{experience.party.max}{" "}
                      {experience.party.label.toLowerCase()}
                    </span>
                  </p>
                  <span className="mt-2 inline-flex min-h-11 items-center justify-center rounded-lg bg-[#16281f] px-4 text-sm font-semibold text-[#f7f3ea] transition group-hover:bg-[#1f3b2c]">
                    Check dates
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function PlanStep(props: {
  experience: Experience;
  durationId: string;
  onDuration: (id: string) => void;
  partySize: number;
  onParty: (value: number) => void;
  addOnIds: string[];
  onToggleAddOn: (id: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const { experience, durationId, partySize, addOnIds } = props;

  return (
    <div className="flex flex-col gap-6 rounded-2xl bg-white p-5 ring-1 ring-[#e2d9c6] sm:p-6">
      <header>
        <h3 className="font-serif text-2xl text-[#16281f]">{experience.name}</h3>
        <p className="mt-2 text-sm leading-relaxed text-[#5b5546]">{experience.description}</p>
      </header>

      <Field label={`How long?`}>
        <div className="grid gap-2 sm:grid-cols-2">
          {experience.durations.map((duration) => (
            <button
              key={duration.id}
              type="button"
              onClick={() => props.onDuration(duration.id)}
              className={`flex min-h-11 flex-col items-start justify-center rounded-xl px-4 py-2.5 text-left ring-1 transition ${
                duration.id === durationId
                  ? "bg-[#16281f] text-[#f7f3ea] ring-[#16281f]"
                  : "bg-[#faf7f0] text-[#16281f] ring-[#e2d9c6] hover:ring-[#c9a227]"
              }`}
            >
              <span className="text-sm font-semibold">{duration.label}</span>
              {duration.note && (
                <span
                  className={`text-xs ${duration.id === durationId ? "text-[#c9a227]" : "text-[#8a7f6c]"}`}
                >
                  {duration.note}
                </span>
              )}
            </button>
          ))}
        </div>
      </Field>

      <Field
        label={`How many ${experience.party.label.toLowerCase()}?`}
        hint={
          experience.party.included
            ? `${experience.party.included} included · $${experience.party.overagePrice} each after`
            : `${experience.party.min} to ${experience.party.max}`
        }
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => props.onParty(partySize - (partySize > 20 ? 5 : 1))}
            className="h-11 w-11 rounded-full text-lg text-[#16281f] ring-1 ring-[#e2d9c6] transition hover:bg-[#f1ecdf]"
            aria-label="Fewer"
          >
            −
          </button>
          <input
            type="number"
            inputMode="numeric"
            value={partySize}
            min={experience.party.min}
            max={experience.party.max}
            onChange={(event) => props.onParty(Number(event.target.value))}
            className="h-11 w-24 rounded-xl bg-[#faf7f0] text-center font-serif text-xl text-[#16281f] ring-1 ring-[#e2d9c6] focus:outline-none focus:ring-2 focus:ring-[#16281f]"
          />
          <button
            type="button"
            onClick={() => props.onParty(partySize + (partySize >= 20 ? 5 : 1))}
            className="h-11 w-11 rounded-full text-lg text-[#16281f] ring-1 ring-[#e2d9c6] transition hover:bg-[#f1ecdf]"
            aria-label="More"
          >
            +
          </button>
        </div>
      </Field>

      {experience.addOns.length > 0 && (
        <Field label="Anything else?" hint="Add or remove any of these later">
          <div className="flex flex-col gap-2">
            {experience.addOns.map((addOn) => {
              const on = addOnIds.includes(addOn.id);
              return (
                <button
                  key={addOn.id}
                  type="button"
                  onClick={() => props.onToggleAddOn(addOn.id)}
                  className={`flex min-h-11 items-start gap-3 rounded-xl px-4 py-3 text-left ring-1 transition ${
                    on ? "bg-[#f3f6f2] ring-[#16281f]" : "bg-[#faf7f0] ring-[#e2d9c6] hover:ring-[#c9a227]"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[11px] ring-1 ${
                      on ? "bg-[#16281f] text-[#f7f3ea] ring-[#16281f]" : "bg-white ring-[#ccc2ad]"
                    }`}
                    aria-hidden
                  >
                    {on ? "✓" : ""}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="text-sm font-semibold text-[#16281f]">{addOn.name}</span>
                      <span className="text-sm text-[#5b5546]">
                        {formatMoney(addOn.price)}
                        <span className="text-xs text-[#8a7f6c]">
                          {addOn.unit === "flat"
                            ? ""
                            : addOn.unit === "per_night"
                              ? " / night"
                              : addOn.unit === "per_guest"
                                ? " / guest"
                                : ` / ${experience.party.singular} / day`}
                        </span>
                      </span>
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-[#6b6255]">
                      {addOn.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </Field>
      )}

      <StepButtons backLabel="Back" onBack={props.onBack} nextLabel="See open dates" onNext={props.onNext} />
    </div>
  );
}

function DateStep(props: {
  experience: Experience;
  month: string;
  today: string;
  days: DayAvailability[];
  loading: boolean;
  date: string | null;
  slotId: string;
  openSlots: { slotId: string; label: string; hours: number }[];
  selectedDay: DayAvailability | null;
  durationDays: number;
  onMonth: (month: string) => void;
  onDate: (date: string) => void;
  onSlot: (slotId: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const { experience, month, today, days, loading, date, selectedDay, durationDays } = props;
  const monthStart = startOfMonth(month);
  const leading = weekdayOf(monthStart);
  const atFirstMonth = monthStart <= startOfMonth(today);
  const atLastMonth = monthStart >= startOfMonth(addMonths(today, 11));

  return (
    <div className="flex flex-col gap-5 rounded-2xl bg-white p-2 ring-1 ring-[#e2d9c6] sm:p-6">
      <div className="flex items-center justify-between gap-2 px-2 sm:px-0">
        <button
          type="button"
          onClick={() => props.onMonth(addMonths(monthStart, -1))}
          disabled={atFirstMonth}
          className="flex h-11 w-11 items-center justify-center rounded-full text-[#16281f] ring-1 ring-[#e2d9c6] transition hover:bg-[#f1ecdf] disabled:opacity-30"
          aria-label="Previous month"
        >
          ‹
        </button>
        <div className="text-center">
          <p className="font-serif text-xl text-[#16281f]">{formatMonthLabel(month.slice(0, 7))}</p>
          <p className="text-[11px] uppercase tracking-[0.14em] text-[#8a7f6c]">
            {seasonRangeText(experience.seasons)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => props.onMonth(addMonths(monthStart, 1))}
          disabled={atLastMonth}
          className="flex h-11 w-11 items-center justify-center rounded-full text-[#16281f] ring-1 ring-[#e2d9c6] transition hover:bg-[#f1ecdf] disabled:opacity-30"
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      <div>
        <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
          {WEEKDAY_INITIALS.map((initial, index) => (
            <div
              key={index}
              className="pb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-[#a89e8a]"
            >
              {initial}
            </div>
          ))}
          {Array.from({ length: leading }).map((_, index) => (
            <div key={`blank-${index}`} />
          ))}
          {days.map((day) => (
            <DayCell
              key={day.date}
              day={day}
              selected={day.date === date}
              onSelect={() => props.onDate(day.date)}
            />
          ))}
        </div>
        {loading && (
          <p className="mt-3 text-center text-xs text-[#8a7f6c]">Reading the book…</p>
        )}
        <Legend />
      </div>

      {selectedDay && (
        <div className="rounded-xl bg-[#faf7f0] p-4 ring-1 ring-[#e2d9c6]">
          <p className="font-serif text-lg text-[#16281f]">
            {durationDays > 1
              ? formatDateSpan(selectedDay.date, durationDays)
              : formatDateLong(selectedDay.date)}
          </p>

          {props.openSlots.length > 0 ? (
            <>
              <p className="mt-1 text-xs uppercase tracking-[0.14em] text-[#8a7f6c]">
                Choose a start time
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedDay.slots.map((slot) => (
                  <button
                    key={slot.slotId}
                    type="button"
                    disabled={!slot.available}
                    onClick={() => props.onSlot(slot.slotId)}
                    title={slot.reason}
                    className={`min-h-11 rounded-xl px-4 text-sm font-semibold ring-1 transition ${
                      slot.slotId === props.slotId && slot.available
                        ? "bg-[#16281f] text-[#f7f3ea] ring-[#16281f]"
                        : slot.available
                          ? "bg-white text-[#16281f] ring-[#e2d9c6] hover:ring-[#c9a227]"
                          : "cursor-not-allowed bg-[#efe9dc] text-[#a89e8a] line-through ring-transparent"
                    }`}
                  >
                    {slot.label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-[#8c2f22]">
              {selectedDay.reason ?? "Nothing open that day."} Try another date, or call{" "}
              {VENUE.phone}.
            </p>
          )}

          {selectedDay.busy.length > 0 && (
            <div className="mt-4 border-t border-[#e2d9c6] pt-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-[#8a7f6c]">
                Already on the book that day
              </p>
              <ul className="mt-1.5 flex flex-col gap-1">
                {selectedDay.busy.map((item, index) => (
                  <li key={index} className="text-xs text-[#6b6255]">
                    {item.allDay ? "All day" : formatTime(item.startTime)} — {item.label}
                    {item.exclusive && " (property closed)"}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="px-2 sm:px-0">
        <StepButtons
          backLabel="Back"
          onBack={props.onBack}
          nextLabel="Continue"
          onNext={props.onNext}
          nextDisabled={!date || props.openSlots.length === 0}
        />
      </div>
    </div>
  );
}

function DayCell({
  day,
  selected,
  onSelect,
}: {
  day: DayAvailability;
  selected: boolean;
  onSelect: () => void;
}) {
  const unavailable = day.status === "unavailable";
  const number = Number(day.date.slice(8, 10));

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={unavailable}
      title={unavailable ? day.reason : `${day.slots.filter((s) => s.available).length} times open`}
      className={`relative flex min-h-[46px] flex-col items-center justify-center rounded-lg text-sm transition ${
        selected
          ? "bg-[#16281f] font-semibold text-[#f7f3ea] ring-2 ring-[#c9a227]"
          : unavailable
            ? "cursor-not-allowed bg-[#f1ece1] text-[#b8ae99]"
            : day.status === "limited"
              ? "bg-[#fdf6e3] text-[#16281f] ring-1 ring-[#e6cf92] hover:ring-[#c9a227]"
              : "bg-[#eef3ec] text-[#16281f] ring-1 ring-[#d5e2d2] hover:ring-[#16281f]"
      }`}
    >
      <span>{number}</span>
      {day.busy.length > 0 && (
        <span
          className={`absolute bottom-1 flex gap-0.5 ${selected ? "opacity-90" : ""}`}
          aria-hidden
        >
          {day.busy.slice(0, 3).map((item, index) => (
            <span
              key={index}
              className={`h-1 w-1 rounded-full ${
                item.exclusive ? "bg-[#8c2f22]" : selected ? "bg-[#c9a227]" : "bg-[#8a7f6c]"
              }`}
            />
          ))}
        </span>
      )}
    </button>
  );
}

function Legend() {
  const items = [
    { className: "bg-[#eef3ec] ring-1 ring-[#d5e2d2]", label: "Open" },
    { className: "bg-[#fdf6e3] ring-1 ring-[#e6cf92]", label: "Some times left" },
    { className: "bg-[#f1ece1]", label: "Taken or closed" },
  ];
  return (
    <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-[#8a7f6c]">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5">
          <span className={`h-3 w-3 rounded ${item.className}`} />
          {item.label}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-[#8c2f22]" />
        Private event on the property
      </span>
    </div>
  );
}

function DetailsStep(props: {
  experience: Experience;
  contact: { name: string; email: string; phone: string; notes: string };
  onContact: (patch: Partial<{ name: string; email: string; phone: string; notes: string }>) => void;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  const { contact } = props;
  const ready = contact.name.trim().length > 1 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contact.email);

  return (
    <form
      className="flex flex-col gap-5 rounded-2xl bg-white p-5 ring-1 ring-[#e2d9c6] sm:p-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) props.onSubmit();
      }}
    >
      <header>
        <h3 className="font-serif text-2xl text-[#16281f]">Where do we send the confirmation?</h3>
        <p className="mt-2 text-sm leading-relaxed text-[#5b5546]">
          The invitation lands on your calendar with a reminder the night before. We&apos;ll follow
          up by phone within one business day.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <input
            required
            value={contact.name}
            onChange={(event) => props.onContact({ name: event.target.value })}
            placeholder="Caroline Hollis"
            className="h-11 w-full rounded-xl bg-[#faf7f0] px-4 text-sm text-[#16281f] ring-1 ring-[#e2d9c6] focus:outline-none focus:ring-2 focus:ring-[#16281f]"
          />
        </Field>
        <Field label="Email">
          <input
            required
            type="email"
            inputMode="email"
            value={contact.email}
            onChange={(event) => props.onContact({ email: event.target.value })}
            placeholder="you@example.com"
            className="h-11 w-full rounded-xl bg-[#faf7f0] px-4 text-sm text-[#16281f] ring-1 ring-[#e2d9c6] focus:outline-none focus:ring-2 focus:ring-[#16281f]"
          />
        </Field>
        <Field label="Phone" hint="Optional">
          <input
            type="tel"
            inputMode="tel"
            value={contact.phone}
            onChange={(event) => props.onContact({ phone: event.target.value })}
            placeholder="(229) 555-0134"
            className="h-11 w-full rounded-xl bg-[#faf7f0] px-4 text-sm text-[#16281f] ring-1 ring-[#e2d9c6] focus:outline-none focus:ring-2 focus:ring-[#16281f]"
          />
        </Field>
        <Field label="Anything we should know?" hint="Optional">
          <textarea
            value={contact.notes}
            onChange={(event) => props.onContact({ notes: event.target.value })}
            rows={3}
            placeholder="Bringing two dogs, one guest uses a wheelchair, hoping for a sunset ceremony…"
            className="w-full rounded-xl bg-[#faf7f0] px-4 py-3 text-sm text-[#16281f] ring-1 ring-[#e2d9c6] focus:outline-none focus:ring-2 focus:ring-[#16281f]"
          />
        </Field>
      </div>

      <p className="text-xs leading-relaxed text-[#8a7f6c]">
        Sending this holds the date. Nothing is charged online — we take the deposit by phone or
        check, and you can move or release the date up to {props.experience.balanceDueDays || 7} days
        out.
      </p>

      <StepButtons
        backLabel="Back"
        onBack={props.onBack}
        nextLabel={props.submitting ? "Sending…" : "Send my request"}
        onNext={props.onSubmit}
        nextDisabled={!ready || props.submitting}
        submit
      />
    </form>
  );
}

function Confirmation({ result, onAgain }: { result: BookingResponse; onAgain: () => void }) {
  const { booking, email, delivery } = result;
  const experience = getExperience(booking.experience_id);
  const [showEmail, setShowEmail] = useState(true);

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl bg-[#16281f] p-6 text-[#f7f3ea]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#c9a227]">
          Confirmation {booking.reference}
        </p>
        <h3 className="mt-2 font-serif text-2xl">
          {experience?.name} — {formatDateSpan(booking.start_date, booking.days)}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-[#cdd6cd]">
          {booking.days > 1 ? "Starting at " : ""}
          {formatTime(booking.start_time)} · {booking.party_size}{" "}
          {experience?.party.label.toLowerCase()}
          {booking.total > 0 && ` · ${formatMoney(booking.total)} total`}
          {booking.deposit_due > 0 && ` · ${formatMoney(booking.deposit_due)} deposit holds it`}
        </p>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <a
            href={result.inviteUrl}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg bg-[#c9a227] px-4 text-sm font-semibold text-[#16281f] transition hover:brightness-110"
          >
            Add to my calendar
          </a>
          <button
            type="button"
            onClick={onAgain}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg px-4 text-sm font-semibold text-[#f7f3ea] ring-1 ring-[#3c5245] transition hover:bg-[#1f3b2c]"
          >
            Book something else
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-white ring-1 ring-[#e2d9c6]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2d9c6] p-4">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#8a7f6c]">
              {delivery.delivered ? "Sent to" : "Ready to send to"}
            </p>
            <p className="truncate text-sm font-semibold text-[#16281f]">{email.to}</p>
          </div>
          <button
            type="button"
            onClick={() => setShowEmail((current) => !current)}
            className="min-h-11 rounded-lg px-3 text-sm font-semibold text-[#16281f] ring-1 ring-[#e2d9c6] transition hover:bg-[#f1ecdf]"
          >
            {showEmail ? "Hide the email" : "Show the email"}
          </button>
        </div>

        {!delivery.delivered && delivery.reason && (
          <p className="border-b border-[#e2d9c6] bg-[#fdf6e3] px-4 py-3 text-xs leading-relaxed text-[#6b5a1f]">
            {delivery.reason} The message below, calendar invitation and all, is exactly what goes
            out once a mail key is configured.
          </p>
        )}

        {showEmail && (
          <div className="p-3">
            <p className="px-1 pb-2 text-xs text-[#8a7f6c]">
              <span className="font-semibold text-[#16281f]">Subject:</span> {email.subject}
            </p>
            <iframe
              title="Confirmation email"
              srcDoc={email.html}
              sandbox=""
              className="h-[520px] w-full rounded-xl bg-white ring-1 ring-[#e2d9c6]"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function QuoteCard({
  experience,
  quote,
  date,
  slotLabel,
}: {
  experience: Experience;
  quote: ReturnType<typeof buildQuote>;
  date: string | null;
  slotLabel: string;
}) {
  return (
    <div className="rounded-2xl bg-[#16281f] p-5 text-[#f7f3ea]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c9a227]">
        Your estimate
      </p>
      <h4 className="mt-2 font-serif text-xl leading-snug">{experience.name}</h4>
      <p className="mt-1 text-xs text-[#a9b8ac]">
        {date ? formatDateSpan(date, quote.days) : "Date not chosen yet"} · {slotLabel}
      </p>

      <dl className="mt-4 flex flex-col gap-2 border-t border-[#2f4438] pt-4 text-sm">
        {quote.lines
          .filter((line) => line.kind !== "tax")
          .map((line) => (
            <div key={line.id} className="flex items-start justify-between gap-3">
              <dt className="min-w-0">
                <span className="block text-[#e4e9e3]">{line.label}</span>
                {line.detail && <span className="block text-[11px] text-[#8fa294]">{line.detail}</span>}
              </dt>
              <dd
                className={`shrink-0 tabular-nums ${
                  line.amount < 0 ? "text-[#c9a227]" : "text-[#f7f3ea]"
                }`}
              >
                {formatMoney(line.amount)}
              </dd>
            </div>
          ))}
        {quote.tax > 0 && (
          <div className="flex items-center justify-between gap-3 text-[#a9b8ac]">
            <dt>Georgia sales tax</dt>
            <dd className="tabular-nums">{formatMoney(quote.tax)}</dd>
          </div>
        )}
      </dl>

      <div className="mt-4 flex items-baseline justify-between border-t border-[#2f4438] pt-4">
        <span className="text-sm text-[#a9b8ac]">Total</span>
        <span className="font-serif text-2xl tabular-nums">{formatMoney(quote.total)}</span>
      </div>

      {quote.depositDue > 0 && (
        <p className="mt-3 rounded-xl bg-[#1f3b2c] px-3 py-2.5 text-xs leading-relaxed text-[#cdd6cd]">
          <strong className="text-[#f7f3ea]">{formatMoney(quote.depositDue)}</strong> holds the date.
          Balance of {formatMoney(quote.balanceDue)} due {quote.balanceDueDays} days out.
        </p>
      )}
      {quote.total === 0 && (
        <p className="mt-3 rounded-xl bg-[#1f3b2c] px-3 py-2.5 text-xs leading-relaxed text-[#cdd6cd]">
          No charge and no obligation — come walk the place.
        </p>
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a7f6c]">
          {label}
        </span>
        {hint && <span className="text-[11px] text-[#a89e8a]">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function StepButtons(props: {
  backLabel: string;
  onBack: () => void;
  nextLabel: string;
  onNext: () => void;
  nextDisabled?: boolean;
  submit?: boolean;
}) {
  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
      <button
        type="button"
        onClick={props.onBack}
        className="inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold text-[#16281f] ring-1 ring-[#e2d9c6] transition hover:bg-[#f1ecdf]"
      >
        {props.backLabel}
      </button>
      <button
        type={props.submit ? "submit" : "button"}
        onClick={props.submit ? undefined : props.onNext}
        disabled={props.nextDisabled}
        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#16281f] px-6 text-sm font-semibold text-[#f7f3ea] transition hover:bg-[#1f3b2c] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {props.nextLabel}
      </button>
    </div>
  );
}
