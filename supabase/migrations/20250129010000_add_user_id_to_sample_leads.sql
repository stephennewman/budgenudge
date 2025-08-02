-- Add user_id field to sample_sms_leads to track conversions
ALTER TABLE sample_sms_leads 
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add index for performance
CREATE INDEX idx_sample_sms_leads_user_id ON sample_sms_leads(user_id);

-- Add comment for documentation
COMMENT ON COLUMN sample_sms_leads.user_id IS 'User ID when lead converts to full signup';