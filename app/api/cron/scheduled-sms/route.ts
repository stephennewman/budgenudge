import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/server';
import { generateSMSMessage } from '@/utils/sms/templates';
import { sendEnhancedSlickTextSMS } from '@/utils/sms/slicktext-client';
import { DateTime } from 'luxon';
import { SupabaseClient } from '@supabase/supabase-js';

type NewSMSTemplateType = 'recurring' | 'recent' | 'pacing';

function hasMessage(obj: unknown): obj is { message: string } {
  return typeof obj === 'object' && obj !== null && 'message' in obj && typeof (obj as { message: unknown }).message === 'string';
}

export async function GET(request: NextRequest) {
  // Check authorization: allow Vercel cron or correct secret
  const isVercelCron = request.headers.get('x-vercel-cron');
  const authHeader = request.headers.get('authorization');
  const CRON_SECRET = process.env.CRON_SECRET;
  if (!isVercelCron && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // --- Persistent cron logging ---
  const cronJobName = 'scheduled-sms';
  const cronStart = new Date();
  let cronLogId: number | null = null;
  let usersProcessed = 0;
  let smsAttempted = 0;
  let smsSent = 0;
  let smsFailed = 0;
  const logDetails: Array<Record<string, unknown>> = [];

  // Initialize supabase client at the top
  const supabase: SupabaseClient = await createSupabaseClient();

  try {
    // Insert cron_log row (status: started)
    const { data: logInsert } = await supabase
      .from('cron_log')
      .insert({
        job_name: cronJobName,
        started_at: cronStart.toISOString(),
        status: 'started',
      })
      .select('id')
      .single();
    if (logInsert && logInsert.id) cronLogId = logInsert.id;
  } catch (e) {
    // If logging fails, continue anyway
    console.warn('⚠️ Could not insert cron_log row:', e);
  }

  try {
    console.log('🕐 Starting NEW SMS template processing...');
    
    // Get all users with bank connections
    console.log('DEBUG: About to query items table...');
    
    // Test query: count all rows
    const { count: totalItems, error: countError } = await supabase
      .from('items')
      .select('*', { count: 'exact', head: true });
    console.log('DEBUG: Total items count:', totalItems, 'countError:', countError);
    
    const { data: itemsWithUsers, error: itemsError } = await supabase
      .from('items')
      .select('id, user_id, plaid_item_id');

    // DEBUG LOGGING START
    console.log('DEBUG: itemsWithUsers:', itemsWithUsers);
    console.log('DEBUG: itemsError:', itemsError);
    console.log('DEBUG: Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log('DEBUG: Service Role Key present:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
    console.log('DEBUG: itemsWithUsers length:', itemsWithUsers?.length || 0);
    console.log('DEBUG: itemsWithUsers type:', typeof itemsWithUsers);
    // DEBUG LOGGING END

    if (itemsError || !itemsWithUsers || itemsWithUsers.length === 0) {
      console.log('📭 No bank connections found');
      // Update cron_log as success (no users)
      if (cronLogId) {
        await supabase.from('cron_log').update({
          finished_at: new Date().toISOString(),
          status: 'success',
          users_processed: 0,
          sms_attempted: 0,
          sms_sent: 0,
          sms_failed: 0,
          log_details: [{ message: 'No bank connections found' }]
        }).eq('id', cronLogId);
      }
      return NextResponse.json({ 
        success: true, 
        processed: 0,
        message: 'No bank connections found' 
      });
    }

    console.log(`👥 Found ${itemsWithUsers.length} users with bank connections`);

    // For now, send all 3 templates to all users (simplified approach)
    // Later this can be controlled by user preferences
    const templatesToSend: NewSMSTemplateType[] = ['recurring', 'recent', 'pacing'];
    
    // let successCount = 0;
    // let failureCount = 0;
    // let processedUsers = 0;

    // Get current time in EST
    const nowEST = DateTime.now().setZone('America/New_York');

    // Process each user
    for (const userItem of itemsWithUsers) {
      try {
        const userId = userItem.user_id;
        usersProcessed++;

        // Fetch user's SMS settings (send_time) and phone number from auth.users
        let sendTime = '18:00'; // Default to 6:00 PM
        let userPhoneNumber: string | null = null;
        
        // Get send_time from user_sms_settings
        const { data: settings } = await supabase
          .from('user_sms_settings')
          .select('send_time')
          .eq('user_id', userId)
          .single();
        if (settings && settings.send_time) {
          sendTime = settings.send_time;
        }

        // Get phone number from auth.users table
        const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
        if (userError) {
          console.error(`Error fetching user ${userId}:`, userError);
          logDetails.push({ userId, skipped: true, reason: 'Error fetching user data' });
          continue;
        }
        
        if (userData?.user?.user_metadata?.phone) {
          userPhoneNumber = userData.user.user_metadata.phone;
        }

        // Skip users without phone numbers
        if (!userPhoneNumber || userPhoneNumber.trim() === '') {
          logDetails.push({ userId, skipped: true, reason: 'No phone number in auth.users' });
          console.log(`📭 Skipping user ${userId} (no phone number in auth.users)`);
          continue;
        }
        // Only send if current time is within 10 minutes of send_time
        // TEMPORARILY DISABLED FOR TESTING
        /*
        if (Math.abs(nowMinutes - sendMinutes) > 10) {
          logDetails.push({ userId, skipped: true, reason: `Not their send time: ${sendTime} EST` });
          console.log(`⏰ Skipping user ${userId} (not their send time: ${sendTime} EST)`);
          continue;
        }
        */
        console.log(`⏰ TEMP: Bypassing time check for user ${userId} (send time: ${sendTime} EST, current: ${nowEST.hour}:${nowEST.minute} EST)`);
        // FORCE REDEPLOY - Time check is bypassed for testing - CACHE CLEAR

        console.log(`📱 Processing user ${userId} (${usersProcessed}/${itemsWithUsers.length}) at preferred send time (${sendTime} EST)`);

        // Send each template type
        for (const templateType of templatesToSend) {
          try {
            console.log(`📝 Generating ${templateType} SMS for user ${userId}`);
            
            // Generate message using new template system
            const smsMessage = await generateSMSMessage(userId, templateType);

            // Skip if message is too short or indicates an error
            if (!smsMessage || smsMessage.trim().length < 15 || smsMessage.includes('Error')) {
              logDetails.push({ userId, templateType, skipped: true, reason: 'Too short or error', preview: smsMessage });
              console.log(`📭 ${templateType} SMS too short or error for user ${userId} - skipping`);
              smsFailed++;
              continue;
            }
            smsAttempted++;

            console.log(`📱 Sending ${templateType} SMS to user ${userId}`);
            console.log(`📄 Message preview: ${smsMessage.substring(0, 100)}...`);

            // Send SMS using user's phone number
            const smsResult = await sendEnhancedSlickTextSMS({
              phoneNumber: userPhoneNumber,
              message: smsMessage,
              userId: userId
            });

            if (smsResult.success) {
              smsSent++;
              logDetails.push({ userId, templateType, sent: true, preview: smsMessage.substring(0, 100) });
              console.log(`✅ ${templateType} SMS sent successfully to user ${userId}`);
            } else {
              smsFailed++;
              logDetails.push({ userId, templateType, sent: false, error: smsResult.error });
              console.log(`❌ Failed to send ${templateType} SMS to user ${userId}:`, smsResult.error);
            }

            // Add small delay between SMS sends to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));

          } catch (smsError) {
            smsFailed++;
            let errorMsg = '';
            if (smsError instanceof Error) {
              errorMsg = smsError.message;
            } else if (hasMessage(smsError)) {
              errorMsg = smsError.message;
            } else {
              errorMsg = String(smsError);
            }
            logDetails.push({ userId, templateType, error: errorMsg });
            console.error(`❌ Error processing ${templateType} SMS for user ${userId}:`, smsError);
          }
        }

      } catch (userError) {
        let errorMsg = '';
        if (userError instanceof Error) {
          errorMsg = userError.message;
        } else if (hasMessage(userError)) {
          errorMsg = userError.message;
        } else {
          errorMsg = String(userError);
        }
        logDetails.push({ userId: userItem.user_id, error: errorMsg });
        console.error(`❌ Error processing user ${userItem.user_id}:`, userError);
      }
    }

    // --- Update cron_log as success ---
    if (cronLogId) {
      await supabase.from('cron_log').update({
        finished_at: new Date().toISOString(),
        status: 'success',
        users_processed: usersProcessed,
        sms_attempted: smsAttempted,
        sms_sent: smsSent,
        sms_failed: smsFailed,
        log_details: logDetails
      }).eq('id', cronLogId);
    }

    const result = {
      success: true,
      processed: smsSent + smsFailed,
      smsSent,
      smsFailed,
      usersProcessed,
      message: `Processed ${smsSent + smsFailed} SMS for ${usersProcessed} users`
    };

    console.log('📊 SMS Processing Complete:', result);
    return NextResponse.json(result);

  } catch (error) {
    // --- Update cron_log as error ---
    if (cronLogId && supabase) {
      await supabase.from('cron_log').update({
        finished_at: new Date().toISOString(),
        status: 'error',
        error_message: error instanceof Error ? error.message : String(error),
        users_processed: usersProcessed,
        sms_attempted: smsAttempted,
        sms_sent: smsSent,
        sms_failed: smsFailed,
        log_details: logDetails
      }).eq('id', cronLogId);
    }
    console.error('❌ Cron job error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Keep POST for manual testing
export async function POST(req: NextRequest) {
  const isVercelCron = req.headers.get('x-vercel-cron');
  const authHeader = req.headers.get('authorization');
  if (!isVercelCron && authHeader !== 'Bearer cron_secret_2024') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return GET(req);
} 