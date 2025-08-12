import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateSMSMessage } from '@/utils/sms/templates';
import { sendEnhancedSlickTextSMS } from '@/utils/sms/slicktext-client';
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

    // Process each user
    for (const userItem of itemsWithUsers) {
      try {
        const userId = userItem.user_id;
        usersProcessed++;

        // Check if user has enabled weekly summary SMS (used for 4:15 PM report)
        const { data: templatePref } = await supabase
          .from('user_sms_preferences')
          .select('enabled')
          .eq('user_id', userId)
          .eq('sms_type', 'weekly-summary')
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
          templateType: 'weekly-summary',
          userId,
          sourceEndpoint: '415pm-special',
          success: true
        });
        
        if (!dedupeResult.canSend) {
          console.log(`🚫 Skipping 5:30 PM SMS for user ${userId} - ${dedupeResult.reason}`);
          continue;
        }

        console.log(`📝 Generating 5:30 PM special SMS for user ${userId}`);
        
        // Generate message using weekly summary template for 4:15 PM report
        const smsMessage = await generateSMSMessage(userId, 'weekly-summary');

        // Skip if message is too short or indicates an error
        if (!smsMessage || smsMessage.trim().length < 15 || smsMessage.includes('Error')) {
          console.log(`📭 5:30 PM SMS too short or error for user ${userId} - skipping`);
          smsFailed++;
          continue;
        }

        console.log(`📱 Sending 5:30 PM special SMS to user ${userId}`);
        console.log(`📄 Message preview: ${smsMessage.substring(0, 100)}...`);

        // Send SMS
        const smsResult = await sendEnhancedSlickTextSMS({
          phoneNumber: userPhoneNumber,
          message: smsMessage,
          userId: userId
        });

        if (smsResult.success) {
          smsSent++;
          logDetails.push({ 
            userId, 
            templateType: 'weekly-summary', 
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
            templateType: 'weekly-summary', 
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
        logDetails.push({ userId: userItem.user_id, error: errorMsg });
        console.error(`❌ Error processing 4:15 PM SMS for user ${userItem.user_id}:`, userError);
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
