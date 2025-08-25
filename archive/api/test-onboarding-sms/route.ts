import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    // For testing: Accept email to lookup user
    const { email, phoneNumber } = await request.json();
    
    if (!email) {
      return NextResponse.json({ error: 'Email required for testing' }, { status: 400 });
    }

    // Create Supabase client with service role for testing
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Lookup user by email in auth.users
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      return NextResponse.json({ error: 'Error fetching users: ' + usersError.message }, { status: 500 });
    }
    
    const foundUser = users.find(u => u.email === email);
    
    if (!foundUser) {
      return NextResponse.json({ error: 'User not found with email: ' + email }, { status: 404 });
    }
    
    const user = { id: foundUser.id };

    console.log(`🧪 Testing onboarding SMS sequence for user: ${user.id}`);

    // Get user data for testing
    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: authUser } = await serviceSupabase.auth.admin.getUserById(user.id);
    
    // Use phone number from request parameter (for testing) or fallback to database
    let userPhone = phoneNumber || foundUser.phone || authUser.user?.phone || authUser.user?.user_metadata?.signupPhone;
    
    // Also check user_sms_settings table as fallback
    if (!userPhone) {
      const { data: smsSettings } = await serviceSupabase
        .from('user_sms_settings')
        .select('phone_number')
        .eq('user_id', user.id)
        .single();
      
      userPhone = smsSettings?.phone_number;
    }

    if (!userPhone || userPhone.length < 10) {
      return NextResponse.json({
        error: 'No valid phone number found for user',
        userId: user.id,
        phoneCheck: {
          userPhone: authUser.user?.phone || null,
          metadataPhone: authUser.user?.user_metadata?.signupPhone || null,
          smsSettingsChecked: !userPhone
        }
      }, { status: 400 });
    }

    console.log(`📱 Found phone number for testing: ${userPhone.slice(-4)}`);

    // Call the onboarding SMS sequence
    const onboardingResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/onboarding-sms-sequence`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: user.id,
        phoneNumber: userPhone,
        firstName: authUser.user?.user_metadata?.firstName || authUser.user?.user_metadata?.first_name || 'Test User'
      })
    });

    if (!onboardingResponse.ok) {
      const errorText = await onboardingResponse.text();
      return NextResponse.json({
        error: 'Failed to start onboarding sequence',
        status: onboardingResponse.status,
        details: errorText
      }, { status: 500 });
    }

    const onboardingResult = await onboardingResponse.json();

    return NextResponse.json({
      success: true,
      message: 'Onboarding SMS sequence initiated successfully',
      userId: user.id,
      phoneNumber: `***${userPhone.slice(-4)}`,
      sequenceId: onboardingResult.sequenceId,
      results: onboardingResult.results,
      summary: onboardingResult.summary,
      instructions: {
        immediate: 'Check your phone for the immediate welcome message',
        upcoming: 'Analysis complete message scheduled for ~8 minutes',
        dayBefore: 'Day-before message scheduled for this evening at 6 PM',
        monitoring: 'Check /api/onboarding-sms-sequence via GET to process scheduled messages'
      }
    });

  } catch (error) {
    console.error('❌ Error testing onboarding SMS:', error);
    return NextResponse.json(
      { 
        error: 'Failed to test onboarding sequence',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check user's SMS setup for testing
 */
export async function GET(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized - Missing token' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Create Supabase client and get user with token
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user data for analysis
    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: authUser } = await serviceSupabase.auth.admin.getUserById(user.id);
    
    // Check all phone number sources
    const phoneCheck = {
      userPhone: authUser.user?.phone || null,
      metadataSignupPhone: authUser.user?.user_metadata?.signupPhone || null,
      metadataPhone: authUser.user?.user_metadata?.phone || null
    };

    // Check user_sms_settings
    const { data: smsSettings } = await serviceSupabase
      .from('user_sms_settings')
      .select('phone_number, send_time')
      .eq('user_id', user.id)
      .single();

    // Check if user has connected accounts
    const { data: items } = await serviceSupabase
      .from('items')
      .select('id, plaid_item_id, institution_name')
      .eq('user_id', user.id)
      .is('deleted_at', null);

    // Check for any existing onboarding sequences
    const { data: existingSequences } = await serviceSupabase
      .from('scheduled_onboarding_sms')
      .select('sequence_id, status, template_type, scheduled_at, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);

    const finalPhone = phoneCheck.userPhone || phoneCheck.metadataSignupPhone || smsSettings?.phone_number;

    return NextResponse.json({
      userId: user.id,
      userEmail: authUser.user?.email,
      firstName: authUser.user?.user_metadata?.firstName || authUser.user?.user_metadata?.first_name,
      phoneCheck: phoneCheck,
      smsSettings: smsSettings,
      finalPhone: finalPhone ? `***${finalPhone.slice(-4)}` : null,
      phoneValid: finalPhone && finalPhone.length >= 10,
      connectedAccounts: items?.length || 0,
      accounts: items?.map(item => ({ 
        id: item.id, 
        institution: item.institution_name 
      })) || [],
      existingOnboardingSequences: existingSequences?.length || 0,
      lastSequence: existingSequences?.[0] || null,
      readyForTest: finalPhone && finalPhone.length >= 10 && (items?.length || 0) > 0
    });

  } catch (error) {
    console.error('❌ Error checking onboarding SMS setup:', error);
    return NextResponse.json(
      { 
        error: 'Failed to check setup',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
