-- Create verification_codes table for SMS verification
CREATE TABLE verification_codes (
  id SERIAL PRIMARY KEY,
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  code VARCHAR(10) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create sample_sms_leads table for lead tracking
CREATE TABLE sample_sms_leads (
  id SERIAL PRIMARY KEY,
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  source VARCHAR(50) DEFAULT 'sample_sms_demo',
  opted_in_at TIMESTAMPTZ NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  sample_sent BOOLEAN DEFAULT FALSE,
  converted_to_signup BOOLEAN DEFAULT FALSE,
  conversion_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_verification_codes_phone ON verification_codes(phone_number);
CREATE INDEX idx_verification_codes_expires ON verification_codes(expires_at);
CREATE INDEX idx_sample_sms_leads_phone ON sample_sms_leads(phone_number);
CREATE INDEX idx_sample_sms_leads_source ON sample_sms_leads(source);
CREATE INDEX idx_sample_sms_leads_created ON sample_sms_leads(created_at);

-- Add RLS policies (admin-only access for these tables)
ALTER TABLE verification_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sample_sms_leads ENABLE ROW LEVEL SECURITY;

-- Service role can access all records
CREATE POLICY "Service role can manage verification codes" ON verification_codes
  FOR ALL USING (true);

CREATE POLICY "Service role can manage sample SMS leads" ON sample_sms_leads
  FOR ALL USING (true);

-- Create function to clean up expired verification codes
CREATE OR REPLACE FUNCTION cleanup_expired_verification_codes()
RETURNS void AS $$
BEGIN
  DELETE FROM verification_codes WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Add comment for documentation
COMMENT ON TABLE verification_codes IS 'Stores temporary verification codes for sample SMS demo';
COMMENT ON TABLE sample_sms_leads IS 'Tracks leads generated through sample SMS demo feature';