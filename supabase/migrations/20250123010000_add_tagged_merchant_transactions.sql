-- Create table to link specific transactions to tagged merchants
-- This enables split merchants to show only their grouped transactions

CREATE TABLE tagged_merchant_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tagged_merchant_id INTEGER REFERENCES tagged_merchants(id) ON DELETE CASCADE,
  transaction_id TEXT NOT NULL, -- plaid_transaction_id from transactions table
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique transaction-merchant relationships
  UNIQUE(tagged_merchant_id, transaction_id)
);

-- Add indexes for performance
CREATE INDEX idx_tagged_merchant_transactions_merchant_id 
ON tagged_merchant_transactions(tagged_merchant_id);

CREATE INDEX idx_tagged_merchant_transactions_user_id 
ON tagged_merchant_transactions(user_id);

CREATE INDEX idx_tagged_merchant_transactions_transaction_id 
ON tagged_merchant_transactions(transaction_id);

-- Enable RLS
ALTER TABLE tagged_merchant_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own transaction relationships
CREATE POLICY "Users can manage their own tagged merchant transactions"
ON tagged_merchant_transactions FOR ALL 
USING (auth.uid() = user_id);

-- Add comment for documentation
COMMENT ON TABLE tagged_merchant_transactions IS 
'Links specific transactions to tagged merchants. Used for split accounts to show only grouped transactions.';
COMMENT ON COLUMN tagged_merchant_transactions.transaction_id IS 
'References plaid_transaction_id from transactions table'; 