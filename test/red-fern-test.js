/**
 * Tests for the Red Fern Plantation booking demo: the rate card, the
 * availability rules, the iCalendar output and the confirmation email.
 *
 * Run with `npm run test:red-fern`, which compiles utils/red-fern to CommonJS
 * first (see package.json) so this plain Node file can require it. No network,
 * no database, no server: every input is a fixture.
 */

const assert = require("node:assert/strict");
const path = require("node:path");

const BUILD = path.join(__dirname, "..", "node_modules", ".cache", "red-fern");
const catalog = require(path.join(BUILD, "catalog.js"));
const pricing = require(path.join(BUILD, "pricing.js"));
const availability = require(path.join(BUILD, "availability.js"));
const ics = require(path.join(BUILD, "ics.js"));
const booking = require(path.join(BUILD, "booking.js"));
const email = require(path.join(BUILD, "email.js"));
const seed = require(path.join(BUILD, "seed.js"));
const dates = require(path.join(BUILD, "dates.js"));

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

// --- fixtures ---------------------------------------------------------------

const TODAY = "2026-09-06";

function quoteFor(experienceId, overrides = {}) {
  const experience = catalog.getExperience(experienceId);
  return pricing.buildQuote(experience, {
    experienceId,
    startDate: overrides.startDate ?? "2026-11-21",
    durationId: overrides.durationId ?? experience.durations[0].id,
    slotId: overrides.slotId ?? experience.slots[0].id,
    partySize: overrides.partySize ?? experience.party.min,
    addOnIds: overrides.addOnIds ?? [],
  });
}

/** A booking row, without going through the request validator. */
function bookingRow(overrides = {}) {
  const experienceId = overrides.experience_id ?? "duck-hunt";
  const experience = catalog.getExperience(experienceId);
  const slot = experience.slots[0];
  return {
    reference: "RF-TEST01",
    experience_id: experienceId,
    start_date: "2026-11-21",
    days: 1,
    slot_id: slot.id,
    start_time: slot.start,
    hours: slot.hours,
    party_size: experience.party.min,
    add_on_ids: [],
    guest_name: "Walt Chesser",
    guest_email: "wchesser@example.com",
    guest_phone: "(229) 555-0198",
    notes: null,
    status: "confirmed",
    total: 1404,
    deposit_due: 702,
    created_at: "2026-09-06T12:00:00.000Z",
    sequence: 0,
    ...overrides,
  };
}

// --- rate card --------------------------------------------------------------

test("a hunt multiplies the rate by guns and days", () => {
  const quote = quoteFor("duck-hunt", { partySize: 4 });
  assert.equal(quote.lines[0].amount, 1300);
  assert.equal(quote.tax, 104);
  assert.equal(quote.total, 1404);
  // Hunts take half down.
  assert.equal(quote.depositDue, 702);
  assert.equal(quote.balanceDue, 702);
});

test("a multi-day package discounts the base, not the fees", () => {
  const quote = quoteFor("duck-hunt", { partySize: 4, durationId: "2-day" });
  const discount = quote.lines.find((line) => line.kind === "discount");
  assert.equal(discount.amount, -260);
  assert.equal(quote.total, 2527.2);
  // Two mornings for less than twice one morning.
  assert.ok(quote.total < quoteFor("duck-hunt", { partySize: 4 }).total * 2);
});

test("a Saturday wedding in October carries both premiums", () => {
  const quote = quoteFor("wedding", {
    startDate: "2026-10-03",
    partySize: 185,
    addOnIds: ["catering"],
  });
  const labels = quote.lines.map((line) => line.label);
  assert.ok(labels.includes("Saturday premium"));
  assert.ok(labels.includes("Peak season"));

  const overage = quote.lines.find((line) => line.kind === "party");
  assert.equal(overage.amount, 490); // 35 guests over 150, at $14
  const catering = quote.lines.find((line) => line.id === "add-on:catering");
  assert.equal(catering.amount, 12_580); // $68 × 185

  assert.equal(quote.subtotal, 22_170);
  assert.equal(quote.total, 23_943.6);
  assert.equal(quote.depositDue, 5_985.9);
});

