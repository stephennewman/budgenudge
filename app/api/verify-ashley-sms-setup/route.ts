import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create a Supabase client for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST - Verify and fix Ashley's complete SMS setup
export async function POST() {
  try {
    const ashleyEmail = 'ashleylynnenewman@me.com';
    const ashleyPhone = '+15084934141';
    const ashleyUserId = 'd5671ac4-cd39-4c1b-a897-7298dd15938a';
    const slicktextContactId = '61330767';
    const sendTime = '08:00:00';

    console.log('🔍 Verifying Ashley Newman SMS setup...');
    
    const issues = [];
    const fixes = [];

    // 1. Verify Ashley has an active Plaid-connected item
    console.log('1. Checking Plaid connection...');
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('plaid_item_id, user_id, created_at')
      .eq('user_id', ashleyUserId);

    if (itemsError || !items || items.length === 0) {
      issues.push('❌ No Plaid-connected items found for Ashley');
    } else {
      console.log(`✅ Found ${items.length} Plaid item(s) for Ashley`);
    }

    // 2. Check user_sms_settings
    console.log('2. Checking SMS settings...');
    const { data: smsSettings, error: smsError } = await supabase
      .from('user_sms_settings')
      .select('*')
      .eq('user_id', ashleyUserId);

    if (smsError || !smsSettings || smsSettings.length === 0) {
      issues.push('❌ No SMS settings found for Ashley');
      
      // Create SMS settings
      const { data: newSettings, error: createError } = await supabase
        .from('user_sms_settings')
        .insert({
          user_id: ashleyUserId,
          phone_number: ashleyPhone,
          send_time: sendTime,
          timezone: 'America/New_York',
          is_active: true,
          recurring_enabled: true,
          recent_enabled: true,
          merchant_pacing_enabled: true,
          category_pacing_enabled: true,
          slicktext_contact_id: slicktextContactId
        })
        .select();

      if (createError) {
        issues.push(`❌ Failed to create SMS settings: ${createError.message}`);
      } else {
        fixes.push('✅ Created SMS settings for Ashley with all message types enabled');
      }
    } else {
      const settings = smsSettings[0];
      const settingsIssues = [];
      
      if (settings.phone_number !== ashleyPhone) {
        settingsIssues.push(`Phone number mismatch: ${settings.phone_number} vs ${ashleyPhone}`);
      }
      if (settings.send_time !== sendTime) {
        settingsIssues.push(`Send time mismatch: ${settings.send_time} vs ${sendTime}`);
      }
      if (!settings.is_active) {
        settingsIssues.push('SMS not active');
      }
      if (!settings.recurring_enabled) {
        settingsIssues.push('Recurring messages disabled');
      }
      if (!settings.recent_enabled) {
        settingsIssues.push('Recent activity messages disabled');
      }
      if (!settings.merchant_pacing_enabled) {
        settingsIssues.push('Merchant pacing messages disabled');
      }
      if (!settings.category_pacing_enabled) {
        settingsIssues.push('Category pacing messages disabled');
      }
      if (settings.slicktext_contact_id !== slicktextContactId) {
        settingsIssues.push(`SlickText contact ID mismatch: ${settings.slicktext_contact_id} vs ${slicktextContactId}`);
      }

      if (settingsIssues.length > 0) {
        issues.push(`❌ SMS settings issues: ${settingsIssues.join(', ')}`);
        
        // Fix SMS settings
        const { error: updateError } = await supabase
          .from('user_sms_settings')
          .update({
            phone_number: ashleyPhone,
            send_time: sendTime,
            is_active: true,
            recurring_enabled: true,
            recent_enabled: true,
            merchant_pacing_enabled: true,
            category_pacing_enabled: true,
            slicktext_contact_id: slicktextContactId
          })
          .eq('user_id', ashleyUserId);

        if (updateError) {
          issues.push(`❌ Failed to update SMS settings: ${updateError.message}`);
        } else {
          fixes.push('✅ Updated SMS settings to enable all message types');
        }
      } else {
        console.log('✅ SMS settings are correct');
      }
    }

    // 3. Check user profile
    console.log('3. Checking user profile...');
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email, phone_number')
      .eq('id', ashleyUserId);

    if (profileError || !profile || profile.length === 0) {
      issues.push('❌ No profile found for Ashley');
    } else {
      const userProfile = profile[0];
      if (userProfile.email !== ashleyEmail) {
        issues.push(`❌ Email mismatch in profile: ${userProfile.email} vs ${ashleyEmail}`);
      }
      if (userProfile.phone_number !== ashleyPhone) {
        issues.push(`❌ Phone mismatch in profile: ${userProfile.phone_number} vs ${ashleyPhone}`);
        
        // Update profile phone
        const { error: updateProfileError } = await supabase
          .from('profiles')
          .update({ phone_number: ashleyPhone })
          .eq('id', ashleyUserId);

        if (updateProfileError) {
          issues.push(`❌ Failed to update profile phone: ${updateProfileError.message}`);
        } else {
          fixes.push('✅ Updated profile phone number');
        }
      }
    }

    // 4. Check merchant and category tracking
    console.log('4. Checking tracking setup...');
    const { data: merchantTracking } = await supabase
      .from('merchant_pacing_tracking')
      .select('count')
      .eq('user_id', ashleyUserId)
      .eq('is_active', true);

    const { data: categoryTracking } = await supabase
      .from('category_pacing_tracking')
      .select('count')
      .eq('user_id', ashleyUserId)
      .eq('is_active', true);

    const merchantCount = merchantTracking?.length || 0;
    const categoryCount = categoryTracking?.length || 0;

    if (merchantCount === 0) {
      issues.push('❌ No active merchant tracking configured');
    }
    if (categoryCount === 0) {
      issues.push('❌ No active category tracking configured');
    }

    // 5. Test SMS generation
    console.log('5. Testing SMS message generation...');
    const testResults = {};
    const messageTypes = ['recurring', 'recent', 'merchant-pacing', 'category-pacing'];
    
    for (const type of messageTypes) {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/income-detection/test-templates`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: ashleyUserId,
            template_types: [type]
          })
        });
        
        const result = await response.json();
        if (result.success && result.results && result.results.length > 0) {
          testResults[type] = '✅ Generated successfully';
        } else {
          testResults[type] = '❌ Failed to generate';
          issues.push(`❌ ${type} message generation failed`);
        }
      } catch (error) {
        testResults[type] = `❌ Error: ${error.message}`;
        issues.push(`❌ ${type} message test error: ${error.message}`);
      }
    }

    return NextResponse.json({
      success: issues.length === 0,
      user: {
        email: ashleyEmail,
        phone: ashleyPhone,
        user_id: ashleyUserId,
        slicktext_contact_id: slicktextContactId
      },
      verification_results: {
        plaid_items: items?.length || 0,
        merchant_tracking: merchantCount,
        category_tracking: categoryCount,
        sms_settings_configured: smsSettings?.length > 0
      },
      message_test_results: testResults,
      issues: issues,
      fixes_applied: fixes,
      summary: issues.length === 0 
        ? '✅ Ashley is fully configured for SMS delivery' 
        : `❌ ${issues.length} issue(s) found, ${fixes.length} fix(es) applied`
    });

  } catch (error) {
    console.error('Error verifying Ashley SMS setup:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 });
  }
}
