import { createSupabaseClient } from "@/utils/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { notifySlackNewUserSignup } from "@/utils/slack/notifications";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const error_description = searchParams.get("error_description");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    return NextResponse.redirect(
      `${origin}/auth/verification-error?error=missing_code&description=${encodeURIComponent('No verification code provided')}`
    );
  }

  try {
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

    // Set up user data after successful verification
    await setupNewUser(session.user);

    // Successful verification - redirect to protected area with success message
    const successUrl = `${origin}/protected?verified=true`;
    
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
      // Non-blocking: continue setup
    }

    // 2. Create default SMS preferences (only 3 types enabled)
    const defaultPreferences = [
      { user_id: user.id, sms_type: 'bills', enabled: false, frequency: 'daily' },
      { user_id: user.id, sms_type: 'activity', enabled: false, frequency: 'daily' },
      { user_id: user.id, sms_type: 'merchant-pacing', enabled: false, frequency: 'daily' },
      { user_id: user.id, sms_type: 'category-pacing', enabled: false, frequency: 'daily' },
      { user_id: user.id, sms_type: 'weekly-summary', enabled: true, frequency: 'daily' },
      { user_id: user.id, sms_type: 'monthly-summary', enabled: true, frequency: 'daily' },
      { user_id: user.id, sms_type: '415pm-special', enabled: true, frequency: 'daily' }
    ];

    const { error: prefsError } = await supabase
      .from('user_sms_preferences')
      .insert(defaultPreferences);

    if (prefsError && !prefsError.message?.includes('duplicate')) {
      // Non-blocking: continue setup
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

      }
    }

    // 4. Check for SlickText lead conversion (email match)
    // Get user's email from Supabase auth
    const { data: authUser, error: authUserError } = await supabase.auth.admin.getUserById(user.id);
    
    if (!authUserError && authUser.user?.email) {
      const { data: emailLeads, error: emailLeadError } = await supabase
        .from('sample_sms_leads')
        .select('*')
        .eq('email', authUser.user.email)
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

        // Update user's phone number if not already set and we have phone data
        const phoneNumbers = emailLeads.map(l => l.phone_number).filter(Boolean);
        if (phoneNumbers.length > 0) {
          const mostRecentPhone = emailLeads[0].phone_number; // Most recent lead's phone
          
          if (mostRecentPhone) {
            const formattedPhone = `+1${mostRecentPhone}`;
            
            try {
              // Update auth.users phone field - requires admin client
              const { error: phoneUpdateError } = await supabase.auth.admin.updateUserById(
                user.id,
                { 
                  phone: formattedPhone // Format as E.164
                }
              );

              if (phoneUpdateError) {
                // Non-blocking: continue
              }
            } catch {
              // Non-blocking: continue
            }

            // Also update SMS settings table with phone number for SMS delivery
            try {
              const { error: smsPhoneError } = await supabase
                .from('user_sms_settings')
                .update({ phone_number: mostRecentPhone }) // Store raw number for SMS
                .eq('user_id', user.id);

              if (smsPhoneError) {
                // Non-blocking: continue
              }
            } catch {
              // Non-blocking: continue
            }
          }
        }

      }
    }

    // 5. Handle signup phone number (now required) - MUST BE DONE BEFORE SLICKTEXT
    let updatedPhone = null;
    try {
      const { data: authUser } = await supabase.auth.admin.getUserById(user.id);
      const signupPhone = authUser.user?.user_metadata?.signupPhone;
      
      if (signupPhone && signupPhone.length >= 10) {
        // Update auth.users with phone number
        const formattedPhone = `+1${signupPhone}`;
        await supabase.auth.admin.updateUserById(user.id, { phone: formattedPhone });
        updatedPhone = formattedPhone;
        
        // Also store in SMS settings
        await supabase
          .from('user_sms_settings')
          .upsert({ 
            user_id: user.id, 
            phone_number: signupPhone 
          });
        
      }
    } catch {
      // Non-blocking: continue
    }

    // 6. Send welcome text message to new user
    if (updatedPhone && updatedPhone.length > 5) {
      try {
        const { sendUnifiedSMS } = await import('../../../utils/sms/unified-sms');
        const { data: authUser } = await supabase.auth.admin.getUserById(user.id);
        const firstName = authUser.user?.user_metadata?.firstName || 'there';
        
        const welcomeMessage = `🎉 Welcome to Krezzo, ${firstName}! 

Your financial awareness journey starts now. Once you connect your bank account, you'll get daily insights that actually matter.

Ready to explore? Text these commands:
💡 "help" - See all available commands
💰 "balance" - Check your account
🛑 "stop" - Pause texts anytime

Or just ask me questions about your money - I'm here to help!

Connect your bank account in the app to unlock these insights!`;

        const smsResult = await sendUnifiedSMS({
          phoneNumber: updatedPhone.replace('+1', ''),
          message: welcomeMessage,
          userId: user.id,
          userEmail: authUser.user?.email,
          context: 'welcome_new_user'
        });

        if (!smsResult.success) {
          // Non-blocking: continue
        }
      } catch {
        // Non-blocking: continue
      }
    }

    // 7. Add user to SlickText as subscriber (optional)
    // This creates a feedback loop: SlickText leads → auth users → SlickText subscribers
    try {
      const { data: authUser } = await supabase.auth.admin.getUserById(user.id);
      if (authUser.user?.email) {
        // Use the updated phone number or fallback to what's in the database
        const phoneForSlickText = updatedPhone || authUser.user.phone;
        
        const slickTextResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/add-user-to-slicktext`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: user.id,
            email: authUser.user.email,
            phone: phoneForSlickText,
            first_name: authUser.user.user_metadata?.firstName || authUser.user.user_metadata?.full_name?.split(' ')[0] || authUser.user.user_metadata?.first_name || 'User',
            last_name: authUser.user.user_metadata?.lastName || authUser.user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || authUser.user.user_metadata?.last_name || 'Account'
          })
        });

        await slickTextResponse.json();

        if (!slickTextResponse.ok) {
          // Non-blocking: continue
        }
      }
    } catch {
      // Non-blocking: User setup continues even if SlickText subscription fails
    }

    // 7. Send Slack notification for new signup (non-blocking)
    try {
      const { data: authUser } = await supabase.auth.admin.getUserById(user.id);
      if (authUser.user) {
        await notifySlackNewUserSignup({
          id: user.id,
          email: authUser.user.email || undefined,
          phone: authUser.user.phone || updatedPhone || undefined,
          firstName: authUser.user.user_metadata?.firstName || authUser.user.user_metadata?.first_name,
          lastName: authUser.user.user_metadata?.lastName || authUser.user.user_metadata?.last_name,
          signupSource: authUser.user.user_metadata?.sampleSmsToken ? 'SMS Lead Conversion' : 'Direct Signup',
          conversionSource: authUser.user.user_metadata?.sampleSmsToken ? `Tracking Token: ${authUser.user.user_metadata.sampleSmsToken}` : undefined
        });
      }
    } catch {
      // Non-blocking: User setup continues even if Slack notification fails
    }

  } catch (error) {
    console.error('User setup error (non-blocking):', error);
    // Don't throw - user setup errors shouldn't block the auth flow
  }
} 