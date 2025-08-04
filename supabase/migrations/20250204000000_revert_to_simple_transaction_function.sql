-- Migration: Revert to simple stored function for reliable transaction fetching
-- This fixes missing recent transactions by eliminating complex account joins

-- Revert get_user_transactions to simple, reliable version
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
    AND COALESCE(i.deleted_at, 'infinity'::timestamptz) = 'infinity'::timestamptz  -- Exclude soft-deleted items
  ORDER BY t.date DESC;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_user_transactions(UUID) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION get_user_transactions(UUID) IS 'Simple, reliable function to fetch all user transactions via direct item join (reverted from complex account joins for better reliability)';