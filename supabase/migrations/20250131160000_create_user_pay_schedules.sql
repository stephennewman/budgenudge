-- Create user_pay_schedules table for PayBudge feature
CREATE TABLE IF NOT EXISTS user_pay_schedules (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Pay Pattern Detection
  pay_frequency TEXT NOT NULL CHECK (pay_frequency IN ('weekly', 'bi-weekly', 'monthly', 'irregular')),
  estimated_pay_amount DECIMAL(10,2),
  last_pay_date DATE,
  next_predicted_pay_date DATE,
  confidence_score INTEGER CHECK (confidence_score >= 0 AND confidence_score <= 100),
  
  -- Billing Configuration  
  stripe_subscription_id TEXT,
  billing_amount INTEGER, -- Amount in cents (1000, 2000, 4333)
  billing_status TEXT DEFAULT 'pending' CHECK (billing_status IN ('pending', 'active', 'paused', 'cancelled')),
  
  -- Pattern Analysis
  pay_pattern_data JSONB, -- Store analysis metadata
  detection_method TEXT DEFAULT 'automatic' CHECK (detection_method IN ('automatic', 'manual_override', 'manual_selection')),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_user_pay_schedule UNIQUE(user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_pay_schedules_user_id ON user_pay_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_user_pay_schedules_stripe_subscription ON user_pay_schedules(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_user_pay_schedules_next_pay_date ON user_pay_schedules(next_predicted_pay_date);

-- Add RLS policy
ALTER TABLE user_pay_schedules ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own pay schedules
CREATE POLICY "Users can view own pay schedules" ON user_pay_schedules
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can update their own pay schedules
CREATE POLICY "Users can update own pay schedules" ON user_pay_schedules
  FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Users can insert their own pay schedules
CREATE POLICY "Users can insert own pay schedules" ON user_pay_schedules
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_pay_schedules_updated_at 
  BEFORE UPDATE ON user_pay_schedules 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
