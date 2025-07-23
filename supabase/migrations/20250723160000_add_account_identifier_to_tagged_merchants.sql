-- Add account_identifier column to tagged_merchants for account splitting
-- This allows users to split merchants like T-Mobile into separate accounts
-- e.g., T-Mobile 1, T-Mobile 2, or T-Mobile (Wife), T-Mobile (Husband)

ALTER TABLE tagged_merchants 
ADD COLUMN account_identifier TEXT DEFAULT NULL;

-- Add index for better query performance when filtering by account identifier
CREATE INDEX IF NOT EXISTS idx_tagged_merchants_account_identifier 
ON tagged_merchants(user_id, ai_merchant_name, account_identifier);

-- Add comment explaining the column
COMMENT ON COLUMN tagged_merchants.account_identifier IS 
'Optional identifier for split accounts. NULL for original/unsplit accounts, "1"/"2"/etc for numbered splits, or custom names like "Wife"/"Husband" for renamed accounts.'; 