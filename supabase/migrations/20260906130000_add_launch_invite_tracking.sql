-- Migration: track which launch invites have been emailed, and at what version.
--
-- invited_sequence records the iCalendar SEQUENCE that was last delivered. A
-- row whose sequence has since moved needs a fresh invite (same UID, higher
-- SEQUENCE, which updates the recipient's existing event); a row that has
-- never been invited is null. Without this the hourly sync would re-send the
-- same invite every hour.
ALTER TABLE launch_schedule
  ADD COLUMN IF NOT EXISTS invited_sequence INTEGER,
  ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ;

COMMENT ON COLUMN launch_schedule.invited_sequence IS 'iCalendar SEQUENCE of the most recently emailed invite; null when never invited';
COMMENT ON COLUMN launch_schedule.invited_at IS 'When the most recent invite for this launch was emailed';
