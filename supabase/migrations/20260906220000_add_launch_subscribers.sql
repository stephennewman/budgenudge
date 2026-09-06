-- Email subscribers for Florida launch calendar invites.
-- Each address is emailed current upcoming launches on subscribe, then any
-- later launch that gets a date/time (or a slip/scrub of one they already hold).

CREATE TABLE IF NOT EXISTS launch_subscribers (
  email TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS launch_invite_receipts (
  email TEXT NOT NULL REFERENCES launch_subscribers(email) ON DELETE CASCADE,
  launch_id TEXT NOT NULL REFERENCES launch_schedule(launch_id) ON DELETE CASCADE,
  invited_sequence INTEGER NOT NULL,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (email, launch_id)
);

CREATE INDEX IF NOT EXISTS idx_launch_invite_receipts_launch
  ON launch_invite_receipts(launch_id);

ALTER TABLE launch_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE launch_invite_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow service role access" ON launch_subscribers;
CREATE POLICY "Allow service role access" ON launch_subscribers
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service role access" ON launch_invite_receipts;
CREATE POLICY "Allow service role access" ON launch_invite_receipts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Keep the inbox that already received the first two invites on the list,
-- and mark those sends so the hourly job does not duplicate them.
INSERT INTO launch_subscribers (email)
VALUES ('stephen.p.newman@gmail.com')
ON CONFLICT (email) DO NOTHING;

INSERT INTO launch_invite_receipts (email, launch_id, invited_sequence, invited_at)
SELECT
  'stephen.p.newman@gmail.com',
  launch_id,
  invited_sequence,
  COALESCE(invited_at, NOW())
FROM launch_schedule
WHERE invited_sequence IS NOT NULL
ON CONFLICT (email, launch_id) DO NOTHING;
