/**
 * Tests for the Florida launch calendar: pad filtering, schedule diffing, and
 * iCalendar output.
 *
 * Run with `npm run test:launch-calendar`, which compiles utils/launches to
 * CommonJS first (see package.json) so this plain Node file can require it.
 * No network and no database: every input is a fixture.
 */

const assert = require("node:assert/strict");
const path = require("node:path");

const BUILD = path.join(__dirname, "..", "node_modules", ".cache", "launch-calendar");
const source = require(path.join(BUILD, "source.js"));
const changes = require(path.join(BUILD, "changes.js"));
const ics = require(path.join(BUILD, "ics.js"));

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

// --- fixtures ---------------------------------------------------------------

function rawLaunch(overrides = {}) {
  const { pad, netPrecision, ...rest } = overrides;
  return {
    id: "aaaa-1111",
    name: "Falcon 9 Block 5 | Starlink Group 12-1",
    slug: "falcon-9-starlink-12-1",
    net: "2026-09-13T18:50:00Z",
    net_precision: netPrecision ?? { abbrev: "MIN", name: "Minute" },
    window_start: "2026-09-13T18:50:00Z",
    window_end: "2026-09-13T20:27:00Z",
    status: { abbrev: "Go", name: "Go for Launch" },
    probability: 80,
    launch_service_provider: { name: "SpaceX" },
    rocket: { configuration: { full_name: "Falcon 9 Block 5", name: "Falcon 9" } },
    mission: {
      name: "Starlink Group 12-1",
      description: "A batch of satellites; part of the constellation.",
      orbit: { name: "Low Earth Orbit" },
    },
    pad: pad ?? {
      name: "Space Launch Complex 40",
      latitude: 28.56194122,
      longitude: -80.57735736,
      location: { id: 12, name: "Cape Canaveral SFS, FL, USA" },
    },
    vidURLs: [{ url: "https://example.com/watch" }],
    infoURLs: [{ url: "https://example.com/info" }],
    image: { image_url: "https://example.com/rocket.jpg" },
    ...rest,
  };
}

const VANDENBERG_PAD = {
  name: "Space Launch Complex 4E",
  latitude: 34.632,
  longitude: -120.611,
  location: { id: 11, name: "Vandenberg SFB, CA, USA" },
};

const STARBASE_PAD = {
  name: "Orbital Launch Pad 2",
  latitude: 25.99677,
  longitude: -97.15799,
  location: { id: 143, name: "SpaceX Starbase, TX, USA" },
};

function storedFrom(raw, extra = {}) {
  return {
    ...source.normalizeLaunch(raw),
    sequence: 0,
    cancelled: false,
    last_change: null,
    ...extra,
  };
}

// --- Florida filtering ------------------------------------------------------

test("known Florida location ids are accepted", () => {
  assert.equal(source.isFloridaLaunch(rawLaunch()), true);
  assert.equal(
    source.isFloridaLaunch(
      rawLaunch({
        pad: {
          name: "Launch Complex 39A",
          latitude: 28.60822681,
          longitude: -80.60428186,
          location: { id: 27, name: "Kennedy Space Center, FL, USA" },
        },
      })
    ),
    true
  );
});

test("a Florida pad with an unrecognized location id is matched by name", () => {
  const raw = rawLaunch({
    pad: {
      name: "Space Launch Complex 14",
      latitude: null,
      longitude: null,
      location: { id: 9999, name: "Cape Canaveral SFS, FL, USA" },
    },
  });
  assert.equal(source.isFloridaLaunch(raw), true);
});

test("a Florida pad with no location metadata is matched by coordinates", () => {
  const raw = rawLaunch({
    pad: { name: "Unknown Pad", latitude: 28.458, longitude: -80.528, location: null },
  });
  assert.equal(source.isFloridaLaunch(raw), true);
});

