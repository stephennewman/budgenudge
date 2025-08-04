-- Add account-level disconnection support
-- Minimal, conflict-free migration to enable individual account removal

-- Add deleted_at column to accounts table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'accounts' AND column_name = 'deleted_at') THEN
        ALTER TABLE accounts ADD COLUMN deleted_at TIMESTAMPTZ;
        CREATE INDEX idx_accounts_deleted_at ON accounts(deleted_at) WHERE deleted_at IS NOT NULL;
    END IF;
END $$;

-- Update get_user_accounts function to filter out both soft-deleted items AND accounts
CREATE OR REPLACE FUNCTION get_user_accounts(user_uuid UUID)
RETURNS TABLE (
  id INTEGER,
  item_id INTEGER,
  plaid_account_id TEXT,
  name TEXT,
  official_name TEXT,
  type TEXT,
  subtype TEXT,
  mask TEXT,
  verification_status TEXT,
  current_balance DECIMAL(12,2),
  available_balance DECIMAL(12,2),
  iso_currency_code TEXT,
  balance_last_updated TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    a.id,
    a.item_id,
    a.plaid_account_id,
    a.name,
    a.official_name,
    a.type,
    a.subtype,
    a.mask,
    a.verification_status,
    a.current_balance,
    a.available_balance,
    a.iso_currency_code,
    a.balance_last_updated,
    a.created_at,
    a.updated_at
  FROM accounts a
  INNER JOIN items i ON a.item_id = i.id
  WHERE i.user_id = user_uuid
    AND COALESCE(i.deleted_at, 'infinity'::timestamptz) = 'infinity'::timestamptz    -- Exclude soft-deleted items
    AND COALESCE(a.deleted_at, 'infinity'::timestamptz) = 'infinity'::timestamptz;   -- Exclude soft-deleted accounts
$$;

-- Update get_user_transactions function to filter out transactions from soft-deleted accounts
CREATE OR REPLACE FUNCTION get_user_transactions(user_uuid UUID)
RETURNS TABLE (
  id INTEGER,
  plaid_transaction_id TEXT,
  plaid_item_id TEXT,
  account_id TEXT,
  amount DECIMAL(10,2),
  date DATE,
  name TEXT,
  merchant_name TEXT,
  category TEXT[],
  subcategory TEXT,
  transaction_type TEXT,
  pending BOOLEAN,
  account_owner TEXT,
  ai_merchant_name TEXT,
  ai_category_tag TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    t.id,
    t.plaid_transaction_id,
    t.plaid_item_id,
    t.account_id,
    t.amount,
    t.date,
    t.name,
    t.merchant_name,
    t.category,
    t.subcategory,
    t.transaction_type,
    t.pending,
    t.account_owner,
    t.ai_merchant_name,
    t.ai_category_tag,
    t.created_at,
    t.updated_at
  FROM transactions t
  INNER JOIN accounts a ON t.account_id = a.plaid_account_id
  INNER JOIN items i ON a.item_id = i.id
  WHERE i.user_id = user_uuid
    AND COALESCE(i.deleted_at, 'infinity'::timestamptz) = 'infinity'::timestamptz    -- Exclude transactions from soft-deleted items
    AND COALESCE(a.deleted_at, 'infinity'::timestamptz) = 'infinity'::timestamptz;   -- Exclude transactions from soft-deleted accounts
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_user_accounts(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_transactions(UUID) TO authenticated;

-- Add comment for documentation
COMMENT ON COLUMN accounts.deleted_at IS 'Timestamp when account was soft-deleted/disconnected by user. NULL means active account.';