test("the same wedding on a Friday in February is thousands cheaper", () => {
  const saturday = quoteFor("wedding", { startDate: "2026-10-03", partySize: 150 });
  const friday = quoteFor("wedding", { startDate: "2027-02-05", partySize: 150 });
  assert.equal(Math.round(saturday.total - friday.total), Math.round((750 + 900) * 1.08));
});

test("lodge overage is charged per night, and the state fee is not taxed", () => {
  const quote = quoteFor("lodge-stay", { partySize: 10, durationId: "2-night" });
  const overage = quote.lines.find((line) => line.kind === "party");
  assert.equal(overage.amount, 340); // 2 guests over 8, $85, two nights

  const fee = quote.lines.find((line) => line.id === "lodging-fee");
  assert.equal(fee.amount, 10);
  assert.equal(fee.taxable, false);

  assert.equal(quote.tax, 179.2); // 8% of $2,240, not of $2,250
  assert.equal(quote.total, 2_429.2);
});

test("a tour is free, untaxed and takes no deposit", () => {
  const quote = quoteFor("property-tour", { partySize: 4 });
  assert.equal(quote.total, 0);
  assert.equal(quote.tax, 0);
  assert.equal(quote.depositDue, 0);
  assert.ok(!quote.lines.some((line) => line.kind === "tax"));
});

test("party size is clamped to what the offering can host", () => {
  const experience = catalog.getExperience("duck-hunt");
  assert.equal(pricing.clampParty(experience, 99), 8);
  assert.equal(pricing.clampParty(experience, 0), 2);
});

// --- availability -----------------------------------------------------------

function availabilityFor(experienceId, options = {}) {
  return availability.buildAvailability({
    experience: catalog.getExperience(experienceId),
    durationDays: options.durationDays ?? 1,
    from: options.from,
    to: options.to ?? options.from,
    bookings: options.bookings ?? [],
    today: options.today ?? TODAY,
  });
}

test("out-of-season dates are closed with a reason", () => {
  const [july] = availabilityFor("duck-hunt", { from: "2027-07-04" });
  assert.equal(july.status, "unavailable");
  assert.equal(july.reason, "Out of season");

  const [december] = availabilityFor("duck-hunt", { from: "2026-12-05" });
  assert.equal(december.status, "open");
});

test("a season that wraps the new year stays open in January", () => {
  assert.ok(catalog.isInSeason("2027-01-10", catalog.getExperience("duck-hunt").seasons));
  assert.ok(!catalog.isInSeason("2026-11-01", catalog.getExperience("duck-hunt").seasons));
});

test("the notice period closes dates that are too soon", () => {
  const [tomorrow] = availabilityFor("duck-hunt", { from: "2026-12-07", today: "2026-12-06" });
  assert.equal(tomorrow.status, "unavailable");
  assert.match(tomorrow.reason, /notice/);
});

test("a wedding closes the property to everything else that weekend", () => {
  const wedding = bookingRow({
    reference: "RF-WED001",
    experience_id: "wedding",
    start_date: "2026-12-11",
    days: 3,
    slot_id: "all-day",
    start_time: "10:00",
    hours: 14,
    party_size: 150,
  });

  const [duckDay] = availabilityFor("duck-hunt", {
    from: "2026-12-12",
    bookings: [wedding],
  });
  assert.equal(duckDay.status, "unavailable");
  assert.equal(duckDay.slots[0].reason, "Private event on the property");
  assert.equal(duckDay.busy[0].label, "Wedding Weekend");
  assert.ok(duckDay.busy[0].exclusive);
});

test("a duck hunt and an afternoon clays round share a day", () => {
  const hunt = bookingRow({ start_date: "2026-12-12" });
  const [clays] = availabilityFor("sporting-clays", {
    from: "2026-12-12",
    bookings: [hunt],
  });
  assert.equal(clays.status, "open");
  // The hunt still shows on the day, it just doesn't block the clays course.
  assert.equal(clays.busy.length, 1);
});

