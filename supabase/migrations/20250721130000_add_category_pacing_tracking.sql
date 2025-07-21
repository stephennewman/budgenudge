-- Migration: Add category pacing tracking table
-- Date: July 21, 2025
-- Purpose: Track which spending categories users want to monitor for pacing

-- Create category_pacing_tracking table
CREATE TABLE category_pacing_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ai_category TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  auto_selected BOOLEAN DEFAULT false,  -- Track if auto-selected vs manual
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Ensure unique tracking per user per category
  UNIQUE(user_id, ai_category)
);

-- Add indexes for performance
CREATE INDEX idx_category_pacing_tracking_user_id ON category_pacing_tracking(user_id);
CREATE INDEX idx_category_pacing_tracking_active ON category_pacing_tracking(is_active);
CREATE INDEX idx_category_pacing_tracking_auto_selected ON category_pacing_tracking(auto_selected);

-- Enable RLS
ALTER TABLE category_pacing_tracking ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only manage their own tracked categories
CREATE POLICY "Users can view their own tracked categories" ON category_pacing_tracking
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tracked categories" ON category_pacing_tracking
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tracked categories" ON category_pacing_tracking
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tracked categories" ON category_pacing_tracking
  FOR DELETE USING (auth.uid() = user_id);

-- Add comments for documentation
COMMENT ON TABLE category_pacing_tracking IS 'Tracks which spending categories users want to monitor for pacing analysis';
COMMENT ON COLUMN category_pacing_tracking.ai_category IS 'The AI-generated spending category name (e.g., Restaurant, Groceries, Gas)';
COMMENT ON COLUMN category_pacing_tracking.is_active IS 'Whether this category is currently being tracked for pacing';
COMMENT ON COLUMN category_pacing_tracking.auto_selected IS 'Whether this category was auto-selected (true) or manually chosen (false)'; 