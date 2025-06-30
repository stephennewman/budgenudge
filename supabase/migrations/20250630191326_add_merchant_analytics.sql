-- =====================================================
-- BudgeNudge Merchant Analytics Schema
-- Missing database objects that the application expects
-- =====================================================

-- Create merchant_analytics table to cache spending calculations
CREATE TABLE IF NOT EXISTS merchant_analytics (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  merchant_name TEXT NOT NULL,
  total_transactions INTEGER DEFAULT 0,
  total_spending DECIMAL(12,2) DEFAULT 0,
  spending_transactions INTEGER DEFAULT 0,
  avg_weekly_spending DECIMAL(12,2) DEFAULT 0,
  avg_monthly_spending DECIMAL(12,2) DEFAULT 0,
  avg_weekly_transactions DECIMAL(8,2) DEFAULT 0,
  avg_monthly_transactions DECIMAL(8,2) DEFAULT 0,
  first_transaction_date DATE,
  last_transaction_date DATE,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurring_reason TEXT,
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, merchant_name)
);

-- Enable RLS on merchant_analytics
ALTER TABLE merchant_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policy for merchant_analytics
CREATE POLICY "Users can access their own merchant analytics" ON merchant_analytics
  FOR ALL USING (auth.uid() = user_id);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_merchant_analytics_user_id ON merchant_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_merchant_analytics_total_spending ON merchant_analytics(total_spending DESC);
CREATE INDEX IF NOT EXISTS idx_merchant_analytics_merchant_name ON merchant_analytics(merchant_name);

-- =====================================================
-- Merchant Name Normalization Function
-- =====================================================