test("launches from other states and countries are rejected", () => {
  assert.equal(source.isFloridaLaunch(rawLaunch({ pad: VANDENBERG_PAD })), false);
  assert.equal(source.isFloridaLaunch(rawLaunch({ pad: STARBASE_PAD })), false);
  assert.equal(
    source.isFloridaLaunch(
      rawLaunch({
        pad: {
          name: "Orbital Launch Pad",
          latitude: 69.1084,
          longitude: 15.5895,
          location: { id: 161, name: "Andøya Spaceport" },
        },
      })
    ),
    false
  );
});

// --- normalization ----------------------------------------------------------

test("a minute-precision Florida launch normalizes to a full record", () => {
  const record = source.normalizeLaunch(rawLaunch());
  assert.equal(record.launch_id, "aaaa-1111");
  assert.equal(record.provider, "SpaceX");
  assert.equal(record.rocket, "Falcon 9 Block 5");
  assert.equal(record.mission_name, "Starlink Group 12-1");
  assert.equal(record.orbit, "Low Earth Orbit");
  assert.equal(record.pad_location, "Cape Canaveral SFS, FL, USA");
  assert.equal(record.net, "2026-09-13T18:50:00.000Z");
  assert.equal(record.net_precision, "MIN");
  assert.equal(record.status, "Go");
  assert.equal(record.webcast_url, "https://example.com/watch");
  assert.equal(record.pad_latitude, 28.56194122);
});

test("precisions coarser than a day are not schedulable", () => {
  for (const abbrev of ["M", "Q1", "Q4", "H2", "Y", "FY"]) {
    assert.equal(source.isSchedulable(abbrev), false, `${abbrev} should be rejected`);
    assert.equal(
      source.normalizeLaunch(rawLaunch({ netPrecision: { abbrev, name: abbrev } })),
      null
    );
  }
});

test("second, minute, hour and day precisions are schedulable", () => {
  for (const abbrev of ["SEC", "MIN", "HR", "DAY"]) {
    assert.equal(source.isSchedulable(abbrev), true, `${abbrev} should be accepted`);
  }
  assert.equal(source.isTimedLaunch({ net_precision: "HR" }), true);
  assert.equal(source.isTimedLaunch({ net_precision: "DAY" }), false);
});

test("non-Florida launches never normalize, whatever the precision", () => {
  assert.equal(source.normalizeLaunch(rawLaunch({ pad: VANDENBERG_PAD })), null);
});

test("malformed upstream payloads are dropped rather than thrown on", () => {
  assert.equal(source.normalizeLaunch(null), null);
  assert.equal(source.normalizeLaunch({}), null);
  assert.equal(source.normalizeLaunch(rawLaunch({ net: "not-a-date" })), null);
  assert.equal(source.normalizeLaunch(rawLaunch({ id: null })), null);
});

// --- paging -----------------------------------------------------------------

test("fetchFloridaLaunches pages, re-filters, and sorts by T-0", async () => {
  const pages = [
    {
      next: "page2",
      results: [
        rawLaunch({ id: "b", net: "2026-09-20T10:00:00Z" }),
        // The server-side location filter is a hint; a leaked pad must not pass.
        rawLaunch({ id: "leak", pad: VANDENBERG_PAD }),
        rawLaunch({ id: "a", net: "2026-09-14T10:00:00Z" }),
        rawLaunch({ id: "vague", netPrecision: { abbrev: "Y", name: "Year" } }),
      ],
    },
    { next: null, results: [rawLaunch({ id: "c", net: "2026-10-01T10:00:00Z" })] },
  ];

  let call = 0;
  const fetchImpl = async () => ({
    ok: true,
    json: async () => pages[call++] ?? { next: null, results: [] },
  });

  const result = await source.fetchFloridaLaunches({ pageSize: 4, fetchImpl });
  assert.deepEqual(
    result.launches.map((l) => l.launch_id),
    ["a", "b", "c"]
  );
  // "vague" counts as Florida but is not schedulable; "leak" is not Florida.
  assert.equal(result.floridaSeen, 4);
  assert.equal(result.complete, true);
});

