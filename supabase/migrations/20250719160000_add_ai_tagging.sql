-- =====================================================
-- AI Tagging System Migration
-- Adds merchant normalization and category tagging
-- =====================================================

-- Add AI tag columns to transactions table
ALTER TABLE transactions 
ADD COLUMN ai_merchant_name TEXT,
ADD COLUMN ai_category_tag TEXT;

-- Create merchant AI tags cache table
CREATE TABLE merchant_ai_tags (
  merchant_pattern TEXT PRIMARY KEY,
  ai_merchant_name TEXT NOT NULL,
  ai_category_tag TEXT NOT NULL,
  is_manual_override BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_transactions_ai_merchant_name ON transactions(ai_merchant_name);
CREATE INDEX idx_transactions_ai_category_tag ON transactions(ai_category_tag);
CREATE INDEX idx_merchant_ai_tags_merchant_name ON merchant_ai_tags(ai_merchant_name);
CREATE INDEX idx_merchant_ai_tags_category ON merchant_ai_tags(ai_category_tag);

-- Add updated_at trigger for merchant_ai_tags
CREATE OR REPLACE FUNCTION update_merchant_ai_tags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER merchant_ai_tags_updated_at
  BEFORE UPDATE ON merchant_ai_tags
  FOR EACH ROW
  EXECUTE FUNCTION update_merchant_ai_tags_updated_at();

-- RLS Policies for merchant_ai_tags table
ALTER TABLE merchant_ai_tags ENABLE ROW LEVEL SECURITY;

-- Users can read all merchant tags (for consistency across users)
CREATE POLICY "Users can read all merchant AI tags" ON merchant_ai_tags
  FOR SELECT TO authenticated
  USING (true);

-- Users can insert merchant tags (for new merchants)
CREATE POLICY "Users can insert merchant AI tags" ON merchant_ai_tags
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Users can update merchant tags (for manual overrides)
CREATE POLICY "Users can update merchant AI tags" ON merchant_ai_tags
  FOR UPDATE TO authenticated
  USING (true);

-- Add comments for documentation
COMMENT ON TABLE merchant_ai_tags IS 'Cache of AI-generated merchant names and categories with manual override support';
COMMENT ON COLUMN transactions.ai_merchant_name IS 'AI-normalized merchant name for consistency';
COMMENT ON COLUMN transactions.ai_category_tag IS 'AI-generated category tag for logical grouping';
COMMENT ON COLUMN merchant_ai_tags.merchant_pattern IS 'Original merchant name pattern from Plaid';
COMMENT ON COLUMN merchant_ai_tags.ai_merchant_name IS 'AI-cleaned merchant name';
COMMENT ON COLUMN merchant_ai_tags.ai_category_tag IS 'AI-generated category tag';
COMMENT ON COLUMN merchant_ai_tags.is_manual_override IS 'True if user has manually overridden the AI suggestion'; 