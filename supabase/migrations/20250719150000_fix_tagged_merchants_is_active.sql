-- =====================================================
-- Fix tagged_merchants is_active column
-- Ensures all starred merchants appear in recurring bills
-- =====================================================

-- Set default value for is_active column to true
ALTER TABLE tagged_merchants 
ALTER COLUMN is_active SET DEFAULT true;

-- Update existing records with null is_active to true
UPDATE tagged_merchants 
SET is_active = true 
WHERE is_active IS NULL;

-- Ensure is_active column is not null going forward
ALTER TABLE tagged_merchants 
ALTER COLUMN is_active SET NOT NULL;

-- Add comment to document the fix
COMMENT ON COLUMN tagged_merchants.is_active IS 'Controls whether merchant appears in recurring bills. Default true for starred transactions.'; 