test("a failed page marks the fetch incomplete", async () => {
  const fetchImpl = async () => ({ ok: false, json: async () => ({}) });
  const result = await source.fetchFloridaLaunches({ fetchImpl });
  assert.equal(result.complete, false);
  assert.deepEqual(result.launches, []);
});

// --- diffing ----------------------------------------------------------------

test("a launch seen for the first time starts at sequence 0 with no change note", () => {
  const diff = changes.diffLaunch(undefined, source.normalizeLaunch(rawLaunch()));
  assert.equal(diff.kind, "new");
  assert.equal(diff.row.sequence, 0);
  assert.equal(diff.row.cancelled, false);
  assert.equal(diff.summary, null);
});

test("an unchanged launch keeps its sequence", () => {
  const previous = storedFrom(rawLaunch(), { sequence: 3, last_change: "T-0 moved" });
  const diff = changes.diffLaunch(previous, source.normalizeLaunch(rawLaunch()));
  assert.equal(diff.kind, "unchanged");
  assert.equal(diff.row.sequence, 3);
  assert.equal(diff.row.last_change, "T-0 moved");
});

test("a row read back from Postgres is not mistaken for a reschedule", () => {
  // PostgREST renders timestamptz with a +00:00 offset and drops milliseconds;
  // the API sends Z with them. Same instant, different text.
  const previous = storedFrom(rawLaunch(), {
    sequence: 1,
    net: "2026-09-13T18:50:00+00:00",
    window_start: "2026-09-13T18:50:00+00:00",
    window_end: "2026-09-13T20:27:00+00:00",
  });
  const diff = changes.diffLaunch(previous, source.normalizeLaunch(rawLaunch()));

  assert.equal(diff.kind, "unchanged");
  assert.equal(diff.row.sequence, 1);
});

test("a moved T-0 bumps the sequence and describes the slip", () => {
  const previous = storedFrom(rawLaunch(), { sequence: 2 });
  const next = source.normalizeLaunch(rawLaunch({ net: "2026-09-14T21:15:00Z" }));
  const diff = changes.diffLaunch(previous, next);

  assert.equal(diff.kind, "rescheduled");
  assert.equal(diff.row.sequence, 3);
  assert.match(diff.summary, /^T-0 moved from .+ to .+$/);
  // Summaries are for a human in Florida, so they read in Eastern time.
  assert.match(diff.summary, /EDT/);
  assert.equal(diff.row.last_change, diff.summary);
});

test("a pad change counts as a reschedule", () => {
  const previous = storedFrom(rawLaunch(), { sequence: 0 });
  const next = source.normalizeLaunch(
    rawLaunch({
      pad: {
        name: "Launch Complex 39A",
        latitude: 28.60822681,
        longitude: -80.60428186,
        location: { id: 27, name: "Kennedy Space Center, FL, USA" },
      },
    })
  );
  const diff = changes.diffLaunch(previous, next);
  assert.equal(diff.kind, "rescheduled");
  assert.equal(diff.row.sequence, 1);
  assert.match(diff.summary, /pad moved from Space Launch Complex 40 to Launch Complex 39A/);
});

test("status and weather churn updates the event without re-alerting", () => {
  const previous = storedFrom(rawLaunch(), { sequence: 5 });
  const next = source.normalizeLaunch(
    rawLaunch({ status: { abbrev: "TBC", name: "To Be Confirmed" }, probability: 40 })
  );
  const diff = changes.diffLaunch(previous, next);

  assert.equal(diff.kind, "updated");
  assert.equal(diff.row.sequence, 5);
  assert.equal(diff.row.status, "TBC");
  assert.equal(diff.row.probability, 40);
});

test("a reinstated launch is un-cancelled and re-alerted", () => {
  const previous = storedFrom(rawLaunch(), { sequence: 4, cancelled: true });
  const diff = changes.diffLaunch(previous, source.normalizeLaunch(rawLaunch()));
  assert.equal(diff.kind, "rescheduled");
  assert.equal(diff.row.cancelled, false);
  assert.equal(diff.row.sequence, 5);
  assert.match(diff.summary, /back on the schedule/);
});

