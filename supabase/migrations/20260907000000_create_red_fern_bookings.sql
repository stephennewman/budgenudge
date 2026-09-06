-- Migration: Red Fern Plantation bookings.
--
-- One row per reservation: tours, hunts, weddings, retreats and lodge stays all
-- share a shape, because they all answer the same questions — what, when, for
-- how many, for how long, and who is coming. The offering itself (rate card,
-- season, which part of the property it ties up) is code, not data, so a rate
-- change never has to be migrated.
--
-- The `reference` is the confirmation code the guest is given and also the
-- stable iCalendar UID, so re-sending an invite updates the event a guest
-- already has instead of adding a second one.
CREATE TABLE IF NOT EXISTS red_fern_bookings (
  reference TEXT PRIMARY KEY,

  -- Matches an id in utils/red-fern/catalog.ts.
  experience_id TEXT NOT NULL,

  -- Local dates and times at the venue (Eastern). A Saturday wedding is a
  -- Saturday wedding wherever the guest booked it from; the conversion to an
  -- instant happens once, on the way into an iCalendar file.
  start_date DATE NOT NULL,
  days INTEGER NOT NULL DEFAULT 1,
  slot_id TEXT NOT NULL,
  start_time TEXT NOT NULL,
  hours NUMERIC NOT NULL DEFAULT 1,

  party_size INTEGER NOT NULL,
  add_on_ids TEXT[] NOT NULL DEFAULT '{}',

  guest_name TEXT NOT NULL,
  guest_email TEXT NOT NULL,
  guest_phone TEXT,
  notes TEXT,

  -- requested: date held, deposit not in hand yet.
  -- confirmed: paid or free (a tour costs nothing, so it confirms itself).
  -- hold: penciled in by the family. cancelled: released, kept for the record.
  status TEXT NOT NULL DEFAULT 'requested',

  total NUMERIC NOT NULL DEFAULT 0,
  deposit_due NUMERIC NOT NULL DEFAULT 0,

  -- iCalendar SEQUENCE, bumped when a booking is moved so a re-sent invite
  -- replaces the guest's existing event.
  sequence INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Availability checks and the private schedule both read forward from today.
CREATE INDEX IF NOT EXISTS idx_red_fern_bookings_start_date ON red_fern_bookings(start_date);
CREATE INDEX IF NOT EXISTS idx_red_fern_bookings_status ON red_fern_bookings(status);

ALTER TABLE red_fern_bookings ENABLE ROW LEVEL SECURITY;

-- Guest contact details and the private schedule are never read from the
-- browser: the booking API and the schedule page both use the service role.
DROP POLICY IF EXISTS "Allow service role access" ON red_fern_bookings;
CREATE POLICY "Allow service role access" ON red_fern_bookings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE red_fern_bookings IS 'Reservations at Red Fern Plantation: tours, hunts, events and lodge stays';
COMMENT ON COLUMN red_fern_bookings.reference IS 'Guest-facing confirmation code; also the stable iCalendar UID';
COMMENT ON COLUMN red_fern_bookings.experience_id IS 'Offering id from utils/red-fern/catalog.ts';
COMMENT ON COLUMN red_fern_bookings.start_date IS 'First local date at the venue (America/New_York)';
COMMENT ON COLUMN red_fern_bookings.days IS 'Calendar days covered, or nights for a lodge stay';
COMMENT ON COLUMN red_fern_bookings.sequence IS 'iCalendar SEQUENCE, incremented when the booking is rescheduled';
