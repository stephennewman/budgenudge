-- Create scheduled SMS messages table
CREATE TABLE IF NOT EXISTS scheduled_sms (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  message TEXT NOT NULL,
  scheduled_time TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_scheduled_sms_user_id ON scheduled_sms(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_sms_status ON scheduled_sms(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_sms_scheduled_time ON scheduled_sms(scheduled_time);

-- Enable RLS
ALTER TABLE scheduled_sms ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own scheduled messages
CREATE POLICY "Users can access their own scheduled SMS" ON scheduled_sms
  FOR ALL USING (auth.uid() = user_id); 