-- Add minimal enhanced transaction fields
-- These are all optional and won't break existing functionality

-- Merchant visual enhancement
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Location insight (just city for now)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS location_city TEXT;

-- Subscription detection
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_subscription BOOLEAN DEFAULT FALSE;

-- Enhanced categorization (just primary for now)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS pfc_primary TEXT;

-- Create indexes for the new fields to ensure good performance
CREATE INDEX IF NOT EXISTS idx_transactions_location_city ON transactions(location_city) WHERE location_city IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_is_subscription ON transactions(is_subscription) WHERE is_subscription = TRUE;
CREATE INDEX IF NOT EXISTS idx_transactions_pfc_primary ON transactions(pfc_primary) WHERE pfc_primary IS NOT NULL; 