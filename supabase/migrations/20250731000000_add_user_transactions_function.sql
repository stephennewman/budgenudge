-- Migration: Add stored function to efficiently fetch user transactions
-- This solves the 414 Request-URI Too Large error by moving the join logic to the database

-- Create function to get all transactions for a user
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
  INNER JOIN items i ON t.plaid_item_id = i.plaid_item_id
  WHERE i.user_id = user_uuid
  ORDER BY t.date DESC;
$$;

-- Create function to get all accounts for a user
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
  WHERE i.user_id = user_uuid;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_user_transactions(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_accounts(UUID) TO authenticated;

-- Add comments for documentation
COMMENT ON FUNCTION get_user_transactions(UUID) IS 'Efficiently fetches all transactions for a user by joining with items table';
COMMENT ON FUNCTION get_user_accounts(UUID) IS 'Efficiently fetches all accounts for a user by joining with items table';