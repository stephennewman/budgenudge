import { NextRequest, NextResponse } from 'next/server';
import { createSlickTextClient } from '../../../utils/sms/slicktext-client';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { user_id, email, phone, first_name, last_name } = await request.json();
    
    if (!user_id || !email) {
      return NextResponse.json({ error: 'user_id and email are required' }, { status: 400 });
    }

    // Get phone number if not provided - check from user's SMS settings or auth.users
    let phoneNumber = phone;
    if (!phoneNumber) {
      // Try to get phone from user_sms_settings
      const { data: smsSettings } = await supabase
        .from('user_sms_settings')
        .select('phone_number')
        .eq('user_id', user_id)
        .single();
      
      if (smsSettings?.phone_number) {
        phoneNumber = smsSettings.phone_number;
      } else {
        // Try to get from auth.users
        const { data: authUser } = await supabase.auth.admin.getUserById(user_id);
        if (authUser.user?.phone) {
          phoneNumber = authUser.user.phone.replace(/^\+1/, ''); // Remove +1 prefix
        }
      }
    }

    if (!phoneNumber) {
      return NextResponse.json({
        success: true,
        message: 'User has no phone number - SlickText subscription skipped',
        user_id
      });
    }

    // Clean phone number and handle various formats
    let cleanPhone = phoneNumber.replace(/\D/g, '');
    
    // Handle different phone number formats
    if (cleanPhone.length === 11 && cleanPhone.startsWith('1')) {
      // Remove leading 1 from US numbers (e.g., 16173472721 -> 6173472721)
      cleanPhone = cleanPhone.substring(1);
    }
    
    if (cleanPhone.length !== 10) {
      return NextResponse.json({
        success: false,
        error: 'Invalid phone number format',
        phone: cleanPhone,
        original: phoneNumber
      }, { status: 400 });
    }

    // Create SlickText client and add contact
    const slickTextClient = createSlickTextClient();
    
    const contactData = {
      phone_number: cleanPhone,
      first_name: first_name || 'Krezzo',
      last_name: last_name || 'User', 
      email: email,
      opt_in_source: 'User Registration - BudgeNudge',
      list_ids: [], // Add to default lists
      custom_fields: {
        user_id: user_id,
        registration_date: new Date().toISOString(),
        source: 'webapp_signup'
      }
    };

    const result = await slickTextClient.createContact(contactData);
    
    if (result.success) {
      // Log this activity in our database for tracking
      await supabase
        .from('sample_sms_leads')
        .upsert({
          phone_number: cleanPhone,
          email: email,
          first_name: first_name || 'Krezzo',
          last_name: last_name || 'User',
          source: 'webapp_signup_to_slicktext',
          tracking_token: `slicktext_subscriber_${user_id}`,
          opted_in_at: new Date().toISOString(),
          converted_to_signup: true,
          conversion_date: new Date().toISOString()
        }, { 
          onConflict: 'phone_number,email',
          ignoreDuplicates: true 
        });

      return NextResponse.json({
        success: true,
        message: 'User successfully added to SlickText',
        user_id,
        slicktext_contact_id: result.data?.contact_id || result.messageId,
        phone: cleanPhone,
        email
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error || 'Failed to add user to SlickText',
        user_id,
        phone: cleanPhone
      }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ Error adding user to SlickText:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}