// --- scrub detection --------------------------------------------------------

test("an upcoming launch missing from the manifest is cancelled", () => {
  const now = new Date("2026-09-10T00:00:00Z");
  const stored = [storedFrom(rawLaunch(), { sequence: 1 })];
  const scrubs = changes.detectScrubs(stored, new Set(), { now });

  assert.equal(scrubs.length, 1);
  assert.equal(scrubs[0].row.cancelled, true);
  assert.equal(scrubs[0].row.sequence, 2);
  assert.match(scrubs[0].summary, /Dropped from the published launch schedule/);
});

test("a launch that slipped to a vague date is cancelled off the calendar", () => {
  // It's still in the Florida manifest, but no longer normalizes, so it is
  // absent from the schedulable set the sync passes in.
  const now = new Date("2026-09-10T00:00:00Z");
  const stored = [storedFrom(rawLaunch())];
  const scrubs = changes.detectScrubs(stored, new Set(["some-other-launch"]), { now });
  assert.equal(scrubs.length, 1);
});

test("launches that already flew are left alone", () => {
  // Past launches leave the "upcoming" endpoint by launching, not by scrubbing.
  const now = new Date("2026-09-20T00:00:00Z");
  const stored = [storedFrom(rawLaunch())];
  assert.deepEqual(changes.detectScrubs(stored, new Set(), { now }), []);
});

test("an already-cancelled launch is not re-cancelled", () => {
  const now = new Date("2026-09-10T00:00:00Z");
  const stored = [storedFrom(rawLaunch(), { cancelled: true, sequence: 7 })];
  assert.deepEqual(changes.detectScrubs(stored, new Set(), { now }), []);
});

test("launches still on the manifest are not cancelled", () => {
  const now = new Date("2026-09-10T00:00:00Z");
  const stored = [storedFrom(rawLaunch())];
  assert.deepEqual(changes.detectScrubs(stored, new Set(["aaaa-1111"]), { now }), []);
});

// --- iCalendar output -------------------------------------------------------

const NOW = new Date("2026-09-06T12:00:00Z");

function feedFor(launches) {
  return ics.buildLaunchFeed(launches, { now: NOW, domain: "krezzo.com" });
}

test("the feed is a well-formed, CRLF-delimited VCALENDAR", () => {
  const feed = feedFor([storedFrom(rawLaunch())]);
  assert.ok(feed.startsWith("BEGIN:VCALENDAR\r\n"));
  assert.ok(feed.endsWith("END:VCALENDAR\r\n"));
  assert.ok(feed.includes("VERSION:2.0"));
  assert.ok(feed.includes("METHOD:PUBLISH"));
  // A bare \n would break strict parsers.
  assert.equal(feed.replace(/\r\n/g, "").includes("\n"), false);

  const lines = feed.split("\r\n");
  assert.equal(
    lines.filter((l) => l === "BEGIN:VEVENT").length,
    lines.filter((l) => l === "END:VEVENT").length
  );
});

test("no content line exceeds the 75-octet limit", () => {
  const launch = storedFrom(
    rawLaunch({
      mission: {
        name: "A mission with a deliberately overlong name ".repeat(4),
        description: "Description text ".repeat(40),
        orbit: { name: "Low Earth Orbit" },
      },
    })
  );
  for (const line of feedFor([launch]).split("\r\n")) {
    assert.ok(
      Buffer.byteLength(line, "utf8") <= 75,
      `line over 75 octets: ${JSON.stringify(line.slice(0, 90))}`
    );
  }
});

test("folded lines unfold back to the original value", () => {
  const long = `DESCRIPTION:${"x".repeat(300)}`;
  assert.equal(ics.foldLine(long).replace(/\r\n /g, ""), long);
});

test("folding splits on character boundaries, not bytes", () => {
  const line = `SUMMARY:${"é".repeat(80)}`;
  const folded = ics.foldLine(line);
  assert.equal(folded.replace(/\r\n /g, ""), line);
  for (const part of folded.split("\r\n")) {
    assert.ok(Buffer.byteLength(part, "utf8") <= 75);
  }
});

