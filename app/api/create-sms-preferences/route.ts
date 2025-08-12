import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create a Supabase client for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Create default SMS preferences for the user (only 3 types enabled)
    const defaultPreferences = [
      { user_id: userId, sms_type: 'bills', enabled: false, frequency: 'daily' },
      { user_id: userId, sms_type: 'activity', enabled: false, frequency: 'daily' },
      { user_id: userId, sms_type: 'merchant-pacing', enabled: false, frequency: 'daily' },
      { user_id: userId, sms_type: 'category-pacing', enabled: false, frequency: 'daily' },
      { user_id: userId, sms_type: 'weekly-summary', enabled: true, frequency: 'daily' },
      { user_id: userId, sms_type: 'monthly-summary', enabled: true, frequency: 'daily' },
      { user_id: userId, sms_type: '415pm-special', enabled: true, frequency: 'daily' }
    ];

    const { data: createdPrefs, error: createError } = await supabase
      .from('user_sms_preferences')
      .upsert(defaultPreferences, { onConflict: 'user_id,sms_type' })
      .select();

    if (createError) {
      console.error('Error creating SMS preferences:', createError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to create preferences',
        details: createError
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Created ${createdPrefs?.length || 0} SMS preferences`,
      preferences: createdPrefs
    });

  } catch (error) {
    console.error('Error in create SMS preferences:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 