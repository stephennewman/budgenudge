import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create a Supabase client for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST - Migrate existing users to complete SMS workflow
export async function POST() {
  try {
    console.log('🔄 Starting migration of existing users to complete SMS workflow...');

    // Get all users who have Plaid connections but incomplete SMS setup
    const { data: users, error: usersError } = await supabase
      .from('items')
      .select('user_id')
      .not('user_id', 'is', null);

    if (usersError) {
      return NextResponse.json({ success: false, error: 'Failed to fetch users' });
    }

    if (!users || users.length === 0) {
      return NextResponse.json({ success: true, message: 'No users found to migrate', migrated: 0 });
    }

    // Get unique user IDs
    const uniqueUsers = Array.from(new Map(users.map(user => [user.user_id, user])).values());

    let migratedCount = 0;
    const migrationResults = [];

    for (const user of uniqueUsers) {
      try {
        console.log(`🔄 Migrating user: ${user.user_id}`);
        
        // Get user profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('email, phone_number')
          .eq('id', user.user_id)
          .single();
        
        // Check if user already has complete SMS setup
        const { data: existingPreferences } = await supabase
          .from('user_sms_preferences')
          .select('sms_type')
          .eq('user_id', user.user_id);

        const { data: existingSettings } = await supabase
          .from('user_sms_settings')
          .select('id')
          .eq('user_id', user.user_id);

        const requiredTypes = ['activity', 'bills', 'merchant-pacing', 'category-pacing'];
        const existingTypes = new Set(existingPreferences?.map(p => p.sms_type) || []);
        const missingTypes = requiredTypes.filter(type => !existingTypes.has(type));

        const userResult = {
          user_id: user.user_id,
          email: profile?.email,
          actions: [] as string[]
        };

        // Create missing SMS preferences
        if (missingTypes.length > 0) {
          for (const smsType of missingTypes) {
            const { error: prefError } = await supabase
              .from('user_sms_preferences')
              .upsert({
                user_id: user.user_id,
                sms_type: smsType,
                enabled: true,
                frequency: 'daily',
                phone_number: profile?.phone_number || null
              }, {
                onConflict: 'user_id,sms_type'
              });

            if (!prefError) {
              userResult.actions.push(`✅ Created ${smsType} preference`);
            } else {
              userResult.actions.push(`❌ Failed to create ${smsType} preference: ${prefError.message}`);
            }
          }
        }

        // Create user_sms_settings if missing
        if (!existingSettings || existingSettings.length === 0) {
          const { error: settingsError } = await supabase
            .from('user_sms_settings')
            .insert({
              user_id: user.user_id,
              phone_number: profile?.phone_number || null,
              send_time: '08:00:00'
            });

          if (!settingsError) {
            userResult.actions.push('✅ Created SMS settings with 8AM send time');
          } else {
            userResult.actions.push(`❌ Failed to create SMS settings: ${settingsError.message}`);
          }
        } else {
          // Update existing settings to ensure send time is correct
          const { error: updateError } = await supabase
            .from('user_sms_settings')
            .update({
              send_time: '08:00:00'
            })
            .eq('user_id', user.user_id);

          if (!updateError) {
            userResult.actions.push('✅ Updated SMS settings send time to 8AM');
          } else {
            userResult.actions.push(`❌ Failed to update SMS settings: ${updateError.message}`);
          }
        }

        // Check if user has merchant/category tracking
        const { data: merchantTracking } = await supabase
          .from('merchant_pacing_tracking')
          .select('count')
          .eq('user_id', user.user_id)
          .eq('is_active', true);

        const { data: categoryTracking } = await supabase
          .from('category_pacing_tracking')
          .select('count')
          .eq('user_id', user.user_id)
          .eq('is_active', true);

        if (!merchantTracking || merchantTracking.length === 0) {
          userResult.actions.push('⚠️ No merchant tracking found - user should run auto-selection');
        }

        if (!categoryTracking || categoryTracking.length === 0) {
          userResult.actions.push('⚠️ No category tracking found - user should run auto-selection');
        }

        migrationResults.push(userResult);
        migratedCount++;

      } catch (userError) {
        console.error(`Error migrating user ${user.user_id}:`, userError);
        const errorMessage = userError instanceof Error ? userError.message : 'Unknown error';
        migrationResults.push({
          user_id: user.user_id,
          email: 'unknown',
          actions: [`❌ Migration failed: ${errorMessage}`]
        });
      }
    }

    return NextResponse.json({
      success: true,
      total_users: uniqueUsers.length,
      migrated_users: migratedCount,
      migration_results: migrationResults,
      summary: `✅ Migrated ${migratedCount}/${uniqueUsers.length} existing users to complete SMS workflow`
    });

  } catch (error) {
    console.error('Error migrating existing users:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error',
      details: errorMessage 
    }, { status: 500 });
  }
}
