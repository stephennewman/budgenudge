import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create a Supabase client for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Applying SMS preferences migration...');
    
    // Step 1: Create the table
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS user_sms_preferences (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL,
        sms_type VARCHAR(20) NOT NULL CHECK (sms_type IN ('bills', 'spending', 'activity')),
        enabled BOOLEAN DEFAULT true,
        frequency VARCHAR(20) DEFAULT 'daily' CHECK (frequency IN ('30min', 'hourly', 'daily', 'weekly')),
        phone_number VARCHAR(20),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(user_id, sms_type)
      );
    `;
    
    const { error: createError } = await supabase.rpc('sql', { query: createTableSQL });
    if (createError) {
      console.error('Error creating table:', createError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to create table',
        details: createError
      }, { status: 500 });
    }
    
    // Step 2: Create indexes
    const indexesSQL = `
      CREATE INDEX IF NOT EXISTS idx_user_sms_preferences_user_id ON user_sms_preferences(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_sms_preferences_enabled ON user_sms_preferences(enabled);
      CREATE INDEX IF NOT EXISTS idx_user_sms_preferences_frequency ON user_sms_preferences(frequency);
    `;
    
    const { error: indexError } = await supabase.rpc('sql', { query: indexesSQL });
    if (indexError) {
      console.error('Error creating indexes:', indexError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to create indexes',
        details: indexError
      }, { status: 500 });
    }
    
    // Step 3: Enable RLS
    const rlsSQL = `
      ALTER TABLE user_sms_preferences ENABLE ROW LEVEL SECURITY;
    `;
    
    const { error: rlsError } = await supabase.rpc('sql', { query: rlsSQL });
    if (rlsError) {
      console.error('Error enabling RLS:', rlsError);
      // This might already be enabled, so we can continue
    }
    
    // Step 4: Create RLS policies
    const policiesSQL = `
      DROP POLICY IF EXISTS "Users can view their own SMS preferences" ON user_sms_preferences;
      DROP POLICY IF EXISTS "Users can insert their own SMS preferences" ON user_sms_preferences;
      DROP POLICY IF EXISTS "Users can update their own SMS preferences" ON user_sms_preferences;
      DROP POLICY IF EXISTS "Users can delete their own SMS preferences" ON user_sms_preferences;
      
      CREATE POLICY "Users can view their own SMS preferences" ON user_sms_preferences
        FOR SELECT USING (auth.uid() = user_id);
      
      CREATE POLICY "Users can insert their own SMS preferences" ON user_sms_preferences
        FOR INSERT WITH CHECK (auth.uid() = user_id);
      
      CREATE POLICY "Users can update their own SMS preferences" ON user_sms_preferences
        FOR UPDATE USING (auth.uid() = user_id);
      
      CREATE POLICY "Users can delete their own SMS preferences" ON user_sms_preferences
        FOR DELETE USING (auth.uid() = user_id);
    `;
    
    const { error: policiesError } = await supabase.rpc('sql', { query: policiesSQL });
    if (policiesError) {
      console.error('Error creating policies:', policiesError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to create policies',
        details: policiesError
      }, { status: 500 });
    }
    
    // Step 5: Create default preferences for existing users
    const defaultPrefsSQL = `
      INSERT INTO user_sms_preferences (user_id, sms_type, enabled, frequency)
      SELECT 
        items.user_id,
        sms_type,
        true,
        'daily'
      FROM items
      CROSS JOIN (
        SELECT 'bills' as sms_type
        UNION SELECT 'spending' as sms_type
        UNION SELECT 'activity' as sms_type
      ) sms_types
      WHERE items.user_id IS NOT NULL
      ON CONFLICT (user_id, sms_type) DO NOTHING;
    `;
    
    const { error: defaultPrefsError } = await supabase.rpc('sql', { query: defaultPrefsSQL });
    if (defaultPrefsError) {
      console.error('Error creating default preferences:', defaultPrefsError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to create default preferences',
        details: defaultPrefsError
      }, { status: 500 });
    }
    
    // Step 6: Test the table
    const { data: testData, error: testError } = await supabase
      .from('user_sms_preferences')
      .select('*')
      .limit(1);
    
    if (testError) {
      console.error('Error testing table:', testError);
      return NextResponse.json({ 
        success: false, 
        error: 'Table created but cannot be accessed',
        details: testError
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'SMS preferences migration applied successfully',
      testData: testData
    });
    
  } catch (error) {
    console.error('🚨 Migration error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Migration failed', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 