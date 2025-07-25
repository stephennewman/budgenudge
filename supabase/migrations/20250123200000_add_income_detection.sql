-- =====================================================
-- Income Detection System Migration
-- Creates table for tracking detected income sources and patterns
-- =====================================================

-- Tagged income sources table (similar to tagged_merchants but for income)
CREATE TABLE IF NOT EXISTS tagged_income_sources (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Income source identification
  income_source_name TEXT NOT NULL, -- e.g., "Acme Corp", "Direct Deposit"
  income_pattern TEXT, -- Raw transaction name pattern for matching
  
  -- Amount and frequency analysis
  expected_amount DECIMAL(10,2) NOT NULL,
  frequency TEXT NOT NULL, -- 'weekly', 'bi-weekly', 'bi-monthly', 'monthly', 'irregular'
  
  -- Prediction tracking
  last_income_date DATE,
  next_predicted_date DATE,
  
  -- Detection confidence and metadata
  confidence_score INTEGER NOT NULL DEFAULT 0, -- 0-100
  auto_detected BOOLEAN DEFAULT true,
  
  -- Pattern analysis metadata
  pattern_analysis JSONB, -- Store detailed analysis data
  
  -- Account tracking (in case user has multiple accounts)
  account_identifier TEXT, -- plaid_account_id
  
  -- Status and management
  is_active BOOLEAN DEFAULT true,
  type TEXT DEFAULT 'salary', -- 'salary', 'freelance', 'benefits', 'other'
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint per user per income source
  UNIQUE(user_id, income_source_name)
);

-- Income detection log for tracking analysis runs
CREATE TABLE IF NOT EXISTS income_detection_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Analysis details
  analysis_date TIMESTAMPTZ DEFAULT NOW(),
  lookback_months INTEGER DEFAULT 6,
  transactions_analyzed INTEGER,
  patterns_detected INTEGER,
  
  -- Results
  detection_results JSONB, -- Store full analysis results
  confidence_average DECIMAL(4,2),
  
  -- Status
  status TEXT DEFAULT 'completed', -- 'running', 'completed', 'failed'
  error_message TEXT
);

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_tagged_income_sources_user_id ON tagged_income_sources(user_id);
CREATE INDEX IF NOT EXISTS idx_tagged_income_sources_active ON tagged_income_sources(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_tagged_income_sources_next_date ON tagged_income_sources(next_predicted_date) WHERE next_predicted_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tagged_income_sources_account ON tagged_income_sources(account_identifier);

CREATE INDEX IF NOT EXISTS idx_income_detection_log_user_id ON income_detection_log(user_id);
CREATE INDEX IF NOT EXISTS idx_income_detection_log_date ON income_detection_log(analysis_date DESC);

-- Enable RLS
ALTER TABLE tagged_income_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE income_detection_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their own income sources" ON tagged_income_sources
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can access their own income detection logs" ON income_detection_log
  FOR ALL USING (auth.uid() = user_id);

-- Add updated_at triggers
CREATE OR REPLACE FUNCTION update_tagged_income_sources_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tagged_income_sources_updated_at
  BEFORE UPDATE ON tagged_income_sources
  FOR EACH ROW
  EXECUTE FUNCTION update_tagged_income_sources_updated_at();

-- Add comments for documentation
COMMENT ON TABLE tagged_income_sources IS 'Tracks detected income sources and their payment patterns for paycheck-aligned insights';
COMMENT ON COLUMN tagged_income_sources.pattern_analysis IS 'JSONB storing detailed analysis: intervals, amounts, dates, confidence factors';
COMMENT ON COLUMN tagged_income_sources.frequency IS 'Detected payment frequency: weekly, bi-weekly, bi-monthly, monthly, irregular';
COMMENT ON TABLE income_detection_log IS 'Logs income pattern analysis runs for debugging and improvement'; 