test("the same blind can't be sold twice", () => {
  const hunt = bookingRow({ start_date: "2026-12-12" });
  const check = availability.checkSlot({
    experience: catalog.getExperience("duck-hunt"),
    startDate: "2026-12-12",
    days: 1,
    startTime: "05:30",
    hours: 5,
    bookings: [hunt],
    today: TODAY,
  });
  assert.equal(check.ok, false);
  assert.match(check.reason, /just taken/);
});

test("a three-morning hunt needs all three mornings clear", () => {
  const middleDay = bookingRow({ reference: "RF-MID001", start_date: "2026-12-13" });
  const [start] = availabilityFor("duck-hunt", {
    from: "2026-12-12",
    durationDays: 3,
    bookings: [middleDay],
  });
  assert.equal(start.status, "unavailable");

  const [clear] = availabilityFor("duck-hunt", {
    from: "2026-12-14",
    durationDays: 3,
    bookings: [middleDay],
  });
  assert.equal(clear.status, "open");
});

test("a day with one of three slots taken reads as limited", () => {
  const clays = bookingRow({
    reference: "RF-CLY001",
    experience_id: "sporting-clays",
    start_date: "2026-12-12",
    slot_id: "morning",
    start_time: "09:00",
    hours: 3,
    party_size: 4,
  });
  const [day] = availabilityFor("sporting-clays", { from: "2026-12-12", bookings: [clays] });
  assert.equal(day.status, "limited");
  assert.equal(day.slots.filter((slot) => slot.available).length, 2);
});

test("cancelled bookings free the date back up", () => {
  const cancelled = bookingRow({ start_date: "2026-12-12", status: "cancelled" });
  const [day] = availabilityFor("duck-hunt", { from: "2026-12-12", bookings: [cancelled] });
  assert.equal(day.status, "open");
  assert.equal(day.busy.length, 0);
});

test("past dates are closed", () => {
  const [day] = availabilityFor("sporting-clays", { from: "2026-09-01", today: TODAY });
  assert.equal(day.reason, "Past date");
});

// --- iCalendar --------------------------------------------------------------

/** Undo RFC 5545 line folding, so a property can be matched as one string. */
function unfold(body) {
  return body.replace(/\r\n /g, "");
}

test("an invite is a REQUEST with the guest as attendee", () => {
  const body = ics.buildBookingInvite(bookingRow());
  assert.match(body, /METHOD:REQUEST/);
  assert.match(body, /UID:redfern-rf-test01@redfernplantation\.com/);
  assert.match(body, /SEQUENCE:0/);
  assert.match(
    unfold(body),
    /ATTENDEE;CN=Walt Chesser;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:wchesser@example\.com/
  );
  assert.match(body, /ORGANIZER;CN=Red Fern Plantation:mailto:events@redfernplantation\.com/);
  // Every line ends CRLF, as RFC 5545 requires.
  assert.ok(body.endsWith("\r\n"));
});

test("a 5:30 AM hunt in November lands at 10:30 UTC", () => {
  const body = ics.buildBookingInvite(bookingRow());
  assert.match(body, /DTSTART:20261121T103000Z/);
  assert.match(body, /DTEND:20261121T153000Z/);
});

test("local time survives the spring-forward boundary", () => {
  // 2026-03-08 is the switch to Eastern Daylight Time.
  assert.equal(
    ics.formatUtcStamp(dates.venueTimeToUtc("2026-03-07", "08:00")),
    "20260307T130000Z"
  );
  assert.equal(
    ics.formatUtcStamp(dates.venueTimeToUtc("2026-03-08", "08:00")),
    "20260308T120000Z"
  );
});

test("a multi-day booking becomes an all-day span with an exclusive end", () => {
  const body = ics.buildBookingInvite(bookingRow({ days: 3 }));
  assert.match(body, /DTSTART;VALUE=DATE:20261121/);
  assert.match(body, /DTEND;VALUE=DATE:20261124/);
});

