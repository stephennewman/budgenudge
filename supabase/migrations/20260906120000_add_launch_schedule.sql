-- Migration: Florida rocket launch schedule mirrored from the Launch Library 2 API.
--
-- One row per launch. The launch_id is the upstream UUID, which is stable for
-- the life of a launch, so it doubles as the iCalendar UID: subscribers update
-- the event they already have instead of getting a duplicate when a date slips.
CREATE TABLE IF NOT EXISTS launch_schedule (
  launch_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT,
  provider TEXT,
  rocket TEXT,
  mission_name TEXT,
  mission_description TEXT,
  orbit TEXT,
  pad_name TEXT,
  pad_location TEXT NOT NULL,
  pad_latitude DOUBLE PRECISION,
  pad_longitude DOUBLE PRECISION,

  -- Scheduled T-0 and how much of it to trust. net_precision is the upstream
  -- abbreviation: SEC/MIN/HR get a timed event, DAY gets an all-day event, and
  -- anything coarser (M, Q1-Q4, H1/H2, Y, FY) never reaches this table.
  net TIMESTAMPTZ NOT NULL,
  net_precision TEXT NOT NULL,
  window_start TIMESTAMPTZ,
  window_end TIMESTAMPTZ,

  status TEXT,
  status_name TEXT,
  probability INTEGER,

  webcast_url TEXT,
  info_url TEXT,
  image_url TEXT,

  -- Calendar bookkeeping. sequence is the iCalendar SEQUENCE: bumped only on a
  -- real schedule change (T-0 moved, pad moved, launch dropped) so clients know
  -- to re-notify. cancelled marks launches that vanished upstream or slipped to
  -- a date too vague to schedule; they stay here and are published as
  -- STATUS:CANCELLED so subscribers clear them.
  sequence INTEGER NOT NULL DEFAULT 0,
  cancelled BOOLEAN NOT NULL DEFAULT FALSE,
  last_change TEXT,

  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The feed reads upcoming-first; the sync reads the same window to find scrubs.
CREATE INDEX IF NOT EXISTS idx_launch_schedule_net ON launch_schedule(net);

ALTER TABLE launch_schedule ENABLE ROW LEVEL SECURITY;

-- Only the sync cron and the feed route touch this table, both via service role.
DROP POLICY IF EXISTS "Allow service role access" ON launch_schedule;
CREATE POLICY "Allow service role access" ON launch_schedule
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE launch_schedule IS 'Florida (Cape Canaveral SFS / Kennedy Space Center) launches mirrored from Launch Library 2 and published as an iCalendar feed';
COMMENT ON COLUMN launch_schedule.launch_id IS 'Upstream Launch Library 2 UUID; also the stable iCalendar UID';
COMMENT ON COLUMN launch_schedule.net IS 'No Earlier Than: the scheduled T-0';
COMMENT ON COLUMN launch_schedule.net_precision IS 'Upstream precision abbreviation: SEC, MIN, HR (timed event) or DAY (all-day event)';
COMMENT ON COLUMN launch_schedule.sequence IS 'iCalendar SEQUENCE, incremented when T-0, pad, or cancellation changes';
COMMENT ON COLUMN launch_schedule.cancelled IS 'Launch left the upstream schedule or slipped to a date too vague to calendar';
COMMENT ON COLUMN launch_schedule.last_change IS 'Human-readable summary of the most recent schedule change';
