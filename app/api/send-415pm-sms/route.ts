import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateSMSMessage, generateDailyReportV2 } from '@/utils/sms/templates';
import { sendUnifiedSMS } from '@/utils/sms/unified-sms';
import { checkAndLogSMS } from '@/utils/sms/deduplication';

// Create Supabase client with service role for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  // Check authorization: allow Vercel cron or correct secret
  const isVercelCron = request.headers.get('x-vercel-cron');
  const authHeader = request.headers.get('authorization');
  const CRON_SECRET = process.env.CRON_SECRET;
  if (!isVercelCron && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Feature flag (defaults to enabled). Set SMS_415PM_ENABLED=false to disable.
  const sms415pmEnabled = process.env.SMS_415PM_ENABLED !== 'false';
  if (!sms415pmEnabled) {
    return NextResponse.json({
      success: true,
      disabled: true,
      message: '4:15/5pm SMS is disabled via SMS_415PM_ENABLED'
    });
  }

  console.log('🌅 Starting 5:30 PM Special SMS processing...');
  
  let usersProcessed = 0;
  let smsSent = 0;
  let smsFailed = 0;
  const logDetails: Array<Record<string, unknown>> = [];

  try {
    // Get all users with bank connections
    const { data: itemsWithUsers, error: itemsError } = await supabase
      .from('items')
      .select('id, user_id, plaid_item_id')
      .is('deleted_at', null);

    if (itemsError || !itemsWithUsers || itemsWithUsers.length === 0) {
      console.log('📭 No bank connections found for 5:30 PM SMS');
      return NextResponse.json({ 
        success: true, 
        processed: 0,
        message: 'No bank connections found' 
      });
    }

          console.log(`👥 Found ${itemsWithUsers.length} users for 5:30 PM SMS`);

    // Deduplicate by user_id (users can have multiple items)
    const uniqueUserIds = Array.from(new Set((itemsWithUsers || []).map(u => u.user_id)));

    // v2 now default for all users

    // Process each user
    for (const userId of uniqueUserIds) {
      try {
        usersProcessed++;

        // Check if user has enabled 4:15/5pm special template via preferences
        const { data: templatePref } = await supabase
          .from('user_sms_preferences')
          .select('enabled')
          .eq('user_id', userId)
          .eq('sms_type', '415pm-special')
          .single();
        
        // Default to enabled for new users
        const enabled = templatePref ? !!templatePref.enabled : true;
        if (!enabled) {
          console.log(`📭 Skipping 5:30 PM SMS for user ${userId} (disabled in preferences)`);
          continue;
        }

        // Get user's phone number
        const { data: settings } = await supabase
          .from('user_sms_settings')
          .select('phone_number')
          .eq('user_id', userId)
          .single();

        const userPhoneNumber = settings?.phone_number;
        if (!userPhoneNumber || userPhoneNumber.trim() === '') {
          console.log(`📭 Skipping user ${userId} (no phone number)`);
          continue;
        }

        // Check deduplication
        const dedupeResult = await checkAndLogSMS({
          phoneNumber: userPhoneNumber,
          templateType: '415pm-special',
          userId,
          sourceEndpoint: '415pm-special',
          success: true
        });
        
        if (!dedupeResult.canSend) {
          console.log(`🚫 Skipping 5:30 PM SMS for user ${userId} - ${dedupeResult.reason}`);
          continue;
        }

        console.log(`📝 Generating 5:30 PM special SMS for user ${userId}`);

        // Generate message using v2 for all users
        const smsMessage = await generateDailyReportV2(userId);

        // Skip if message is too short or indicates an error
        if (!smsMessage || smsMessage.trim().length < 15 || smsMessage.includes('Error')) {
          console.log(`📭 5:30 PM SMS too short or error for user ${userId} - skipping`);
          smsFailed++;
          continue;
        }

        console.log(`📱 Sending 5:30 PM special SMS to user ${userId}`);
        console.log(`📄 Message preview: ${smsMessage.substring(0, 100)}...`);

        // Send SMS via unified sender
        const smsResult = await sendUnifiedSMS({
          phoneNumber: userPhoneNumber,
          message: smsMessage,
          userId: userId,
          context: '415pm-special'
        });

        if (smsResult.success) {
          smsSent++;
          logDetails.push({ 
            userId, 
            templateType: '415pm-special', 
            sent: true, 
            preview: smsMessage.substring(0, 100),
            logId: dedupeResult.logId,
            messageId: smsResult.messageId
          });
          console.log(`✅ 5:30 PM special SMS sent successfully to user ${userId}`);
        } else {
          smsFailed++;
          logDetails.push({ 
            userId, 
            templateType: '415pm-special', 
            sent: false, 
            error: smsResult.error,
            logId: dedupeResult.logId
          });
          console.log(`❌ Failed to send 5:30 PM special SMS to user ${userId}:`, smsResult.error);
        }

        // Add small delay between SMS sends
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (userError) {
        const errorMsg = userError instanceof Error ? userError.message : String(userError);
        logDetails.push({ userId, error: errorMsg });
        console.error(`❌ Error processing 4:15 PM SMS for user ${userId}:`, userError);
      }
    }

    const result = {
      success: true,
      processed: smsSent + smsFailed,
      smsSent,
      smsFailed,
      usersProcessed,
      message: `5:30 PM Special SMS: Processed ${smsSent + smsFailed} SMS for ${usersProcessed} users`
    };

    console.log('📊 5:30 PM Special SMS Processing Complete:', result);
    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ 5:30 PM Special SMS error:', error);
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
