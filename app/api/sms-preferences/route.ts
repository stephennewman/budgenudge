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
    const allSmsTypes = ['bills', 'activity', 'merchant-pacing', 'category-pacing', 'weekly-summary', 'monthly-summary', 'paycheck-efficiency', 'cash-flow-runway'];
    const existingTypes = new Set(preferences?.map(p => p.sms_type) || []);
    const missingTypes = allSmsTypes.filter(type => !existingTypes.has(type));

    // Create missing preferences one by one to handle conflicts gracefully  
    if (missingTypes.length > 0) {
      for (const smsType of missingTypes) {
        try {
          await supabase
            .from('user_sms_preferences')
            .insert({
              user_id: userId,
              sms_type: smsType,
              enabled: true,
              frequency: 'daily'
            });
        } catch {
          // Ignore unique constraint violations (record already exists)
          console.log(`Preference for ${smsType} may already exist, skipping`);
        }
      }

      // Fetch all preferences to get the complete, up-to-date list
      const { data: finalPreferences, error: finalError } = await supabase
        .from('user_sms_preferences')
        .select('*')
        .eq('user_id', userId);

      if (finalError) {
        console.error('Error fetching final preferences:', finalError);
        return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 });
      }

      return NextResponse.json({ success: true, preferences: finalPreferences });
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

    // Check if any preference has a phone number for lead matching
    const phoneNumbers = preferences
      .map((pref: { phone_number?: string }) => pref.phone_number)
      .filter(Boolean);
    
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

    // If phone numbers were provided, try to match with sample SMS leads
    if (phoneNumbers.length > 0) {
      for (const phoneNumber of phoneNumbers) {
        try {
          // Clean phone number
          const cleanPhone = phoneNumber.replace(/\D/g, '');
          
          // Check if there's a sample SMS lead for this phone number
          const { data: lead, error: leadError } = await supabase
            .from('sample_sms_leads')
            .select('*')
            .eq('phone_number', cleanPhone)
            .eq('converted_to_signup', false)
            .single();

          if (!leadError && lead) {
            // Update the lead to mark as converted
            const { error: updateError } = await supabase
              .from('sample_sms_leads')
              .update({
                converted_to_signup: true,
                conversion_date: new Date().toISOString(),
                user_id: userId
              })
              .eq('id', lead.id);

            if (!updateError) {
              console.log('✅ Sample SMS lead matched to user:', {
                leadId: lead.id,
                userId,
                phoneNumber: cleanPhone,
                daysToConversion: Math.floor((Date.now() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60 * 24))
              });
            }
          }
        } catch (error) {
          console.warn('Lead matching failed (non-blocking):', error);
        }
      }
    }

    return NextResponse.json({ success: true, message: 'Preferences updated successfully' });

  } catch (error) {
    console.error('Error updating SMS preferences:', error);
    return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 });
  }
} 