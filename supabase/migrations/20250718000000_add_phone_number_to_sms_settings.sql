-- Migration: Add phone_number column to user_sms_settings table
ALTER TABLE user_sms_settings 
ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- Add comment for the new column
COMMENT ON COLUMN user_sms_settings.phone_number IS 'User phone number for SMS delivery'; 