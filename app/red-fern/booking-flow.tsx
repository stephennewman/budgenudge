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
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8e2b1e]">
            Book the place
          </p>
          <h2 className="mt-3 rf-display text-3xl leading-tight text-[#3c4143] sm:text-4xl">
            {step === 5 ? "You're on the book" : "What brings you out to Red Fern?"}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-[#5a6062]">
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
              <p className="mt-4 rounded-xl bg-[#fbeeec] px-4 py-3 text-sm text-[#8e2b1e] ring-1 ring-[#e8c4bf]">
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
                  ? "bg-[#3c4143] text-[#f4f2ef] ring-[#3c4143]"
                  : done
                    ? "bg-[#8e2b1e] text-[#f4f2ef] ring-[#8e2b1e] hover:brightness-110"
                    : "bg-transparent text-[#9ea3a5] ring-[#ddd3bf]"
              }`}
              aria-label={`Step ${value}: ${STEP_LABELS[value]}`}
            >
              {done ? "✓" : value}
            </button>
            <span
              className={`hidden truncate sm:block ${active ? "text-[#3c4143]" : "text-[#9ea3a5]"}`}
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
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7e8385]">
            {CATEGORY_LABELS[category]}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {items.map((experience) => (
              <button
                key={experience.id}
                type="button"
                onClick={() => onChoose(experience)}
                className="group flex flex-col overflow-hidden rounded-2xl bg-white text-left ring-1 ring-[#ddd9d3] transition hover:-translate-y-0.5 hover:shadow-lg hover:ring-[#b0574a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3c4143]"
              >
                <div className="relative h-36 w-full overflow-hidden bg-[#e6e3de]">
                  {/* Static marketing imagery; next/image would add no value here. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={experience.image}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                  <span className="absolute left-3 top-3 rounded-full bg-[#3c4143]/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#f4f2ef]">
                    {experience.baseRate === 0
                      ? "No charge"
                      : `From ${formatMoney(experience.baseRate)}`}
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <h4 className="rf-display text-lg leading-snug text-[#3c4143]">{experience.name}</h4>
                  <p className="text-sm leading-relaxed text-[#5a6062]">{experience.tagline}</p>
                  <p className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-[11px] uppercase tracking-[0.12em] text-[#7e8385]">
                    <span>{seasonRangeText(experience.seasons)}</span>
                    <span aria-hidden>·</span>
                    <span>
                      {experience.party.min}–{experience.party.max}{" "}
                      {experience.party.label.toLowerCase()}
                    </span>
                  </p>
                  <span className="mt-2 inline-flex min-h-11 items-center justify-center rounded-lg bg-[#3c4143] px-4 text-sm font-semibold text-[#f4f2ef] transition group-hover:bg-[#4d5355]">
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

  // The field holds what's been typed, not the clamped number. Clamping every
  // keystroke turns "185" into nonsense: the "1" snaps to the 25-guest
  // minimum, and the next digit lands on the end of that.
  const [partyText, setPartyText] = useState(String(partySize));
  useEffect(() => setPartyText(String(partySize)), [partySize]);

  return (
    <div className="flex flex-col gap-6 rounded-2xl bg-white p-5 ring-1 ring-[#ddd9d3] sm:p-6">
      <header>
        <h3 className="rf-display text-2xl text-[#3c4143]">{experience.name}</h3>
        <p className="mt-2 text-sm leading-relaxed text-[#5a6062]">{experience.description}</p>
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
                  ? "bg-[#3c4143] text-[#f4f2ef] ring-[#3c4143]"
                  : "bg-[#f6f4f1] text-[#3c4143] ring-[#ddd9d3] hover:ring-[#b0574a]"
              }`}
            >
              <span className="text-sm font-semibold">{duration.label}</span>
              {duration.note && (
                <span
                  className={`text-xs ${duration.id === durationId ? "text-[#d99183]" : "text-[#7e8385]"}`}
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
            className="h-11 w-11 rounded-full text-lg text-[#3c4143] ring-1 ring-[#ddd9d3] transition hover:bg-[#eceae6]"
            aria-label="Fewer"
          >
            −
          </button>
          <input
            type="number"
            inputMode="numeric"
            value={partyText}
            min={experience.party.min}
            max={experience.party.max}
            onChange={(event) => {
              setPartyText(event.target.value);
              const typed = Number(event.target.value);
              // Only price a number that's actually offerable; anything else
              // waits for the field to lose focus.
              if (
                Number.isFinite(typed) &&
                typed >= experience.party.min &&
                typed <= experience.party.max
              ) {
                props.onParty(typed);
              }
            }}
            onBlur={() => props.onParty(Number(partyText) || experience.party.min)}
            className="h-11 w-24 rounded-xl bg-[#f6f4f1] text-center rf-display text-xl text-[#3c4143] ring-1 ring-[#ddd9d3] focus:outline-none focus:ring-2 focus:ring-[#3c4143]"
          />
          <button
            type="button"
            onClick={() => props.onParty(partySize + (partySize >= 20 ? 5 : 1))}
            className="h-11 w-11 rounded-full text-lg text-[#3c4143] ring-1 ring-[#ddd9d3] transition hover:bg-[#eceae6]"
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
                    on ? "bg-[#f1f4f0] ring-[#3c4143]" : "bg-[#f6f4f1] ring-[#ddd9d3] hover:ring-[#b0574a]"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[11px] ring-1 ${
                      on ? "bg-[#3c4143] text-[#f4f2ef] ring-[#3c4143]" : "bg-white ring-[#c6c9ca]"
                    }`}
                    aria-hidden
                  >
                    {on ? "✓" : ""}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="text-sm font-semibold text-[#3c4143]">{addOn.name}</span>
                      <span className="text-sm text-[#5a6062]">
                        {formatMoney(addOn.price)}
                        <span className="text-xs text-[#7e8385]">
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
                    <span className="mt-0.5 block text-xs leading-relaxed text-[#63696b]">
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
    <div className="flex flex-col gap-5 rounded-2xl bg-white p-2 ring-1 ring-[#ddd9d3] sm:p-6">
      <div className="flex items-center justify-between gap-2 px-2 sm:px-0">
        <button
          type="button"
          onClick={() => props.onMonth(addMonths(monthStart, -1))}
          disabled={atFirstMonth}
          className="flex h-11 w-11 items-center justify-center rounded-full text-[#3c4143] ring-1 ring-[#ddd9d3] transition hover:bg-[#eceae6] disabled:opacity-30"
          aria-label="Previous month"
        >
          ‹
        </button>
        <div className="text-center">
          <p className="rf-display text-xl text-[#3c4143]">{formatMonthLabel(month.slice(0, 7))}</p>
          <p className="text-[11px] uppercase tracking-[0.14em] text-[#7e8385]">
            {seasonRangeText(experience.seasons)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => props.onMonth(addMonths(monthStart, 1))}
          disabled={atLastMonth}
          className="flex h-11 w-11 items-center justify-center rounded-full text-[#3c4143] ring-1 ring-[#ddd9d3] transition hover:bg-[#eceae6] disabled:opacity-30"
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
              className="pb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-[#9ea3a5]"
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
          <p className="mt-3 text-center text-xs text-[#7e8385]">Reading the book…</p>
        )}
        <Legend />
      </div>

      {selectedDay && (
        <div className="rounded-xl bg-[#f6f4f1] p-4 ring-1 ring-[#ddd9d3]">
          <p className="rf-display text-lg text-[#3c4143]">
            {durationDays > 1
              ? formatDateSpan(selectedDay.date, durationDays)
              : formatDateLong(selectedDay.date)}
          </p>

          {props.openSlots.length > 0 ? (
            <>
              <p className="mt-1 text-xs uppercase tracking-[0.14em] text-[#7e8385]">
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
                        ? "bg-[#3c4143] text-[#f4f2ef] ring-[#3c4143]"
                        : slot.available
                          ? "bg-white text-[#3c4143] ring-[#ddd9d3] hover:ring-[#b0574a]"
                          : "cursor-not-allowed bg-[#efe9dc] text-[#9ea3a5] line-through ring-transparent"
                    }`}
                  >
                    {slot.label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-[#8e2b1e]">
              {selectedDay.reason ?? "Nothing open that day."} Try another date, or call{" "}
              {VENUE.phone}.
            </p>
          )}

          {selectedDay.busy.length > 0 && (
            <div className="mt-4 border-t border-[#ddd9d3] pt-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-[#7e8385]">
                Already on the book that day
              </p>
              <ul className="mt-1.5 flex flex-col gap-1">
                {selectedDay.busy.map((item, index) => (
                  <li key={index} className="text-xs text-[#63696b]">
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
          ? "bg-[#3c4143] font-semibold text-[#f4f2ef] ring-2 ring-[#cf8577]"
          : unavailable
            ? "cursor-not-allowed bg-[#e9e7e3] text-[#aeb2b3]"
            : day.status === "limited"
              ? "bg-[#f6edd2] font-medium text-[#3c4143] ring-1 ring-[#d8c084] hover:ring-[#b0574a]"
              : "bg-[#dde7da] font-medium text-[#3c4143] ring-1 ring-[#b6c9b3] hover:ring-[#3c4143]"
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
                item.exclusive ? "bg-[#8e2b1e]" : selected ? "bg-[#d99183]" : "bg-[#7e8385]"
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
    { className: "bg-[#dde7da] ring-1 ring-[#b6c9b3]", label: "Open" },
    { className: "bg-[#f6edd2] ring-1 ring-[#d8c084]", label: "Some times left" },
    { className: "bg-[#e9e7e3]", label: "Taken or closed" },
  ];
  return (
    <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-[#7e8385]">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5">
          <span className={`h-3 w-3 rounded ${item.className}`} />
          {item.label}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-[#8e2b1e]" />
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
      className="flex flex-col gap-5 rounded-2xl bg-white p-5 ring-1 ring-[#ddd9d3] sm:p-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) props.onSubmit();
      }}
    >
      <header>
        <h3 className="rf-display text-2xl text-[#3c4143]">Where do we send the confirmation?</h3>
        <p className="mt-2 text-sm leading-relaxed text-[#5a6062]">
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
            className="h-11 w-full rounded-xl bg-[#f6f4f1] px-4 text-sm text-[#3c4143] ring-1 ring-[#ddd9d3] focus:outline-none focus:ring-2 focus:ring-[#3c4143]"
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
            className="h-11 w-full rounded-xl bg-[#f6f4f1] px-4 text-sm text-[#3c4143] ring-1 ring-[#ddd9d3] focus:outline-none focus:ring-2 focus:ring-[#3c4143]"
          />
        </Field>
        <Field label="Phone" hint="Optional">
          <input
            type="tel"
            inputMode="tel"
            value={contact.phone}
            onChange={(event) => props.onContact({ phone: event.target.value })}
            placeholder="(229) 555-0134"
            className="h-11 w-full rounded-xl bg-[#f6f4f1] px-4 text-sm text-[#3c4143] ring-1 ring-[#ddd9d3] focus:outline-none focus:ring-2 focus:ring-[#3c4143]"
          />
        </Field>
        <Field label="Anything we should know?" hint="Optional">
          <textarea
            value={contact.notes}
            onChange={(event) => props.onContact({ notes: event.target.value })}
            rows={3}
            placeholder="Bringing two dogs, one guest uses a wheelchair, hoping for a sunset ceremony…"
            className="w-full rounded-xl bg-[#f6f4f1] px-4 py-3 text-sm text-[#3c4143] ring-1 ring-[#ddd9d3] focus:outline-none focus:ring-2 focus:ring-[#3c4143]"
          />
        </Field>
      </div>

      <p className="text-xs leading-relaxed text-[#7e8385]">
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
      <div className="rounded-2xl bg-[#3c4143] p-6 text-[#f4f2ef]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#cf8577]">
          Confirmation {booking.reference}
        </p>
        <h3 className="mt-2 rf-display text-2xl">
          {experience?.name} — {formatDateSpan(booking.start_date, booking.days)}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-[#d6d3ce]">
          {booking.days > 1 ? "Starting at " : ""}
          {formatTime(booking.start_time)} · {booking.party_size}{" "}
          {experience?.party.label.toLowerCase()}
          {booking.total > 0 && ` · ${formatMoney(booking.total)} total`}
          {booking.deposit_due > 0 && ` · ${formatMoney(booking.deposit_due)} deposit holds it`}
        </p>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <a
            href={result.inviteUrl}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg bg-[#8e2b1e] px-4 text-sm font-semibold text-[#f4f2ef] transition hover:brightness-110"
          >
            Add to my calendar
          </a>
          <button
            type="button"
            onClick={onAgain}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg px-4 text-sm font-semibold text-[#f4f2ef] ring-1 ring-[#5b6264] transition hover:bg-[#4d5355]"
          >
            Book something else
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-white ring-1 ring-[#ddd9d3]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ddd9d3] p-4">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#7e8385]">
              {delivery.delivered ? "Sent to" : "Ready to send to"}
            </p>
            <p className="truncate text-sm font-semibold text-[#3c4143]">{email.to}</p>
          </div>
          <button
            type="button"
            onClick={() => setShowEmail((current) => !current)}
            className="min-h-11 rounded-lg px-3 text-sm font-semibold text-[#3c4143] ring-1 ring-[#ddd9d3] transition hover:bg-[#eceae6]"
          >
            {showEmail ? "Hide the email" : "Show the email"}
          </button>
        </div>

        {!delivery.delivered && delivery.reason && (
          <p className="border-b border-[#ddd9d3] bg-[#f7f2e6] px-4 py-3 text-xs leading-relaxed text-[#6f6030]">
            {delivery.reason} The message below, calendar invitation and all, is exactly what goes
            out once a mail key is configured.
          </p>
        )}

        {showEmail && (
          <div className="p-3">
            <p className="px-1 pb-2 text-xs text-[#7e8385]">
              <span className="font-semibold text-[#3c4143]">Subject:</span> {email.subject}
            </p>
            <iframe
              title="Confirmation email"
              srcDoc={email.html}
              sandbox=""
              className="h-[520px] w-full rounded-xl bg-white ring-1 ring-[#ddd9d3]"
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
    <div className="rounded-2xl bg-[#3c4143] p-5 text-[#f4f2ef]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#cf8577]">
        Your estimate
      </p>
      <h4 className="mt-2 rf-display text-xl leading-snug">{experience.name}</h4>
      <p className="mt-1 text-xs text-[#a8adaf]">
        {date ? formatDateSpan(date, quote.days) : "Date not chosen yet"} · {slotLabel}
      </p>

      <dl className="mt-4 flex flex-col gap-2 border-t border-[#565c5e] pt-4 text-sm">
        {quote.lines
          .filter((line) => line.kind !== "tax")
          .map((line) => (
            <div key={line.id} className="flex items-start justify-between gap-3">
              <dt className="min-w-0">
                <span className="block text-[#e6e4e0]">{line.label}</span>
                {line.detail && <span className="block text-[11px] text-[#8b9294]">{line.detail}</span>}
              </dt>
              <dd
                className={`shrink-0 tabular-nums ${
                  line.amount < 0 ? "text-[#d99183]" : "text-[#f4f2ef]"
                }`}
              >
                {formatMoney(line.amount)}
              </dd>
            </div>
          ))}
        {quote.tax > 0 && (
          <div className="flex items-center justify-between gap-3 text-[#a8adaf]">
            <dt>Georgia sales tax</dt>
            <dd className="tabular-nums">{formatMoney(quote.tax)}</dd>
          </div>
        )}
      </dl>

      <div className="mt-4 flex items-baseline justify-between border-t border-[#565c5e] pt-4">
        <span className="text-sm text-[#a8adaf]">Total</span>
        <span className="rf-display text-2xl tabular-nums">{formatMoney(quote.total)}</span>
      </div>

      {quote.depositDue > 0 && (
        <p className="mt-3 rounded-xl bg-[#4d5355] px-3 py-2.5 text-xs leading-relaxed text-[#d6d3ce]">
          <strong className="text-[#f4f2ef]">{formatMoney(quote.depositDue)}</strong> holds the date.
          Balance of {formatMoney(quote.balanceDue)} due {quote.balanceDueDays} days out.
        </p>
      )}
      {quote.total === 0 && (
        <p className="mt-3 rounded-xl bg-[#4d5355] px-3 py-2.5 text-xs leading-relaxed text-[#d6d3ce]">
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
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7e8385]">
          {label}
        </span>
        {hint && <span className="text-[11px] text-[#9ea3a5]">{hint}</span>}
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
        className="inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold text-[#3c4143] ring-1 ring-[#ddd9d3] transition hover:bg-[#eceae6]"
      >
        {props.backLabel}
      </button>
      <button
        type={props.submit ? "submit" : "button"}
        onClick={props.submit ? undefined : props.onNext}
        disabled={props.nextDisabled}
        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#3c4143] px-6 text-sm font-semibold text-[#f4f2ef] transition hover:bg-[#4d5355] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {props.nextLabel}
      </button>
    </div>
  );
}