test("a cancellation withdraws the event and drops the alarms", () => {
  const body = ics.buildBookingInvite(bookingRow(), { method: "CANCEL" });
  assert.match(body, /METHOD:CANCEL/);
  assert.match(body, /STATUS:CANCELLED/);
  assert.ok(!body.includes("BEGIN:VALARM"));
});

test("the guest's invite never carries another guest's details", () => {
  const guest = ics.buildBookingInvite(bookingRow());
  assert.ok(!guest.includes("(229) 555-0198"));

  const venue = ics.buildVenueFeed([bookingRow()]);
  assert.match(venue, /METHOD:PUBLISH/);
  assert.match(venue, /Chesser party/);
  assert.ok(venue.includes("(229) 555-0198"));
});

test("long lines are folded to 75 octets", () => {
  const body = ics.buildBookingInvite(
    bookingRow({
      notes:
        "We are bringing two labs, a nephew who has never shot before, and a cooler that needs ice both mornings please.",
    })
  );
  for (const line of body.split("\r\n")) {
    assert.ok(
      new TextEncoder().encode(line).length <= 75,
      `line over 75 octets: ${line.slice(0, 40)}…`
    );
  }
});

test("the balance is due ahead of arrival, not after", () => {
  const row = bookingRow();
  const due = ics.balanceDueDate(row, catalog.getExperience("duck-hunt"));
  assert.equal(due, "2026-11-14"); // seven days out
  assert.equal(ics.balanceDueDate(bookingRow({ experience_id: "property-tour", total: 0 }), catalog.getExperience("property-tour")), null);
});

// --- taking a booking -------------------------------------------------------

function requestBody(overrides = {}) {
  return {
    experienceId: "duck-hunt",
    startDate: "2026-12-12",
    durationId: "1-day",
    slotId: "first-light",
    partySize: 4,
    addOnIds: ["bird-cleaning"],
    name: "Walt Chesser",
    email: "wchesser@example.com",
    phone: "(229) 555-0198",
    notes: "Two dogs coming with us.",
    ...overrides,
  };
}

test("a good request becomes a priced booking", () => {
  const result = booking.prepareBooking(requestBody(), { reference: "RF-ABC123" });
  assert.ok(result.ok);
  assert.equal(result.value.booking.reference, "RF-ABC123");
  assert.equal(result.value.booking.status, "requested");
  assert.equal(result.value.booking.total, result.value.quote.total);
  assert.deepEqual(result.value.booking.add_on_ids, ["bird-cleaning"]);
});

test("a free tour confirms itself", () => {
  const result = booking.prepareBooking(
    requestBody({
      experienceId: "property-tour",
      durationId: "single",
      slotId: "morning",
      partySize: 2,
      addOnIds: [],
    })
  );
  assert.ok(result.ok);
  assert.equal(result.value.booking.status, "confirmed");
});

test("bad input is refused with the field that's wrong", () => {
  const cases = [
    [{ experienceId: "trebuchet-lessons" }, "experienceId"],
    [{ startDate: "next friday" }, "startDate"],
    [{ partySize: 40 }, "partySize"],
    [{ email: "not-an-email" }, "email"],
    [{ name: "" }, "name"],
  ];
  for (const [patch, field] of cases) {
    const result = booking.prepareBooking(requestBody(patch));
    assert.equal(result.ok, false, `expected ${field} to be refused`);
    assert.equal(result.field, field);
  }
});

test("add-ons from another offering are dropped", () => {
  const result = booking.prepareBooking(requestBody({ addOnIds: ["bird-cleaning", "catering"] }));
  assert.ok(result.ok);
  assert.deepEqual(result.value.booking.add_on_ids, ["bird-cleaning"]);
});

test("references are readable over a phone", () => {
  const reference = booking.generateReference(() => 0.5);
  assert.match(reference, /^RF-[A-HJ-NP-Z2-9]{6}$/);
});

// --- the confirmation email -------------------------------------------------

