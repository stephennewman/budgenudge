-- Migration: Add phone_number column to user_sms_settings table
ALTER TABLE user_sms_settings 
ADD COLUMN phone_number VARCHAR(20);

-- Add index for phone number lookups
CREATE INDEX IF NOT EXISTS idx_user_sms_settings_phone_number ON user_sms_settings(phone_number);

-- Set phone number for the first user
UPDATE user_sms_settings 
SET phone_number = '+16173472721' 
WHERE user_id = 'bc474c8b-4b47-4c7d-b202-f469330af2a2';

-- Ensure other users have no phone number (blank)
UPDATE user_sms_settings 
SET phone_number = NULL 
WHERE user_id != 'bc474c8b-4b47-4c7d-b202-f469330af2a2';

-- Add comment for documentation
COMMENT ON COLUMN user_sms_settings.phone_number IS 'Phone number for SMS notifications. If NULL/empty, user will not receive SMS.'; 