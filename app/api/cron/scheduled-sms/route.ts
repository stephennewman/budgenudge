import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateSMSMessage } from '@/utils/sms/templates';
import { sendEnhancedSlickTextSMS } from '@/utils/sms/slicktext-client';
import { DateTime } from 'luxon';
import { SupabaseClient } from '@supabase/supabase-js';
import { checkAndLogSMS, SMSTemplateType } from '@/utils/sms/deduplication';

type NewSMSTemplateType = SMSTemplateType;

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

  // ✅ FIX: Use service role authentication for cron jobs (no user sessions)
  const supabase: SupabaseClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

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

    // ===================================
    // ONBOARDING SMS PROCESSING: DISABLED
    // ===================================
    // try {
    //   console.log('🎯 Processing scheduled onboarding messages...');
    //   const onboardingResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/onboarding-sms-sequence`, {
    //     method: 'GET'
    //   });

    //   if (onboardingResponse.ok) {
    //     const onboardingResult = await onboardingResponse.json();
    //     console.log('✅ Onboarding messages processed:', onboardingResult.summary);
    //     logDetails.push({
    //       onboarding_processed: onboardingResult.processed || 0,
    //       onboarding_sent: onboardingResult.summary?.sent || 0,
    //       onboarding_failed: onboardingResult.summary?.failed || 0
    //     });
    //   } else {
    //     console.log('⚠️ Failed to process onboarding messages:', onboardingResponse.status);
    //     logDetails.push({ onboarding_error: `HTTP ${onboardingResponse.status}` });
    //   }
    // } catch (onboardingError) {
    //   console.error('❌ Error processing onboarding messages:', onboardingError);
    //   logDetails.push({ 
    //     onboarding_error: onboardingError instanceof Error ? onboardingError.message : 'Unknown error' 
    //   });
    // }
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
      .select('id, user_id, plaid_item_id')
      .is('deleted_at', null);

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

    // Get current time in EST
    const nowEST = DateTime.now().setZone('America/New_York');
    
    // Determine which templates to send based on day and time
    let templatesToSend: NewSMSTemplateType[] = [];
    
    // Monthly Summary: DISABLED - was 1st of month at 7am EST
    // const isMonthlySummaryTime = nowEST.day === 1 && nowEST.hour === 7 && nowEST.minute <= 10;
    
    // Weekly Summary: DISABLED - was Sunday at 7am EST  
    // const isWeeklySummaryTime = nowEST.weekday === 7 && nowEST.hour === 7 && nowEST.minute <= 10;
    
    // Cash Flow Runway: DISABLED - was daily at 5pm EST (replaced by Krezzo Report)
    // const isCashFlowRunwayTime = nowEST.hour === 17 && nowEST.minute <= 10;
    
    // ✅ DISABLED: Only Krezzo Report at 5:00 PM is active now
    // All other templates are disabled to avoid SMS spam
    // Daily templates: DISABLED (recurring, recent, merchant-pacing, category-pacing)
    templatesToSend = [];
    
    // Monthly Summary: DISABLED
    // if (isMonthlySummaryTime) {
    //   console.log('📊 1st of month 7am: Adding monthly summary to template list');
    //   templatesToSend.push('monthly-summary');
    // }
    
    // Weekly Summary: DISABLED
    // if (isWeeklySummaryTime) {
    //   console.log('📊 Sunday 7am: Adding weekly summary to template list');
    //   templatesToSend.push('weekly-summary');
    // }

    // Cash Flow Runway: DISABLED (replaced by Krezzo Report)
    // if (isCashFlowRunwayTime) {
    //   console.log('🛤️ 5pm: Adding cash-flow-runway to template list');
    //   templatesToSend.push('cash-flow-runway');
    // }

    console.log(`📝 Templates to send: ${templatesToSend.join(', ')}`);

    // Process each user
    for (const userItem of itemsWithUsers) {
      try {
        const userId = userItem.user_id;
        usersProcessed++;

        // Fetch user's SMS settings (send_time) and phone number
        let sendTime = '14:00'; // Default to 2:00 PM EST
        let userPhoneNumber: string | null = null;
        
        // Get both send_time and phone_number in a single query
        const { data: settings, error: settingsError } = await supabase
          .from('user_sms_settings')
          .select('send_time, phone_number')
          .eq('user_id', userId)
          .single();
        
        if (settingsError) {
          console.log(`⚠️ Error fetching settings for user ${userId}:`, settingsError);
        }
        
        if (settings) {
          sendTime = settings.send_time || '14:00';
          userPhoneNumber = settings.phone_number;
          
          if (userPhoneNumber) {
            console.log(`📱 Found phone number for user ${userId}: ${userPhoneNumber}`);
          } else {
            console.log(`📭 No phone number found for user ${userId}`);
          }
        } else {
          console.log(`📭 No settings found for user ${userId}`);
        }

        // Skip users without phone numbers
        if (!userPhoneNumber || userPhoneNumber.trim() === '') {
          logDetails.push({ userId, skipped: true, reason: 'No phone number in user_sms_settings' });
          console.log(`📭 Skipping user ${userId} (no phone number in user_sms_settings)`);
          continue;
        }

        // ✅ FIX: Handle both special templates (monthly/weekly) and daily templates
        const specialTemplates = ['monthly-summary', 'weekly-summary', 'cash-flow-runway'];
        const dailyTemplates = ['recurring', 'recent', 'merchant-pacing', 'category-pacing'];
        
        const hasSpecialTemplates = templatesToSend.some(t => specialTemplates.includes(t));
        const hasDailyTemplates = templatesToSend.some(t => dailyTemplates.includes(t));
        
        let shouldProcessUser = false;
        
        // Check if we should send special templates (monthly/weekly summaries - sent at 7am EST regardless of user preference)
        if (hasSpecialTemplates) {
          console.log(`📊 Processing special templates for user ${userId}`);
          shouldProcessUser = true;
        }
        
        // Check if we should send daily templates (based on user's preferred send_time)
        if (hasDailyTemplates) {
          const [sendHour, sendMinute] = sendTime.split(':').map(Number);
          const sendTimeMinutes = sendHour * 60 + sendMinute;
          const nowMinutes = nowEST.hour * 60 + nowEST.minute;
          const timeDifferenceMinutes = Math.abs(nowMinutes - sendTimeMinutes);

          // Handle day boundary (e.g., if send time is 23:50 and current is 00:05)
          const timeDifferenceMinutesAlt = 1440 - timeDifferenceMinutes; // 1440 = minutes in a day
          const actualTimeDifference = Math.min(timeDifferenceMinutes, timeDifferenceMinutesAlt);

          if (actualTimeDifference <= 10) {
            console.log(`⏰ ✅ Daily template time check passed for user ${userId} (send time: ${sendTime} EST, current: ${nowEST.hour}:${nowEST.minute.toString().padStart(2, '0')} EST, difference: ${actualTimeDifference} minutes)`);
            shouldProcessUser = true;
          } else {
            console.log(`⏰ Daily templates not at send time for user ${userId} (send time: ${sendTime} EST, current: ${nowEST.hour}:${nowEST.minute.toString().padStart(2, '0')} EST, difference: ${actualTimeDifference} minutes)`);
          }
        }
        
        if (!shouldProcessUser) {
          logDetails.push({ userId, skipped: true, reason: `No templates ready: daily templates not at send time (${sendTime} EST), no special templates scheduled` });
          console.log(`⏰ Skipping user ${userId} - no templates ready to send`);
          continue;
        }

        // ✅ FIX: Filter templates for this specific user based on timing
        const userTemplatesToSend: NewSMSTemplateType[] = [];
        
        // Add special templates if they're scheduled (monthly/weekly summaries at 7am EST)
        if (hasSpecialTemplates) {
          userTemplatesToSend.push(...templatesToSend.filter(t => specialTemplates.includes(t)));
        }
        
        // Add daily templates only if it's the user's send time
        if (hasDailyTemplates) {
          const [sendHour, sendMinute] = sendTime.split(':').map(Number);
          const sendTimeMinutes = sendHour * 60 + sendMinute;
          const nowMinutes = nowEST.hour * 60 + nowEST.minute;
          const timeDifferenceMinutes = Math.abs(nowMinutes - sendTimeMinutes);
          const timeDifferenceMinutesAlt = 1440 - timeDifferenceMinutes;
          const actualTimeDifference = Math.min(timeDifferenceMinutes, timeDifferenceMinutesAlt);
          
          if (actualTimeDifference <= 10) {
            userTemplatesToSend.push(...templatesToSend.filter(t => dailyTemplates.includes(t)));
          }
        }

        console.log(`📱 Processing user ${userId} (${usersProcessed}/${itemsWithUsers.length}) - User Templates: ${userTemplatesToSend.join(', ')}`);

        // Send each template type for this user
        for (const templateType of userTemplatesToSend) {
          let dedupeResult: Awaited<ReturnType<typeof checkAndLogSMS>> | null = null; // Declare outside try block for catch access
          try {
            // Check if user has enabled this specific SMS type
            let preferenceType: string;
            switch (templateType) {
              case 'recurring':
                preferenceType = 'bills';
                break;
              case 'recent':
                preferenceType = 'activity';
                break;
              case 'merchant-pacing':
                preferenceType = 'merchant-pacing';
                break;
              case 'category-pacing':
                preferenceType = 'category-pacing';
                break;
              case 'weekly-summary':
                preferenceType = 'weekly-summary';
                break;
              case 'monthly-summary':
                preferenceType = 'monthly-summary';
                break;
              case 'cash-flow-runway':
                preferenceType = 'cash-flow-runway';
                break;
              default:
                preferenceType = templateType;
            }

            const { data: templatePref } = await supabase
              .from('user_sms_preferences')
              .select('enabled')
              .eq('user_id', userId)
              .eq('sms_type', preferenceType)
              .single();
            
            const isEnabledByDefault = preferenceType === 'cash-flow-runway';
            const enabled = templatePref ? !!templatePref.enabled : isEnabledByDefault;
            if (!enabled) {
              console.log(`📭 Skipping ${templateType} for user ${userId} (disabled in preferences)`);
              continue;
            }

            // ✅ GUARDRAIL: Check deduplication using new unified system
            dedupeResult = await checkAndLogSMS({
              phoneNumber: userPhoneNumber,
              templateType,
              userId,
              sourceEndpoint: 'scheduled',
              success: true // We'll update this after actual send
            });
            
            if (!dedupeResult.canSend) {
              logDetails.push({ 
                userId, 
                templateType, 
                skipped: true, 
                reason: `Deduplication prevented send: ${dedupeResult.reason}`,
                logId: dedupeResult.logId 
              });
              console.log(`🚫 Skipping ${templateType} for user ${userId} - ${dedupeResult.reason}`);
              continue;
            }
            
            console.log(`✅ Deduplication check passed for ${templateType} (log ID: ${dedupeResult.logId})`);

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
              logDetails.push({ 
                userId, 
                templateType, 
                sent: true, 
                preview: smsMessage.substring(0, 100),
                logId: dedupeResult.logId,
                messageId: smsResult.messageId
              });
              console.log(`✅ ${templateType} SMS sent successfully to user ${userId} (log ID: ${dedupeResult.logId})`);
            } else {
              smsFailed++;
              logDetails.push({ 
                userId, 
                templateType, 
                sent: false, 
                error: smsResult.error,
                logId: dedupeResult.logId
              });
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
            logDetails.push({ userId, templateType, error: errorMsg, logId: dedupeResult?.logId });
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
  const CRON_SECRET = process.env.CRON_SECRET;
  
  if (!isVercelCron && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // For manual testing, just call the GET method
  return GET(req);
} 