test("text properties escape the reserved characters", () => {
  assert.equal(ics.escapeText("a,b;c\\d\ne"), "a\\,b\\;c\\\\d\\ne");

  const feed = feedFor([
    storedFrom(rawLaunch({ mission: { name: "Comma, semi; slash\\", orbit: null } })),
  ]);
  assert.ok(feed.includes("Comma\\, semi\\; slash\\\\"));
});

test("a timed launch gets a UTC slot, both reminders, and its details", () => {
  const feed = feedFor([storedFrom(rawLaunch())]);
  assert.ok(feed.includes("UID:launch-aaaa-1111@krezzo.com"));
  assert.ok(feed.includes("DTSTART:20260913T185000Z"));
  assert.ok(feed.includes("DTEND:20260913T202700Z"));
  assert.ok(feed.includes("SEQUENCE:0"));
  assert.ok(feed.includes("STATUS:CONFIRMED"));
  assert.ok(feed.includes("TRANSP:OPAQUE"));
  assert.ok(feed.includes("GEO:28.56194122;-80.57735736"));
  assert.ok(feed.includes("TRIGGER:-PT60M"));
  assert.ok(feed.includes("TRIGGER:-PT10M"));
  assert.equal(feed.split("BEGIN:VALARM").length - 1, 2);

  const unfolded = feed.replace(/\r\n /g, "");
  assert.ok(unfolded.includes("Provider: SpaceX"));
  assert.ok(unfolded.includes("Rocket: Falcon 9 Block 5"));
  assert.ok(unfolded.includes("Pad: Space Launch Complex 40\\, Cape Canaveral SFS\\, FL\\, USA"));
  assert.ok(unfolded.includes("Weather: 80% favorable"));
  assert.ok(unfolded.includes("Watch: https://example.com/watch"));
});

test("an oversized launch window is capped rather than blocking out the day", () => {
  const launch = storedFrom(
    rawLaunch({ window_end: "2026-09-14T18:50:00Z" })
  );
  // 24h window, capped to 4h from T-0.
  assert.ok(feedFor([launch]).includes("DTEND:20260913T225000Z"));
});

test("a launch with no usable window gets a one-hour slot", () => {
  const launch = storedFrom(rawLaunch({ window_end: null }));
  assert.ok(feedFor([launch]).includes("DTEND:20260913T195000Z"));
});

test("a day-precision launch becomes a tentative all-day event with no alarms", () => {
  const launch = storedFrom(rawLaunch({ netPrecision: { abbrev: "DAY", name: "Day" } }));
  const feed = feedFor([launch]);

  // 18:50Z on the 13th is 14:50 Eastern, so it stays on the 13th locally.
  assert.ok(feed.includes("DTSTART;VALUE=DATE:20260913"));
  assert.ok(feed.includes("DTEND;VALUE=DATE:20260914"));
  assert.ok(feed.includes("STATUS:TENTATIVE"));
  assert.ok(feed.includes("TRANSP:TRANSPARENT"));
  assert.equal(feed.includes("BEGIN:VALARM"), false);
  assert.ok(feed.replace(/\r\n /g, "").includes("Launch (time TBD):"));
});

test("a midnight-UTC day placeholder keeps its intended calendar day", () => {
  // Upstream parks day-precision launches at exactly 00:00Z as a marker for
  // that calendar day. Reading it as an instant would land the event on the 4th.
  const launch = storedFrom(
    rawLaunch({ net: "2028-07-05T00:00:00Z", netPrecision: { abbrev: "DAY", name: "Day" } })
  );
  const feed = feedFor([launch]);
  assert.ok(feed.includes("DTSTART;VALUE=DATE:20280705"));
  assert.ok(feed.includes("DTEND;VALUE=DATE:20280706"));
  assert.ok(feed.replace(/\r\n /g, "").includes("T-0: Wed\\, Jul 5\\, 2028"));
});

