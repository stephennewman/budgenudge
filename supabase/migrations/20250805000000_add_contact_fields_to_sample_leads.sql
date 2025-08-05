-- Add contact fields to sample_sms_leads table for SlickText form integration
-- This migration adds email, first_name, and last_name columns to support complete contact capture

-- Add the missing contact fields (use IF NOT EXISTS to avoid errors if already exists)
ALTER TABLE sample_sms_leads 
ADD COLUMN IF NOT EXISTS email VARCHAR(255),
ADD COLUMN IF NOT EXISTS first_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);

-- Add indexes for performance
CREATE INDEX idx_sample_sms_leads_email ON sample_sms_leads(email);
CREATE INDEX idx_sample_sms_leads_first_name ON sample_sms_leads(first_name);
CREATE INDEX idx_sample_sms_leads_last_name ON sample_sms_leads(last_name);

-- Update the unique constraint to allow multiple submissions with same phone but different email
-- This handles cases where forms submit multiple times during testing
DROP INDEX IF EXISTS sample_sms_leads_phone_number_key;
ALTER TABLE sample_sms_leads DROP CONSTRAINT IF EXISTS sample_sms_leads_phone_number_key;

-- Create a composite unique constraint instead
CREATE UNIQUE INDEX idx_sample_sms_leads_unique_phone_source 
ON sample_sms_leads(phone_number, source, COALESCE(email, ''));

-- Add comments for documentation
COMMENT ON COLUMN sample_sms_leads.email IS 'Email address captured from SlickText form submissions';
COMMENT ON COLUMN sample_sms_leads.first_name IS 'First name captured from SlickText form submissions';
COMMENT ON COLUMN sample_sms_leads.last_name IS 'Last name captured from SlickText form submissions';