-- Fix unique constraint on tagged_merchants to allow account splitting
-- Drop old constraint and create new one that includes account_identifier

-- Drop the existing unique constraint
ALTER TABLE tagged_merchants 
DROP CONSTRAINT IF EXISTS tagged_merchants_user_id_merchant_name_key;

-- Create new unique constraint that includes account_identifier
-- This allows multiple entries for same merchant with different account_identifier values
ALTER TABLE tagged_merchants 
ADD CONSTRAINT tagged_merchants_user_id_merchant_name_account_key 
UNIQUE (user_id, merchant_name, account_identifier);

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT tagged_merchants_user_id_merchant_name_account_key ON tagged_merchants IS 
'Ensures unique combination of user, merchant name, and account identifier. Allows splitting merchants into multiple accounts.'; 