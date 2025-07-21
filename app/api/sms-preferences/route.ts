import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create a Supabase client for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Get user SMS preferences
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Get user's current SMS preferences
    const { data: preferences, error } = await supabase
      .from('user_sms_preferences')
      .select('*')
      .eq('user_id', userId)
      .order('sms_type');

    if (error) {
      console.error('Error fetching SMS preferences:', error);
      return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 });
    }

    // Ensure all SMS types exist for the user
    const allSmsTypes = ['bills', 'spending', 'activity', 'merchant-pacing', 'category-pacing'];
    const existingTypes = preferences?.map(p => p.sms_type) || [];
    const missingTypes = allSmsTypes.filter(type => !existingTypes.includes(type));

    // Create missing preferences
    if (missingTypes.length > 0) {
      const defaultPreferences = missingTypes.map(type => ({
        user_id: userId,
        sms_type: type,
        enabled: true,
        frequency: 'daily'
      }));

      const { data: createdPrefs, error: createError } = await supabase
        .from('user_sms_preferences')
        .insert(defaultPreferences)
        .select();

      if (createError) {
        console.error('Error creating missing preferences:', createError);
        return NextResponse.json({ error: 'Failed to create missing preferences' }, { status: 500 });
      }

      // Combine existing and newly created preferences
      const allPreferences = [...(preferences || []), ...(createdPrefs || [])];
      return NextResponse.json({ success: true, preferences: allPreferences });
    }

    return NextResponse.json({ success: true, preferences });

  } catch (error) {
    console.error('Error in SMS preferences GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Update user SMS preferences
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, preferences } = body;

    if (!userId || !preferences) {
      return NextResponse.json({ error: 'User ID and preferences are required' }, { status: 400 });
    }

    // Update each preference
    const updatePromises = preferences.map(async (pref: { sms_type: string; enabled: boolean; frequency: string; phone_number?: string }) => {
      const { data, error } = await supabase
        .from('user_sms_preferences')
        .upsert({
          user_id: userId,
          sms_type: pref.sms_type,
          enabled: pref.enabled,
          frequency: pref.frequency,
          phone_number: pref.phone_number || null
        }, {
          onConflict: 'user_id,sms_type'
        })
        .select();

      if (error) {
        console.error(`Error updating ${pref.sms_type} preference:`, error);
        throw error;
      }

      return data;
    });

    await Promise.all(updatePromises);

    return NextResponse.json({ success: true, message: 'Preferences updated successfully' });

  } catch (error) {
    console.error('Error updating SMS preferences:', error);
    return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 });
  }
} 