CREATE OR REPLACE FUNCTION normalize_merchant_name(raw_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  IF raw_name IS NULL OR trim(raw_name) = '' THEN
    RETURN 'Unknown Merchant';
  END IF;
  
  -- Apply normalization patterns
  raw_name := trim(raw_name);
  
  -- Handle specific merchant patterns
  IF raw_name ~* '^JPM CHASE PAYMENT [0-9]+' THEN
    RETURN 'JPM Chase Payment';
  ELSIF raw_name ~* '^CHASE CREDIT CRD AUTOPAY' THEN
    RETURN 'Chase Credit Card Autopay';
  ELSIF raw_name ~* '^BANK OF AMERICA' THEN
    RETURN 'Bank of America';
  ELSIF raw_name ~* '^CERTIPAY PAYROLL PAYROLL [0-9]+' THEN
    RETURN 'Certipay Payroll';
  ELSIF raw_name ~* '^GCA PAY [0-9]+ [0-9]+' THEN
    RETURN 'GCA Pay';
  ELSIF raw_name ~* '^Check Paid #[0-9]+' THEN
    RETURN 'Check Payment';
  ELSIF raw_name ~* '^Funds Transfer.*-[0-9]+' THEN
    RETURN 'Funds Transfer to Brokerage';
  ELSIF raw_name ~* '^Amazon Prime Video' THEN
    RETURN 'Amazon Prime';
  ELSIF raw_name ~* '^Amazon Prime' THEN
    RETURN 'Amazon Prime';
  ELSIF raw_name ~* '^Cursor Usage Mid' THEN
    RETURN 'Cursor Usage';
  END IF;
  
  -- Remove 6-digit date codes (YYMMDD format)
  raw_name := regexp_replace(raw_name, '[0-9]{6}', '', 'g');
  
  -- Remove transaction IDs like #1234
  raw_name := regexp_replace(raw_name, '#[0-9]+', '', 'g');
  
  -- Clean up extra spaces
  raw_name := regexp_replace(trim(raw_name), '\s+', ' ', 'g');
  
  -- Convert to title case
  raw_name := initcap(lower(raw_name));
  
  -- If normalization resulted in empty string, return original
  IF raw_name = '' OR raw_name = 'Unknown Merchant' THEN
    RETURN coalesce(trim(raw_name), 'Unknown Merchant');
  END IF;
  
  RETURN raw_name;
END;
$$;

-- =====================================================
-- Refresh Merchant Analytics Function
-- =====================================================

CREATE OR REPLACE FUNCTION refresh_merchant_analytics(target_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  merchant_record RECORD;
  updated_count INTEGER := 0;
BEGIN
  -- Delete existing analytics for this user
  DELETE FROM merchant_analytics WHERE user_id = target_user_id;
  
  -- Calculate and insert new analytics for each merchant
  FOR merchant_record IN
    WITH merchant_transactions AS (
      SELECT 
        i.user_id,
        normalize_merchant_name(COALESCE(t.merchant_name, t.name)) as normalized_merchant,
        t.amount,
        t.date,
        CASE WHEN t.amount > 0 THEN 1 ELSE 0 END as is_spending_transaction
      FROM transactions t
      JOIN items i ON t.plaid_item_id = i.plaid_item_id
      WHERE i.user_id = target_user_id
    ),
    merchant_stats AS (
      SELECT
        user_id,
        normalized_merchant,
        COUNT(*) as total_transactions,
        SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_spending,
        SUM(is_spending_transaction) as spending_transactions,
        MIN(date) as first_transaction_date,
        MAX(date) as last_transaction_date
      FROM merchant_transactions
      GROUP BY user_id, normalized_merchant
    )
    SELECT 
      ms.*,
      -- Calculate time-based averages
      CASE 
        WHEN EXTRACT(EPOCH FROM (ms.last_transaction_date - ms.first_transaction_date)) / 604800 > 0 
        THEN ms.total_spending / GREATEST(1, EXTRACT(EPOCH FROM (ms.last_transaction_date - ms.first_transaction_date)) / 604800)
        ELSE ms.total_spending
      END as avg_weekly_spending,
      CASE 
        WHEN EXTRACT(EPOCH FROM (ms.last_transaction_date - ms.first_transaction_date)) / 2629746 > 0 
        THEN ms.total_spending / GREATEST(1, EXTRACT(EPOCH FROM (ms.last_transaction_date - ms.first_transaction_date)) / 2629746)
        ELSE ms.total_spending
      END as avg_monthly_spending,
      CASE 
        WHEN EXTRACT(EPOCH FROM (ms.last_transaction_date - ms.first_transaction_date)) / 604800 > 0 
        THEN ms.total_transactions::DECIMAL / GREATEST(1, EXTRACT(EPOCH FROM (ms.last_transaction_date - ms.first_transaction_date)) / 604800)
        ELSE ms.total_transactions::DECIMAL
      END as avg_weekly_transactions,
      CASE 
        WHEN EXTRACT(EPOCH FROM (ms.last_transaction_date - ms.first_transaction_date)) / 2629746 > 0 
        THEN ms.total_transactions::DECIMAL / GREATEST(1, EXTRACT(EPOCH FROM (ms.last_transaction_date - ms.first_transaction_date)) / 2629746)
        ELSE ms.total_transactions::DECIMAL
      END as avg_monthly_transactions,
      -- Simple recurring detection: more than 2 transactions and regular intervals
      CASE 
        WHEN ms.total_transactions >= 3 AND 
             EXTRACT(EPOCH FROM (ms.last_transaction_date - ms.first_transaction_date)) / ms.total_transactions BETWEEN 604800 AND 2629746
        THEN TRUE
        ELSE FALSE
      END as is_recurring,
      CASE 
        WHEN ms.total_transactions >= 3 AND 
             EXTRACT(EPOCH FROM (ms.last_transaction_date - ms.first_transaction_date)) / ms.total_transactions BETWEEN 604800 AND 2629746
        THEN 'Regular transaction interval detected'
        ELSE 'Irregular or infrequent transactions'
      END as recurring_reason
    FROM merchant_stats ms
  LOOP
    INSERT INTO merchant_analytics (
      user_id,
      merchant_name,
      total_transactions,
      total_spending,
      spending_transactions,
      avg_weekly_spending,
      avg_monthly_spending,
      avg_weekly_transactions,
      avg_monthly_transactions,
      first_transaction_date,
      last_transaction_date,
      is_recurring,
      recurring_reason,
      last_calculated_at
    ) VALUES (
      target_user_id,
      merchant_record.normalized_merchant,
      merchant_record.total_transactions,
      merchant_record.total_spending,
      merchant_record.spending_transactions,
      merchant_record.avg_weekly_spending,
      merchant_record.avg_monthly_spending,
      merchant_record.avg_weekly_transactions,
      merchant_record.avg_monthly_transactions,
      merchant_record.first_transaction_date,
      merchant_record.last_transaction_date,
      merchant_record.is_recurring,
      merchant_record.recurring_reason,
      NOW()
    );
    
    updated_count := updated_count + 1;
  END LOOP;
  
  RETURN updated_count;
END;
$$;

-- =====================================================
-- Auto-refresh trigger for new transactions
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_refresh_merchant_analytics()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  target_user UUID;
BEGIN
  -- Get the user_id for this transaction
  SELECT i.user_id INTO target_user
  FROM items i 
  WHERE i.plaid_item_id = COALESCE(NEW.plaid_item_id, OLD.plaid_item_id);
  
  -- Refresh analytics for this user (async to avoid blocking transaction inserts)
  PERFORM refresh_merchant_analytics(target_user);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger to auto-refresh analytics when transactions change
DROP TRIGGER IF EXISTS auto_refresh_merchant_analytics ON transactions;
CREATE TRIGGER auto_refresh_merchant_analytics
  AFTER INSERT OR UPDATE OR DELETE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_refresh_merchant_analytics();
