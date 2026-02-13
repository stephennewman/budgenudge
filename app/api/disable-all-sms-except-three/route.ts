import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create a Supabase client for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST() {
  try {
    // Get all users with SMS preferences
    const { data: allUsers, error: usersError } = await supabase
      .from('user_sms_preferences')
      .select('user_id');

    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch users',
        details: usersError.message 
      }, { status: 500 });
    }

    const uniqueUsers = [...new Set(allUsers?.map(u => u.user_id) || [])];
    let usersUpdated = 0;
    let totalPreferencesUpdated = 0;

    // Process each user
    for (const userId of uniqueUsers) {
      try {
        // Get all SMS preferences for this user
        const { data: userPreferences, error: prefsError } = await supabase
          .from('user_sms_preferences')
          .select('*')
          .eq('user_id', userId);

        if (prefsError) {
          console.error(`❌ Error fetching preferences for user ${userId}:`, prefsError);
          continue;
        }

        if (!userPreferences || userPreferences.length === 0) {
          continue;
        }

        // Update preferences: enable only the 3 we want to keep
        const updatePromises = userPreferences.map(async (pref) => {
          const shouldEnable = ['weekly-summary', 'monthly-summary', 'activity'].includes(pref.sms_type);
          
          if (pref.enabled !== shouldEnable) {
            const { error: updateError } = await supabase
              .from('user_sms_preferences')
              .update({ 
                enabled: shouldEnable,
                updated_at: new Date().toISOString()
              })
              .eq('id', pref.id);

            if (updateError) {
              console.error(`❌ Error updating ${pref.sms_type} for user ${userId}:`, updateError);
              return false;
            }

            return true;
          }
          
          return false; // No change needed
        });

        // Check if user is missing any of the 3 required templates
        const existingTypes = new Set(userPreferences.map(p => p.sms_type));
        const requiredTypes = ['weekly-summary', 'monthly-summary', 'activity'];
        const missingTypes = requiredTypes.filter(type => !existingTypes.has(type));

        // Create missing templates
        if (missingTypes.length > 0) {
          for (const smsType of missingTypes) {
            try {
              const { error: createError } = await supabase
                .from('user_sms_preferences')
                .insert({
                  user_id: userId,
                  sms_type: smsType,
                  enabled: true, // These are the ones we want enabled
                  frequency: 'daily',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                });

              if (createError) {
                console.error(`❌ Error creating ${smsType} for user ${userId}:`, createError);
              } else {
                totalPreferencesUpdated++;
              }
            } catch (error) {
              console.error(`❌ Error creating ${smsType} for user ${userId}:`, error);
            }
          }
        }

        const results = await Promise.all(updatePromises);
        const updatedCount = results.filter(Boolean).length;
        
        if (updatedCount > 0) {
          usersUpdated++;
          totalPreferencesUpdated += updatedCount;
        } else {
        }

      } catch (error) {
        console.error(`❌ Error processing user ${userId}:`, error);
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'SMS templates updated successfully',
      results: {
        usersProcessed: uniqueUsers.length,
        usersUpdated,
        totalPreferencesUpdated
      }
    });

  } catch (error) {
    console.error('❌ Error in SMS template cleanup:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET method to show current status
export async function GET() {
  try {
    // Get all SMS preferences
    const { data: allPreferences, error: prefsError } = await supabase
      .from('user_sms_preferences')
      .select('*');

    if (prefsError) {
      console.error('❌ Error fetching preferences:', prefsError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch preferences',
        details: prefsError.message 
      }, { status: 500 });
    }

    // Group by SMS type and count enabled/disabled
    const templateStatus = new Map<string, { enabled: number; disabled: number; total: number }>();
    
    allPreferences?.forEach(pref => {
      if (!templateStatus.has(pref.sms_type)) {
        templateStatus.set(pref.sms_type, { enabled: 0, disabled: 0, total: 0 });
      }
      
      const status = templateStatus.get(pref.sms_type)!;
      status.total++;
      if (pref.enabled) {
        status.enabled++;
      } else {
        status.disabled++;
      }
    });

    // Convert to array for easier display
    const statusArray = Array.from(templateStatus.entries()).map(([type, status]) => ({
      sms_type: type,
      ...status,
      percentage_enabled: Math.round((status.enabled / status.total) * 100)
    }));

    // Sort by percentage enabled (highest first)
    statusArray.sort((a, b) => b.percentage_enabled - a.percentage_enabled);

    return NextResponse.json({ 
      success: true, 
      message: 'Current SMS template status',
      total_users: allPreferences?.length || 0,
      template_status: statusArray
    });

  } catch (error) {
    console.error('❌ Error checking SMS template status:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
