-- Create SMS preferences table for user subscriptions
CREATE TABLE user_sms_preferences (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  sms_type VARCHAR(20) NOT NULL CHECK (sms_type IN ('bills', 'spending', 'activity')),
  enabled BOOLEAN DEFAULT true,
  frequency VARCHAR(20) DEFAULT 'daily' CHECK (frequency IN ('30min', 'hourly', 'daily', 'weekly')),
  phone_number VARCHAR(20), -- Override default phone if needed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, sms_type)
);

-- Add indexes for performance
CREATE INDEX idx_user_sms_preferences_user_id ON user_sms_preferences(user_id);
CREATE INDEX idx_user_sms_preferences_enabled ON user_sms_preferences(enabled);
CREATE INDEX idx_user_sms_preferences_frequency ON user_sms_preferences(frequency);

-- Add RLS policies
ALTER TABLE user_sms_preferences ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own SMS preferences
CREATE POLICY "Users can view their own SMS preferences" ON user_sms_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own SMS preferences" ON user_sms_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own SMS preferences" ON user_sms_preferences
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own SMS preferences" ON user_sms_preferences
  FOR DELETE USING (auth.uid() = user_id);

-- Create default SMS preferences for existing users
INSERT INTO user_sms_preferences (user_id, sms_type, enabled, frequency)
SELECT 
  items.user_id,
  sms_type,
  true,
  'daily'
FROM items
CROSS JOIN (
  SELECT 'bills' as sms_type
  UNION SELECT 'spending' as sms_type
  UNION SELECT 'activity' as sms_type
) sms_types
WHERE items.user_id IS NOT NULL
ON CONFLICT (user_id, sms_type) DO NOTHING;

-- Add comment for documentation
COMMENT ON TABLE user_sms_preferences IS 'Stores user preferences for different types of SMS notifications';
COMMENT ON COLUMN user_sms_preferences.sms_type IS 'Type of SMS: bills, spending, or activity';
COMMENT ON COLUMN user_sms_preferences.enabled IS 'Whether this SMS type is enabled for the user';
COMMENT ON COLUMN user_sms_preferences.frequency IS 'How often to send this SMS type: 30min, hourly, daily, or weekly';
COMMENT ON COLUMN user_sms_preferences.phone_number IS 'Optional phone number override for this SMS type'; 