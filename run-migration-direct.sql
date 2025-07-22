-- Enhanced Plaid Data Migration
-- Add 4 high-value optional fields to transactions table
-- This is 100% safe - all columns are optional and won't break existing functionality

BEGIN;

-- Add enhanced transaction fields (all optional)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS location_city TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_subscription BOOLEAN DEFAULT FALSE;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS pfc_primary TEXT;

-- Create performance indexes (only where data exists)
CREATE INDEX IF NOT EXISTS idx_transactions_location_city ON transactions(location_city) WHERE location_city IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_is_subscription ON transactions(is_subscription) WHERE is_subscription = TRUE;
CREATE INDEX IF NOT EXISTS idx_transactions_pfc_primary ON transactions(pfc_primary) WHERE pfc_primary IS NOT NULL;

COMMIT;

-- Test the migration worked
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'transactions' 
  AND column_name IN ('logo_url', 'location_city', 'is_subscription', 'pfc_primary')
ORDER BY column_name; 