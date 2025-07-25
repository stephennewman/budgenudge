-- Add Conversational AI and Income Profile System
-- ================================================

-- Extended user income profiles from conversations
CREATE TABLE IF NOT EXISTS user_income_profiles (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Profile data from conversations
  profile_data JSONB NOT NULL DEFAULT '{}',
  
  -- Conversation metadata
  setup_completed BOOLEAN DEFAULT FALSE,
  last_conversation_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(user_id)
);

-- Chat conversation history
CREATE TABLE IF NOT EXISTS ai_conversations (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Message data
  message_type TEXT NOT NULL CHECK (message_type IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  
  -- Conversation metadata
  conversation_id UUID NOT NULL, -- Groups related messages
  intent TEXT, -- What the AI is trying to accomplish
  extracted_data JSONB DEFAULT '{}', -- Structured data extracted from conversation
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Indexes
  INDEX idx_ai_conversations_user_id (user_id),
  INDEX idx_ai_conversations_conversation_id (conversation_id),
  INDEX idx_ai_conversations_created_at (created_at)
);

-- Income schedule templates (for AI to reference)
CREATE TABLE IF NOT EXISTS income_schedule_templates (
  id SERIAL PRIMARY KEY,
  
  -- Template metadata
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  
  -- Schedule pattern
  pattern_type TEXT NOT NULL CHECK (pattern_type IN ('weekly', 'bi-weekly', 'bi-monthly', 'monthly', 'custom')),
  pattern_config JSONB NOT NULL DEFAULT '{}',
  
  -- Common phrases for AI recognition
  recognition_phrases TEXT[] DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert common income schedule templates
INSERT INTO income_schedule_templates (name, description, pattern_type, pattern_config, recognition_phrases) VALUES
  ('bi-weekly-friday', 'Every other Friday', 'bi-weekly', '{"day_of_week": 5, "start_date": "2025-01-03"}', ARRAY['every other friday', 'bi-weekly friday', 'every two weeks', 'biweekly']),
  ('bi-monthly-15-30', '15th and last day of month', 'bi-monthly', '{"days": [15, -1], "business_day_adjustment": true}', ARRAY['15th and last day', '15th and month end', 'twice a month', 'bi-monthly', 'semi-monthly']),
  ('monthly-1st', 'First of every month', 'monthly', '{"day": 1, "business_day_adjustment": true}', ARRAY['first of the month', 'monthly', 'once a month']),
  ('weekly-friday', 'Every Friday', 'weekly', '{"day_of_week": 5}', ARRAY['every friday', 'weekly', 'once a week']);

-- RLS Policies
ALTER TABLE user_income_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE income_schedule_templates ENABLE ROW LEVEL SECURITY;

-- Users can only access their own profiles and conversations
CREATE POLICY "Users can view own income profile" ON user_income_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own income profile" ON user_income_profiles
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own conversations" ON ai_conversations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversations" ON ai_conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Everyone can read schedule templates (reference data)
CREATE POLICY "Anyone can view schedule templates" ON income_schedule_templates
  FOR SELECT USING (TRUE);

-- Comments
COMMENT ON TABLE user_income_profiles IS 'User income profiles created through conversational AI';
COMMENT ON TABLE ai_conversations IS 'Chat history between users and AI for profile setup';
COMMENT ON TABLE income_schedule_templates IS 'Reference templates for common income schedules'; 