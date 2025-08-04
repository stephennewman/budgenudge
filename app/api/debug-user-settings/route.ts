import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    console.log('🔍 Checking user settings for SMS duplication investigation...');
    
    // Stephen's user ID from the logs
    const stephenUserId = 'bc474c8b-4b47-4c7d-b202-f469330af2a2';
    
    // Get user's SMS settings
    const { data: smsSettings, error: smsError } = await supabase
      .from('user_sms_settings')
      .select('*')
      .eq('user_id', stephenUserId)
      .single();

    // Get user's SMS preferences
    const { data: smsPrefs, error: prefsError } = await supabase
      .from('user_sms_preferences')
      .select('*')
      .eq('user_id', stephenUserId);

    // Get user info from auth.users
    const { data: userInfo, error: userError } = await supabase.auth.admin.getUserById(stephenUserId);

    console.log('🔍 User settings found');

    return NextResponse.json({ 
      success: true,
      userId: stephenUserId,
      email: 'stephen@krezzo.com',
      phone: '6173472721',
      smsSettings: smsSettings || null,
      smsError: smsError || null,
      smsPreferences: smsPrefs || null,
      prefsError: prefsError || null,
      userInfo: userInfo || null,
      userError: userError || null
    });

  } catch (err) {
    console.error('💥 Unexpected error:', err);
    return NextResponse.json({ 
      success: false, 
      error: 'Unexpected error',
      details: err 
    }, { status: 500 });
  }
}