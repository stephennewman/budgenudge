-- Migration: Add merchant pacing tracking table
-- Date: July 21, 2025
-- Purpose: Track which merchants users want to monitor for spending pacing

-- Create merchant_pacing_tracking table
CREATE TABLE merchant_pacing_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ai_merchant_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  auto_selected BOOLEAN DEFAULT false,  -- Track if auto-selected vs manual
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Ensure unique tracking per user per merchant
  UNIQUE(user_id, ai_merchant_name)
);

-- Add indexes for performance
CREATE INDEX idx_merchant_pacing_tracking_user_id ON merchant_pacing_tracking(user_id);
CREATE INDEX idx_merchant_pacing_tracking_active ON merchant_pacing_tracking(user_id, is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE merchant_pacing_tracking ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own tracking records
CREATE POLICY "Users can manage their own merchant pacing tracking"
ON merchant_pacing_tracking FOR ALL 
USING (auth.uid() = user_id);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_merchant_pacing_tracking_updated_at
    BEFORE UPDATE ON merchant_pacing_tracking
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comment for documentation
COMMENT ON TABLE merchant_pacing_tracking IS 'Tracks which merchants users want to monitor for spending pacing analysis';
COMMENT ON COLUMN merchant_pacing_tracking.auto_selected IS 'True if merchant was auto-selected by system, false if manually added';
COMMENT ON COLUMN merchant_pacing_tracking.ai_merchant_name IS 'Must match ai_merchant_name from transactions table for accurate tracking'; 