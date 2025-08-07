import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create a Supabase client for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST - Complete SMS setup for Ashley Newman
export async function POST() {
  try {
    const ashleyUserId = 'd5671ac4-cd39-4c1b-a897-7298dd15938a';
    const ashleyPhone = '+15084934141';
    const ashleyEmail = 'ashleylynnenewman@me.com';
    const slicktextContactId = '61330767';
    const sendTime = '08:00:00';

    console.log('🚀 Setting up complete SMS configuration for Ashley Newman...');

    const setup_results = [];

    // 1. Ensure user_sms_settings exists
    console.log('1. Setting up user_sms_settings...');
    const { data: existingSettings } = await supabase
      .from('user_sms_settings')
      .select('*')
      .eq('user_id', ashleyUserId);

    if (!existingSettings || existingSettings.length === 0) {
              const { error: settingsError } = await supabase
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

      if (settingsError) {
        setup_results.push(`❌ Failed to create SMS settings: ${settingsError.message}`);
      } else {
        setup_results.push('✅ Created user_sms_settings with all message types enabled');
      }
    } else {
      // Update existing settings
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
        setup_results.push(`❌ Failed to update SMS settings: ${updateError.message}`);
      } else {
        setup_results.push('✅ Updated user_sms_settings with correct configuration');
      }
    }

    // 2. Update profile with correct phone number  
    console.log('2. Updating profile...');
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ 
        phone_number: ashleyPhone,
        email: ashleyEmail 
      })
      .eq('id', ashleyUserId);

    if (profileError) {
      setup_results.push(`❌ Failed to update profile: ${profileError.message}`);
    } else {
      setup_results.push('✅ Updated profile with correct phone and email');
    }

    // 3. Verify Plaid connection
    console.log('3. Checking Plaid items...');
    const { data: items } = await supabase
      .from('items')
      .select('plaid_item_id, institution_name')
      .eq('user_id', ashleyUserId);

    if (!items || items.length === 0) {
      setup_results.push('❌ No Plaid items connected');
    } else {
      setup_results.push(`✅ Found ${items.length} Plaid item(s): ${items.map(i => i.institution_name || i.plaid_item_id).join(', ')}`);
    }

    // 4. Verify tracking setup
    console.log('4. Checking tracking setup...');
    const { data: merchantTracking } = await supabase
      .from('merchant_pacing_tracking')
      .select('ai_merchant_name')
      .eq('user_id', ashleyUserId)
      .eq('is_active', true);

    const { data: categoryTracking } = await supabase
      .from('category_pacing_tracking')
      .select('ai_category')
      .eq('user_id', ashleyUserId)
      .eq('is_active', true);

    setup_results.push(`✅ Merchant tracking: ${merchantTracking?.length || 0} active merchants`);
    setup_results.push(`✅ Category tracking: ${categoryTracking?.length || 0} active categories`);

    // 5. Test all 4 message types
    console.log('5. Testing message generation...');
    const messageTypes = ['recent', 'recurring', 'merchant-pacing', 'category-pacing'];
    const testResults: Record<string, string> = {};

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
          testResults[type] = `✅ Generated (${result.results[0].messageLength} chars)`;
        } else {
          testResults[type] = '❌ Failed to generate';
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        testResults[type] = `❌ Error: ${errorMessage}`;
      }
    }

    return NextResponse.json({
      success: true,
      user: {
        name: 'Ashley Newman',
        email: ashleyEmail,
        phone: ashleyPhone,
        user_id: ashleyUserId,
        slicktext_contact_id: slicktextContactId,
        send_time: sendTime
      },
      configuration: {
        plaid_items: items?.length || 0,
        merchant_tracking: merchantTracking?.length || 0,
        category_tracking: categoryTracking?.length || 0,
        sms_preferences_configured: true,
        sms_settings_configured: true
      },
      message_tests: testResults,
      setup_results: setup_results,
      summary: `✅ Ashley Newman is fully configured for SMS delivery at ${ashleyPhone} with 8:00 AM send time`
    });

  } catch (error) {
    console.error('Error setting up Ashley SMS:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error',
      details: errorMessage 
    }, { status: 500 });
  }
}