test("an all-day event with a real time of day uses the Florida date", () => {
  // 01:30Z on the 14th is 21:30 Eastern on the 13th.
  const launch = storedFrom(
    rawLaunch({ net: "2026-09-14T01:30:00Z", netPrecision: { abbrev: "DAY", name: "Day" } })
  );
  const feed = feedFor([launch]);
  assert.ok(feed.includes("DTSTART;VALUE=DATE:20260913"));
  assert.ok(feed.includes("DTEND;VALUE=DATE:20260914"));
});

test("an all-day event rolls the month over correctly", () => {
  const launch = storedFrom(
    rawLaunch({ net: "2026-09-30T18:00:00Z", netPrecision: { abbrev: "DAY", name: "Day" } })
  );
  assert.ok(feedFor([launch]).includes("DTEND;VALUE=DATE:20261001"));
});

test("unconfirmed launches are published as tentative", () => {
  const launch = storedFrom(rawLaunch({ status: { abbrev: "TBD", name: "To Be Determined" } }));
  assert.ok(feedFor([launch]).includes("STATUS:TENTATIVE"));
});

test("a scrubbed launch stays in the feed as cancelled, without alarms", () => {
  const launch = storedFrom(rawLaunch(), {
    cancelled: true,
    sequence: 2,
    last_change: "Dropped from the published launch schedule",
  });
  const feed = feedFor([launch]);

  assert.ok(feed.includes("STATUS:CANCELLED"));
  assert.ok(feed.includes("SEQUENCE:2"));
  assert.equal(feed.includes("BEGIN:VALARM"), false);
  assert.ok(
    feed.replace(/\r\n /g, "").includes("This launch is no longer on the published schedule.")
  );
});

test("a reschedule keeps the UID and raises the sequence", () => {
  const before = storedFrom(rawLaunch());
  const diff = changes.diffLaunch(before, source.normalizeLaunch(rawLaunch({ net: "2026-09-15T22:00:00Z" })));
  const after = diff.row;

  assert.equal(
    ics.launchUid(before.launch_id, "krezzo.com"),
    ics.launchUid(after.launch_id, "krezzo.com")
  );

  const feedBefore = feedFor([before]);
  const feedAfter = feedFor([after]);
  assert.ok(feedBefore.includes("SEQUENCE:0"));
  assert.ok(feedBefore.includes("DTSTART:20260913T185000Z"));
  assert.ok(feedAfter.includes("SEQUENCE:1"));
  assert.ok(feedAfter.includes("DTSTART:20260915T220000Z"));
  assert.ok(feedAfter.replace(/\r\n /g, "").includes("Latest change: T-0 moved from"));
});

test("an empty schedule still produces a valid calendar", () => {
  const feed = feedFor([]);
  assert.ok(feed.startsWith("BEGIN:VCALENDAR\r\n"));
  assert.ok(feed.endsWith("END:VCALENDAR\r\n"));
  assert.equal(feed.includes("BEGIN:VEVENT"), false);
});

test("the feed advertises its name, zone, and refresh cadence", () => {
  const feed = feedFor([]);
  assert.ok(feed.includes("X-WR-CALNAME:Florida Rocket Launches"));
  assert.ok(feed.includes("X-WR-TIMEZONE:America/New_York"));
  assert.ok(feed.includes("REFRESH-INTERVAL;VALUE=DURATION:PT1H"));
  assert.ok(feed.includes("X-PUBLISHED-TTL:PT1H"));
});

// --- runner -----------------------------------------------------------------

(async () => {
  let passed = 0;
  const failures = [];

  for (const { name, fn } of tests) {
    try {
      await fn();
      passed++;
    } catch (error) {
      failures.push({ name, error });
    }
  }

  if (failures.length > 0) {
    console.error(`\n${failures.length} failing:\n`);
    for (const { name, error } of failures) {
      console.error(`  x ${name}`);
      console.error(`    ${error.message.split("\n").join("\n    ")}\n`);
    }
    process.exit(1);
  }
  console.log(`launch calendar: ${passed} tests passed`);
})();
