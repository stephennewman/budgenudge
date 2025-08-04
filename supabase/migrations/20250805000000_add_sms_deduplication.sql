-- SMS Deduplication System
-- Tracks all SMS sends to prevent duplicates across ALL endpoints

-- Create SMS send tracking table
CREATE TABLE public.sms_send_log (
    id BIGSERIAL PRIMARY KEY,
    phone_number TEXT NOT NULL,
    template_type TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    source_endpoint TEXT NOT NULL, -- 'scheduled', 'test', 'manual', etc.
    message_id TEXT, -- SlickText message ID if available
    success BOOLEAN NOT NULL DEFAULT true
);

-- Add unique constraint for deduplication (separate from table creation)
ALTER TABLE public.sms_send_log 
ADD CONSTRAINT sms_send_log_unique_daily 
UNIQUE(phone_number, template_type, DATE(sent_at AT TIME ZONE 'America/New_York'));

-- Add indexes for performance
CREATE INDEX idx_sms_send_log_phone_template_date 
ON public.sms_send_log (phone_number, template_type, DATE(sent_at AT TIME ZONE 'America/New_York'));

CREATE INDEX idx_sms_send_log_user_date 
ON public.sms_send_log (user_id, DATE(sent_at AT TIME ZONE 'America/New_York'));

CREATE INDEX idx_sms_send_log_sent_at 
ON public.sms_send_log (sent_at);

-- Enable RLS
ALTER TABLE public.sms_send_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own SMS log" ON public.sms_send_log
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage SMS log" ON public.sms_send_log
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Function to check if SMS can be sent (deduplication)
CREATE OR REPLACE FUNCTION public.can_send_sms(
    p_phone_number TEXT,
    p_template_type TEXT,
    p_check_date DATE DEFAULT CURRENT_DATE
) RETURNS BOOLEAN AS $$
BEGIN
    -- Check if this phone+template combination was already sent today
    RETURN NOT EXISTS (
        SELECT 1 FROM public.sms_send_log 
        WHERE phone_number = p_phone_number 
        AND template_type = p_template_type 
        AND DATE(sent_at AT TIME ZONE 'America/New_York') = p_check_date
        AND success = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log SMS send
CREATE OR REPLACE FUNCTION public.log_sms_send(
    p_phone_number TEXT,
    p_template_type TEXT,
    p_user_id UUID,
    p_source_endpoint TEXT,
    p_message_id TEXT DEFAULT NULL,
    p_success BOOLEAN DEFAULT true
) RETURNS BIGINT AS $$
DECLARE
    log_id BIGINT;
BEGIN
    INSERT INTO public.sms_send_log (
        phone_number,
        template_type, 
        user_id,
        source_endpoint,
        message_id,
        success
    ) VALUES (
        p_phone_number,
        p_template_type,
        p_user_id, 
        p_source_endpoint,
        p_message_id,
        p_success
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT SELECT, INSERT ON public.sms_send_log TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_send_sms TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_sms_send TO authenticated;