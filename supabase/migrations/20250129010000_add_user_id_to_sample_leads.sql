-- Add user_id and tracking_token fields to sample_sms_leads
ALTER TABLE sample_sms_leads 
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
ADD COLUMN tracking_token UUID UNIQUE;

-- Add indexes for performance
CREATE INDEX idx_sample_sms_leads_user_id ON sample_sms_leads(user_id);
CREATE INDEX idx_sample_sms_leads_tracking_token ON sample_sms_leads(tracking_token);

-- Add comments for documentation
COMMENT ON COLUMN sample_sms_leads.user_id IS 'User ID when lead converts to full signup';
COMMENT ON COLUMN sample_sms_leads.tracking_token IS 'Browser tracking token to match leads without phone number entry';