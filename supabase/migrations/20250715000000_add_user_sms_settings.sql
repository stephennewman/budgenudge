-- Migration: Add user_sms_settings table for unified SMS send time
CREATE TABLE IF NOT EXISTS user_sms_settings (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  send_time TIME NOT NULL DEFAULT '18:00', -- 6:00 PM
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookup
CREATE INDEX IF NOT EXISTS idx_user_sms_settings_user_id ON user_sms_settings(user_id);

-- RLS: Only allow users to access their own settings
ALTER TABLE user_sms_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own SMS settings" ON user_sms_settings
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own SMS settings" ON user_sms_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own SMS settings" ON user_sms_settings
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own SMS settings" ON user_sms_settings
  FOR DELETE USING (auth.uid() = user_id);

COMMENT ON TABLE user_sms_settings IS 'Stores unified SMS send time for each user';
COMMENT ON COLUMN user_sms_settings.send_time IS 'Preferred time of day (EST) to send all SMS templates'; 