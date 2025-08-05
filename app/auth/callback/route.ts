import { createSupabaseClient } from "@/utils/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const error_description = searchParams.get("error_description");
  const next = searchParams.get("next") ?? "/protected";

  // Handle explicit errors from email provider
  if (error) {
    console.error('Auth callback error:', { error, error_description });
    return NextResponse.redirect(
      `${origin}/auth/verification-error?error=${encodeURIComponent(error)}&description=${encodeURIComponent(error_description || 'Unknown error')}`
    );
  }

  // No code provided - redirect to verification error page
  if (!code) {
    console.warn('Auth callback: No verification code provided');
    return NextResponse.redirect(
      `${origin}/auth/verification-error?error=missing_code&description=${encodeURIComponent('No verification code provided')}`
    );
  }

  try {
    console.log('🔐 Processing email verification...');
    
    const client = await createSupabaseClient();
    const { data: session, error: exchangeError } = await client.auth.exchangeCodeForSession(code);
    
    if (exchangeError) {
      console.error('Auth exchange error:', exchangeError);
      
      // Handle specific error types with better user messaging
      if (exchangeError.message?.includes('expired')) {
        return NextResponse.redirect(
          `${origin}/auth/verification-error?error=expired&description=${encodeURIComponent('Your verification link has expired. Please sign up again.')}`
        );
      }
      
      if (exchangeError.message?.includes('invalid')) {
        return NextResponse.redirect(
          `${origin}/auth/verification-error?error=invalid&description=${encodeURIComponent('Invalid verification link. Please try signing up again.')}`
        );
      }
      
      // Generic error
      return NextResponse.redirect(
        `${origin}/auth/verification-error?error=exchange_failed&description=${encodeURIComponent(exchangeError.message || 'Failed to verify your account')}`
      );
    }

    if (!session?.user) {
      console.error('Auth callback: No user session after successful exchange');
      return NextResponse.redirect(
        `${origin}/auth/verification-error?error=no_session&description=${encodeURIComponent('Verification succeeded but failed to create session')}`
      );
    }

    console.log('✅ Email verification successful for user:', session.user.id);

    // Set up user data after successful verification
    await setupNewUser(session.user);

    // Successful verification - redirect to protected area with success message
    const successUrl = `${origin}/protected?verified=true`;
    console.log('🚀 Redirecting to:', successUrl);
    console.log('🔍 Origin:', origin);
    console.log('🔍 Next param:', next);
    
    return NextResponse.redirect(successUrl);

  } catch (error) {
    console.error('Auth callback unexpected error:', error);
    return NextResponse.redirect(
      `${origin}/auth/verification-error?error=unexpected&description=${encodeURIComponent('An unexpected error occurred during verification')}`
    );
  }
}

/**
 * Set up new user data after successful email verification
 */
async function setupNewUser(user: { id: string; user_metadata?: { sampleSmsToken?: string } }) {
  try {
    console.log('🛠️ Setting up new user:', user.id);
    
    // Create admin Supabase client for user setup
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Create default SMS settings
    const { error: smsError } = await supabase
      .from('user_sms_settings')
      .insert({
        user_id: user.id,
        send_time: '14:00', // 2:00 PM EST default
        phone_number: null // No phone number collected during signup
      })
      .select()
      .single();

    if (smsError && !smsError.message?.includes('duplicate')) {
      console.warn('SMS settings setup error:', smsError);
    } else {
      console.log('✅ SMS settings created for user');
    }

    // 2. Create default SMS preferences (all 4 types)
    const defaultPreferences = [
      { user_id: user.id, sms_type: 'bills', enabled: true, frequency: 'daily' },
      { user_id: user.id, sms_type: 'activity', enabled: true, frequency: 'daily' },
      { user_id: user.id, sms_type: 'merchant-pacing', enabled: true, frequency: 'daily' },
      { user_id: user.id, sms_type: 'category-pacing', enabled: true, frequency: 'daily' }
    ];

    const { error: prefsError } = await supabase
      .from('user_sms_preferences')
      .insert(defaultPreferences);

    if (prefsError && !prefsError.message?.includes('duplicate')) {
      console.warn('SMS preferences setup error:', prefsError);
    } else {
      console.log('✅ SMS preferences created for user');
    }

    // 3. Check for sample SMS lead conversion (tracking token match)
    if (user.user_metadata?.sampleSmsToken) {
      const { data: lead, error: leadError } = await supabase
        .from('sample_sms_leads')
        .select('*')
        .eq('tracking_token', user.user_metadata.sampleSmsToken)
        .eq('converted_to_signup', false)
        .single();

      if (!leadError && lead) {
        // Update the lead to mark as converted
        await supabase
          .from('sample_sms_leads')
          .update({
            converted_to_signup: true,
            conversion_date: new Date().toISOString(),
            user_id: user.id
          })
          .eq('id', lead.id);

        console.log('✅ Sample SMS lead converted via tracking token:', {
          leadId: lead.id,
          userId: user.id,
          trackingToken: user.user_metadata.sampleSmsToken,
          phoneNumber: lead.phone_number,
          daysToConversion: Math.floor((Date.now() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60 * 24))
        });
      }
    }

    // 4. Check for SlickText lead conversion (email match)
    if (user.email) {
      const { data: emailLeads, error: emailLeadError } = await supabase
        .from('sample_sms_leads')
        .select('*')
        .eq('email', user.email)
        .is('user_id', null) // Only unlinked leads
        .order('created_at', { ascending: false }); // Most recent first

      if (!emailLeadError && emailLeads && emailLeads.length > 0) {
        // Link all matching email leads to this user
        const leadIds = emailLeads.map(lead => lead.id);
        
        await supabase
          .from('sample_sms_leads')
          .update({
            user_id: user.id,
            converted_to_signup: true,
            conversion_date: new Date().toISOString()
          })
          .in('id', leadIds);

        console.log('✅ SlickText leads linked via email:', {
          email: user.email,
          userId: user.id,
          leadCount: emailLeads.length,
          leadIds: leadIds,
          sources: emailLeads.map(l => l.source),
          phones: emailLeads.map(l => l.phone_number)
        });
      }
    }

    console.log('🎉 New user setup completed successfully');

  } catch (error) {
    console.error('User setup error (non-blocking):', error);
    // Don't throw - user setup errors shouldn't block the auth flow
  }
} 