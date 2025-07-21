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
    const successUrl = `${origin}${next}?verified=true`;
    console.log('🚀 Redirecting to:', successUrl);
    
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
async function setupNewUser(user: { id: string; user_metadata?: { phone?: string } }) {
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
        phone_number: user.user_metadata?.phone || null
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

    console.log('🎉 New user setup completed successfully');

  } catch (error) {
    console.error('User setup error (non-blocking):', error);
    // Don't throw - user setup errors shouldn't block the auth flow
  }
} 