import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/server';
import { generateSMSMessage } from '@/utils/sms/templates';
import { sendEnhancedSlickTextSMS } from '@/utils/sms/slicktext-client';
import { DateTime } from 'luxon';

type NewSMSTemplateType = 'recurring' | 'recent' | 'pacing';

export async function GET(request: NextRequest) {
  // Check authorization
  const authHeader = request.headers.get('authorization');
  if (authHeader !== 'Bearer cron_secret_2024') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    console.log('🕐 Starting NEW SMS template processing...');
    
    const supabase = await createSupabaseClient();
    
    // Get all users with bank connections
    const { data: itemsWithUsers, error: itemsError } = await supabase
      .from('items')
      .select('id, user_id, plaid_item_id');

    if (itemsError || !itemsWithUsers || itemsWithUsers.length === 0) {
      console.log('📭 No bank connections found');
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
    
    let successCount = 0;
    let failureCount = 0;
    let processedUsers = 0;

    // Get current time in EST
    const nowEST = DateTime.now().setZone('America/New_York');
    const nowMinutes = nowEST.hour * 60 + nowEST.minute;

    // Process each user
    for (const userItem of itemsWithUsers) {
      try {
        const userId = userItem.user_id;
        processedUsers++;

        // Fetch user's preferred send_time from user_sms_settings
        let sendTime = '18:00'; // Default to 6:00 PM
        const { data: settings } = await supabase
          .from('user_sms_settings')
          .select('send_time')
          .eq('user_id', userId)
          .single();
        if (settings && settings.send_time) {
          sendTime = settings.send_time;
        }
        const [sendHour, sendMinute] = sendTime.split(':').map(Number);
        const sendMinutes = sendHour * 60 + sendMinute;
        // Only send if current time is within 10 minutes of send_time
        if (Math.abs(nowMinutes - sendMinutes) > 10) {
          console.log(`⏰ Skipping user ${userId} (not their send time: ${sendTime} EST)`);
          continue;
        }

        console.log(`📱 Processing user ${userId} (${processedUsers}/${itemsWithUsers.length}) at preferred send time (${sendTime} EST)`);

        // Send each template type
        for (const templateType of templatesToSend) {
          try {
            console.log(`📝 Generating ${templateType} SMS for user ${userId}`);
            
            // Generate message using new template system
            const smsMessage = await generateSMSMessage(userId, templateType);

            // Skip if message is too short or indicates an error
            if (!smsMessage || smsMessage.trim().length < 15 || smsMessage.includes('Error')) {
              console.log(`📭 ${templateType} SMS too short or error for user ${userId} - skipping`);
              failureCount++;
              continue;
            }

            console.log(`📱 Sending ${templateType} SMS to user ${userId}`);
            console.log(`📄 Message preview: ${smsMessage.substring(0, 100)}...`);

            // Send SMS using primary phone number (no overrides)
            const smsResult = await sendEnhancedSlickTextSMS({
              phoneNumber: '+16173472721', // Default for now - will use user's primary later
              message: smsMessage,
              userId: userId
            });

            if (smsResult.success) {
              successCount++;
              console.log(`✅ ${templateType} SMS sent successfully to user ${userId}`);
            } else {
              failureCount++;
              console.log(`❌ Failed to send ${templateType} SMS to user ${userId}:`, smsResult.error);
            }

            // Add small delay between SMS sends to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));

          } catch (smsError) {
            failureCount++;
            console.error(`❌ Error processing ${templateType} SMS for user ${userId}:`, smsError);
          }
        }

      } catch (userError) {
        failureCount++;
        console.error(`❌ Error processing user ${userItem.user_id}:`, userError);
      }
    }

    const result = {
      success: true,
      processed: successCount + failureCount,
      successCount,
      failureCount,
      usersProcessed: processedUsers,
      message: `Processed ${successCount + failureCount} SMS for ${processedUsers} users`
    };

    console.log('📊 SMS Processing Complete:', result);
    return NextResponse.json(result);

  } catch (error) {
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