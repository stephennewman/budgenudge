-- Migration: Remove old 'spending' SMS type constraint and clean up existing records
-- Date: July 21, 2025
-- Purpose: Clean up old hardcoded spending template, replaced by user-controlled merchant-pacing and category-pacing

-- First, delete any existing 'spending' SMS preferences (replaced by new pacing types)
DELETE FROM user_sms_preferences WHERE sms_type = 'spending';

-- Drop the existing CHECK constraint
ALTER TABLE user_sms_preferences 
DROP CONSTRAINT IF EXISTS user_sms_preferences_sms_type_check;

-- Add new CHECK constraint without 'spending' type  
ALTER TABLE user_sms_preferences 
ADD CONSTRAINT user_sms_preferences_sms_type_check 
CHECK (sms_type IN ('bills', 'activity', 'merchant-pacing', 'category-pacing'));

-- Update the comment to reflect the new constraint
COMMENT ON COLUMN user_sms_preferences.sms_type IS 'Type of SMS: bills, activity, merchant-pacing, or category-pacing'; 