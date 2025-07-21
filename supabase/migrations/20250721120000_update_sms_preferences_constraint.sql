-- Migration: Update user_sms_preferences CHECK constraint to include merchant-pacing
-- Date: July 21, 2025
-- Purpose: Allow merchant-pacing SMS type in user preferences

-- Drop the existing CHECK constraint
ALTER TABLE user_sms_preferences 
DROP CONSTRAINT IF EXISTS user_sms_preferences_sms_type_check;

-- Add new CHECK constraint that includes merchant-pacing
ALTER TABLE user_sms_preferences 
ADD CONSTRAINT user_sms_preferences_sms_type_check 
CHECK (sms_type IN ('bills', 'spending', 'activity', 'merchant-pacing'));

-- Update the comment to reflect the new constraint
COMMENT ON COLUMN user_sms_preferences.sms_type IS 'Type of SMS: bills, spending, activity, or merchant-pacing'; 