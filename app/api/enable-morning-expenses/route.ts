import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TARGET_USER_ID = 'bc474c8b-4b47-4c7d-b202-f469330af2a2';

export async function POST() {
  try {
    console.log('🔧 Enabling morning-expenses SMS for user:', TARGET_USER_ID);
    
    // First check if preference already exists
    const { data: existing, error: checkError } = await supabase
      .from('user_sms_preferences')
      .select('*')
      .eq('user_id', TARGET_USER_ID)
      .eq('sms_type', 'morning-expenses')
      .single();
    
    console.log('📊 Existing preference:', existing);
    console.log('❌ Check error:', checkError);
    
    let result;
    if (existing) {
      // Update existing preference
      const { data: updateData, error: updateError } = await supabase
        .from('user_sms_preferences')
        .update({ enabled: true })
        .eq('user_id', TARGET_USER_ID)
        .eq('sms_type', 'morning-expenses')
        .select();
      
      result = { updated: updateData, error: updateError };
      console.log('🔄 Update result:', result);
    } else {
      // Insert new preference
      const { data: insertData, error: insertError } = await supabase
        .from('user_sms_preferences')
        .insert({
          user_id: TARGET_USER_ID,
          sms_type: 'morning-expenses',
          enabled: true,
          frequency: 'daily'
        })
        .select();
      
      result = { inserted: insertData, error: insertError };
      console.log('➕ Insert result:', result);
    }
    
    if (result.error) {
      throw new Error(`Database operation failed: ${result.error.message}`);
    }
    
    // Verify the preference is now enabled
    const { data: verification, error: verifyError } = await supabase
      .from('user_sms_preferences')
      .select('*')
      .eq('user_id', TARGET_USER_ID)
      .eq('sms_type', 'morning-expenses')
      .single();
    
    console.log('✅ Verification:', verification);
    
    return NextResponse.json({
      success: true,
      message: 'Morning expenses SMS enabled successfully',
      preference: verification,
      operation: existing ? 'updated' : 'created',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Enable error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ 
      success: false, 
      error: errorMessage 
    }, { status: 500 });
  }
}
