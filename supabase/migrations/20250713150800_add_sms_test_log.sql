-- Create table for SMS test logging
CREATE TABLE IF NOT EXISTS sms_test_log (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID,
  phone_number TEXT NOT NULL,
  message_length INTEGER NOT NULL,
  success BOOLEAN NOT NULL DEFAULT FALSE,
  error TEXT,
  duration_ms INTEGER,
  message_preview TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add index for efficient querying
CREATE INDEX IF NOT EXISTS idx_sms_test_log_timestamp ON sms_test_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_sms_test_log_success ON sms_test_log(success);
CREATE INDEX IF NOT EXISTS idx_sms_test_log_user_id ON sms_test_log(user_id);

-- Add RLS policy
ALTER TABLE sms_test_log ENABLE ROW LEVEL SECURITY;

-- Allow service role to insert/select (for the API)
CREATE POLICY "Allow service role access" ON sms_test_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to view their own test logs
CREATE POLICY "Users can view their own test logs" ON sms_test_log
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE sms_test_log IS 'Logs for test SMS messages sent during development and troubleshooting';
COMMENT ON COLUMN sms_test_log.timestamp IS 'When the test SMS was initiated';
COMMENT ON COLUMN sms_test_log.message_length IS 'Length of the SMS message in characters';
COMMENT ON COLUMN sms_test_log.success IS 'Whether the SMS was sent successfully';
COMMENT ON COLUMN sms_test_log.duration_ms IS 'How long the SMS sending process took in milliseconds';
COMMENT ON COLUMN sms_test_log.message_preview IS 'First 200 characters of the SMS for debugging'; 