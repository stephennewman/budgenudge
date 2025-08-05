import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { user_id } = await request.json();
    
    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    }

    console.log('🔍 Debugging SlickText signup for user:', user_id);

    // Step 1: Get user data from auth.users
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(user_id);
    
    if (authError) {
      return NextResponse.json({
        error: 'Failed to get user data',
        authError: authError.message
      }, { status: 500 });
    }

    console.log('👤 User auth data:', {
      id: authUser.user?.id,
      email: authUser.user?.email,
      phone: authUser.user?.phone,
      user_metadata: authUser.user?.user_metadata
    });

    // Step 2: Check SMS settings
    const { data: smsSettings } = await supabase
      .from('user_sms_settings')
      .select('*')
      .eq('user_id', user_id)
      .single();

    console.log('📱 SMS settings:', smsSettings);

    // Step 3: Try to add to SlickText manually
    if (authUser.user?.email) {
      const phoneNumber = authUser.user?.phone || smsSettings?.phone_number;
      const firstName = authUser.user?.user_metadata?.firstName || 'User';
      const lastName = authUser.user?.user_metadata?.lastName || 'Account';

      console.log('📋 Data being sent to SlickText:', {
        user_id: user_id,
        email: authUser.user.email,
        phone: phoneNumber,
        first_name: firstName,
        last_name: lastName
      });

      // Call the actual SlickText API
      const slickTextResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/add-user-to-slicktext`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user_id,
          email: authUser.user.email,
          phone: phoneNumber,
          first_name: firstName,
          last_name: lastName
        })
      });

      const slickTextResult = await slickTextResponse.json();
      
      return NextResponse.json({
        success: true,
        userAuthData: {
          id: authUser.user?.id,
          email: authUser.user?.email,
          phone: authUser.user?.phone,
          user_metadata: authUser.user?.user_metadata
        },
        smsSettings,
        slickTextResponse: {
          status: slickTextResponse.status,
          ok: slickTextResponse.ok,
          result: slickTextResult
        },
        dataBeingSent: {
          user_id: user_id,
          email: authUser.user.email,
          phone: phoneNumber,
          first_name: firstName,
          last_name: lastName
        }
      });
    }

    return NextResponse.json({
      error: 'No email found for user',
      userAuthData: authUser.user
    }, { status: 400 });

  } catch (error) {
    console.error('❌ Debug SlickText signup error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}