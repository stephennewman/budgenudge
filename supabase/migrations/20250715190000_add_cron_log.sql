-- Migration: Add persistent cron_log table for scheduled SMS jobs
CREATE TABLE IF NOT EXISTS cron_log (
  id BIGSERIAL PRIMARY KEY,
  job_name TEXT NOT NULL, -- e.g. 'scheduled-sms'
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'success', 'error')),
  error_message TEXT,
  users_processed INTEGER,
  sms_attempted INTEGER,
  sms_sent INTEGER,
  sms_failed INTEGER,
  log_details JSONB, -- Optional: store per-user or per-SMS details
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for recent jobs
CREATE INDEX IF NOT EXISTS idx_cron_log_started_at ON cron_log(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_cron_log_job_name ON cron_log(job_name);

-- Enable RLS (optional, for now allow service role only)
ALTER TABLE cron_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow service role access" ON cron_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE cron_log IS 'Persistent log of each cron job invocation (e.g. scheduled-sms)';
COMMENT ON COLUMN cron_log.job_name IS 'Name of the cron job (e.g. scheduled-sms)';
COMMENT ON COLUMN cron_log.started_at IS 'When the cron job started';
COMMENT ON COLUMN cron_log.finished_at IS 'When the cron job finished';
COMMENT ON COLUMN cron_log.status IS 'Job status: started, success, or error';
COMMENT ON COLUMN cron_log.error_message IS 'Error message if job failed';
COMMENT ON COLUMN cron_log.users_processed IS 'Number of users processed in this run';
COMMENT ON COLUMN cron_log.sms_attempted IS 'Total SMS attempted to send';
COMMENT ON COLUMN cron_log.sms_sent IS 'Total SMS sent successfully';
COMMENT ON COLUMN cron_log.sms_failed IS 'Total SMS failed to send';
COMMENT ON COLUMN cron_log.log_details IS 'Optional JSON details for debugging'; 