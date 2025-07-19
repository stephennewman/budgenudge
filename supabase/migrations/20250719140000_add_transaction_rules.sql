-- =====================================================
-- BudgeNudge Transaction Rules Engine
-- Rules for merchant normalization and category overrides
-- =====================================================

-- Transaction rules table for user-defined rules
CREATE TABLE IF NOT EXISTS transaction_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('merchant_normalize', 'category_override', 'combined')),
  
  -- Pattern matching configuration
  pattern_type TEXT NOT NULL CHECK (pattern_type IN ('exact', 'contains', 'starts_with', 'ends_with', 'regex')),
  pattern_value TEXT NOT NULL,
  
  -- Rule actions
  normalized_merchant_name TEXT, -- For merchant normalization
  override_category TEXT,        -- For category overrides
  
  -- Rule metadata
  priority INTEGER DEFAULT 100,  -- Higher number = higher priority
  is_active BOOLEAN DEFAULT true,
  auto_generated BOOLEAN DEFAULT false, -- System vs user-created rules
  description TEXT,              -- User-friendly description
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, rule_name)
);

-- Rule execution log for debugging and analytics
CREATE TABLE IF NOT EXISTS rule_execution_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES transaction_rules(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_id TEXT, -- plaid_transaction_id
  original_merchant TEXT,
  original_category TEXT,
  applied_merchant TEXT,
  applied_category TEXT,
  rule_name TEXT, -- Store rule name in case rule gets deleted
  executed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on transaction_rules
ALTER TABLE transaction_rules ENABLE ROW LEVEL SECURITY;

-- Enable RLS on rule_execution_log  
ALTER TABLE rule_execution_log ENABLE ROW LEVEL SECURITY;

-- RLS Policy for transaction_rules
CREATE POLICY "Users can manage their own transaction rules" ON transaction_rules
  FOR ALL USING (auth.uid() = user_id);

-- RLS Policy for rule_execution_log
CREATE POLICY "Users can view their own rule execution logs" ON rule_execution_log
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert rule execution logs" ON rule_execution_log
  FOR INSERT WITH CHECK (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_transaction_rules_user_id ON transaction_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_transaction_rules_priority ON transaction_rules(priority DESC);
CREATE INDEX IF NOT EXISTS idx_transaction_rules_active ON transaction_rules(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_rule_execution_log_user_id ON rule_execution_log(user_id);
CREATE INDEX IF NOT EXISTS idx_rule_execution_log_rule_id ON rule_execution_log(rule_id);

-- =====================================================
-- Enhanced Rule Engine Function
-- =====================================================

CREATE OR REPLACE FUNCTION apply_transaction_rules(
  input_user_id UUID,
  input_merchant_name TEXT,
  input_category TEXT DEFAULT NULL
)
RETURNS TABLE(
  effective_merchant_name TEXT,
  effective_category TEXT,
  applied_rule_ids UUID[],
  applied_rule_names TEXT[]
)
LANGUAGE plpgsql
AS $$
DECLARE
  rule_record RECORD;
  merchant_name TEXT := COALESCE(input_merchant_name, '');
  category TEXT := input_category;
  rule_ids UUID[] := ARRAY[]::UUID[];
  rule_names TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Get active rules for user, ordered by priority (highest first)
  FOR rule_record IN
    SELECT * FROM transaction_rules 
    WHERE user_id = input_user_id 
      AND is_active = true 
    ORDER BY priority DESC, created_at ASC
  LOOP
    -- Check if pattern matches
    IF (
      (rule_record.pattern_type = 'exact' AND LOWER(merchant_name) = LOWER(rule_record.pattern_value)) OR
      (rule_record.pattern_type = 'contains' AND LOWER(merchant_name) LIKE '%' || LOWER(rule_record.pattern_value) || '%') OR
      (rule_record.pattern_type = 'starts_with' AND LOWER(merchant_name) LIKE LOWER(rule_record.pattern_value) || '%') OR
      (rule_record.pattern_type = 'ends_with' AND LOWER(merchant_name) LIKE '%' || LOWER(rule_record.pattern_value)) OR
      (rule_record.pattern_type = 'regex' AND merchant_name ~* rule_record.pattern_value)
    ) THEN
      -- Apply merchant normalization
      IF rule_record.normalized_merchant_name IS NOT NULL AND 
         (rule_record.rule_type = 'merchant_normalize' OR rule_record.rule_type = 'combined') THEN
        merchant_name := rule_record.normalized_merchant_name;
      END IF;
      
      -- Apply category override
      IF rule_record.override_category IS NOT NULL AND 
         (rule_record.rule_type = 'category_override' OR rule_record.rule_type = 'combined') THEN
        category := rule_record.override_category;
      END IF;
      
      -- Track applied rule
      rule_ids := array_append(rule_ids, rule_record.id);
      rule_names := array_append(rule_names, rule_record.rule_name);
      
      -- Stop at first matching rule (highest priority wins)
      EXIT;
    END IF;
  END LOOP;
  
  RETURN QUERY SELECT merchant_name, category, rule_ids, rule_names;
END;
$$;

-- =====================================================
-- Sample Rules for Common Patterns
-- =====================================================

-- Function to create sample rules for new users
CREATE OR REPLACE FUNCTION create_sample_transaction_rules(target_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  created_count INTEGER := 0;
BEGIN
  -- Check if user already has rules
  IF EXISTS (SELECT 1 FROM transaction_rules WHERE user_id = target_user_id) THEN
    RETURN 0;
  END IF;
  
  -- Sample merchant normalization rules
  INSERT INTO transaction_rules (user_id, rule_name, rule_type, pattern_type, pattern_value, normalized_merchant_name, priority, auto_generated, description)
  VALUES 
    (target_user_id, 'Normalize Starbucks Stores', 'merchant_normalize', 'starts_with', 'STARBUCKS', 'Starbucks', 200, true, 'Normalize all Starbucks store variations'),
    (target_user_id, 'Normalize Amazon Services', 'merchant_normalize', 'starts_with', 'AMAZON', 'Amazon', 200, true, 'Normalize Amazon and Amazon services'),
    (target_user_id, 'Remove Store Numbers', 'merchant_normalize', 'regex', '(.+)\s*#\d+.*', 'Starbucks', 150, true, 'Remove store numbers from merchant names'),
    (target_user_id, 'Remove Date Codes', 'merchant_normalize', 'regex', '(.+)\s+\d{6}.*', 'Merchant', 150, true, 'Remove 6-digit date codes from merchant names');
  
  GET DIAGNOSTICS created_count = ROW_COUNT;
  RETURN created_count;
END;
$$;

-- =====================================================
-- Utility Functions
-- =====================================================

-- Function to test a rule against sample text
CREATE OR REPLACE FUNCTION test_transaction_rule(
  rule_pattern_type TEXT,
  rule_pattern_value TEXT,
  test_merchant_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN (
    (rule_pattern_type = 'exact' AND LOWER(test_merchant_name) = LOWER(rule_pattern_value)) OR
    (rule_pattern_type = 'contains' AND LOWER(test_merchant_name) LIKE '%' || LOWER(rule_pattern_value) || '%') OR
    (rule_pattern_type = 'starts_with' AND LOWER(test_merchant_name) LIKE LOWER(rule_pattern_value) || '%') OR
    (rule_pattern_type = 'ends_with' AND LOWER(test_merchant_name) LIKE '%' || LOWER(rule_pattern_value)) OR
    (rule_pattern_type = 'regex' AND test_merchant_name ~* rule_pattern_value)
  );
END;
$$;

-- Update trigger for updated_at timestamp
CREATE OR REPLACE FUNCTION update_transaction_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER transaction_rules_updated_at_trigger
  BEFORE UPDATE ON transaction_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_transaction_rules_updated_at();

-- =====================================================
-- Comments for documentation
-- =====================================================

COMMENT ON TABLE transaction_rules IS 'User-defined rules for merchant normalization and category overrides';
COMMENT ON TABLE rule_execution_log IS 'Log of rule applications for debugging and analytics';
COMMENT ON FUNCTION apply_transaction_rules IS 'Core function that applies all active rules to a transaction';
COMMENT ON FUNCTION create_sample_transaction_rules IS 'Creates default rules for new users';
COMMENT ON FUNCTION test_transaction_rule IS 'Tests if a rule pattern matches a given merchant name'; 