test("the confirmation carries the invite as a calendar attachment", () => {
  const prepared = booking.prepareBooking(requestBody(), { reference: "RF-ABC123" });
  const message = email.buildBookingEmail(
    prepared.value.booking,
    prepared.value.experience,
    prepared.value.quote,
    { from: "Red Fern <events@redfernplantation.com>" }
  );

  assert.equal(message.to, "wchesser@example.com");
  assert.match(message.subject, /Date held: Guided Duck Hunt/);

  const attachment = message.attachments[0];
  assert.equal(attachment.content_type, "text/calendar; charset=utf-8; method=REQUEST");
  const decoded = Buffer.from(attachment.content, "base64").toString("utf-8");
  assert.equal(decoded, message.calendar);
  assert.match(decoded, /BEGIN:VCALENDAR/);

  // Every priced line shows up, so the estimate can't disagree with the page.
  assert.match(message.text, /Bird cleaning & packaging/);
  assert.match(message.text, /Deposit to confirm/);
  assert.match(message.html, /Guided Duck Hunt/);
});

test("guest input is escaped before it reaches the HTML body", () => {
  const prepared = booking.prepareBooking(
    requestBody({ notes: '<script>alert("boo")</script>', name: "Walt & Sons" }),
    { reference: "RF-ABC123" }
  );
  const message = email.buildBookingEmail(
    prepared.value.booking,
    prepared.value.experience,
    prepared.value.quote,
    { from: "Red Fern <events@redfernplantation.com>" }
  );
  assert.ok(!message.html.includes("<script>"));
  assert.match(message.html, /&lt;script&gt;/);
});

test("a free tour's confirmation asks for no money", () => {
  const prepared = booking.prepareBooking(
    requestBody({ experienceId: "property-tour", durationId: "single", slotId: "morning", partySize: 2, addOnIds: [] })
  );
  const message = email.buildBookingEmail(
    prepared.value.booking,
    prepared.value.experience,
    prepared.value.quote,
    { from: "Red Fern <events@redfernplantation.com>" }
  );
  assert.match(message.subject, /^Confirmed:/);
  assert.ok(!message.text.includes("Deposit"));
});

// --- the demo schedule ------------------------------------------------------

test("the seeded schedule is one the booking rules would have accepted", () => {
  const rows = seed.buildSeedBookings(TODAY);
  assert.ok(rows.length >= 10);

  for (const row of rows) {
    const experience = catalog.getExperience(row.experience_id);
    assert.ok(row.start_date >= TODAY, `${row.reference} is in the past`);
    assert.ok(
      catalog.isInSeason(row.start_date, experience.seasons),
      `${row.reference} is out of season`
    );
    if (experience.daysOfWeek) {
      assert.ok(experience.daysOfWeek.includes(dates.weekdayOf(row.start_date)));
    }
  }

  // No two seeded bookings collide.
  const occupancies = rows.map(availability.occupancyOf);
  for (let i = 0; i < occupancies.length; i++) {
    for (let j = i + 1; j < occupancies.length; j++) {
      assert.ok(
        !availability.conflicts(occupancies[i], occupancies[j]),
        `${rows[i].reference} collides with ${rows[j].reference}`
      );
    }
  }
});

test("the schedule seeds itself the same way whatever today is", () => {
  for (const day of ["2026-01-02", "2026-05-15", "2026-09-06", "2026-11-30"]) {
    const rows = seed.buildSeedBookings(day);
    assert.ok(rows.length >= 10, `only ${rows.length} bookings seeded from ${day}`);
    assert.ok(rows.every((row) => row.total >= 0));
  }
});

// --- runner -----------------------------------------------------------------

(async () => {
  let failures = 0;
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`  ok  ${name}`);
    } catch (error) {
      failures++;
      console.error(`FAIL  ${name}`);
      console.error(`      ${error.message}`);
    }
  }
  console.log(`\n${tests.length - failures}/${tests.length} passed`);
  process.exit(failures === 0 ? 0 : 1);
})();
