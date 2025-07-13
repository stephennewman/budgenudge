import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/server';
import { buildBillsSMS, buildSpendingSMS, buildActivitySMS, SMSTemplateType } from '@/utils/sms/templates';
import { sendEnhancedSlickTextSMS } from '@/utils/sms/slicktext-client';

interface SMSPreference {
  user_id: string;
  sms_type: SMSTemplateType;
  enabled: boolean;
  frequency: string;
  phone_number?: string;
}

export async function GET(request: NextRequest) {
  // Check authorization
  const authHeader = request.headers.get('authorization');
  if (authHeader !== 'Bearer cron_secret_2024') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    console.log('🕐 Starting simplified SMS processing...');
    
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

    // Get enabled SMS preferences for 30min frequency
    const { data: smsPreferences, error: prefsError } = await supabase
      .from('user_sms_preferences')
      .select('user_id, sms_type, enabled, frequency, phone_number')
      .eq('enabled', true)
      .eq('frequency', '30min');

    if (prefsError || !smsPreferences || smsPreferences.length === 0) {
      console.log('📭 No enabled SMS preferences found');
      return NextResponse.json({ 
        success: true, 
        processed: 0,
        message: 'No enabled SMS preferences found' 
      });
    }

    console.log(`📨 Found ${smsPreferences.length} enabled SMS preferences`);
    
    let successCount = 0;
    let failureCount = 0;

    // Group by user_id and get unique SMS types per user
    const userSMSMap = new Map<string, Set<SMSTemplateType>>();
    
    smsPreferences.forEach((pref: SMSPreference) => {
      if (!userSMSMap.has(pref.user_id)) {
        userSMSMap.set(pref.user_id, new Set());
      }
      userSMSMap.get(pref.user_id)!.add(pref.sms_type);
    });

    // Process each user
    for (const [userId, smsTypes] of userSMSMap) {
      try {
        // Find the user's bank connection
        const userItem = itemsWithUsers.find((item: { user_id: string; plaid_item_id: string }) => item.user_id === userId);
        if (!userItem) {
          console.log(`❌ No bank connection found for user ${userId}`);
          continue;
        }

        // Get transactions for this user (last 30 days)
        const { data: allTransactions, error: transError } = await supabase
          .from('transactions')
          .select('date, name, merchant_name, amount')
          .eq('plaid_item_id', userItem.plaid_item_id)
          .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
          .order('date', { ascending: false });

        if (transError || !allTransactions) {
          console.log(`❌ Failed to fetch transactions for user ${userId}`);
          failureCount++;
          continue;
        }

        console.log(`📊 User ${userId}: ${allTransactions.length} transactions, SMS types: ${Array.from(smsTypes).join(', ')}`);

        // Get user's phone number (use first preference found)
        const userPref = smsPreferences.find((p: SMSPreference) => p.user_id === userId);
        const phoneNumber = userPref?.phone_number || '+16173472721';

        // Send one SMS per type
        for (const smsType of smsTypes) {
          try {
            let smsMessage = '';

            // Generate message based on SMS type
            switch (smsType) {
              case 'bills':
                smsMessage = await buildBillsSMS(userId);
                break;
              case 'spending':
                smsMessage = await buildSpendingSMS(allTransactions, userId);
                break;
              case 'activity':
                smsMessage = await buildActivitySMS(allTransactions);
                break;
              default:
                console.log(`⚠️ Unknown SMS type: ${smsType}`);
                continue;
            }

            // Skip if message is too short
            if (!smsMessage || smsMessage.trim().length < 10) {
              console.log(`📭 ${smsType} SMS too short for user ${userId} - skipping`);
              continue;
            }

            // Format the final SMS
            const cleanMessage = `📅 ${smsType.toUpperCase()} SMS - BUDGENUDGE

${smsMessage}`;

            console.log(`📱 Sending ${smsType} SMS to user ${userId}`);

            // Send SMS
            const smsResult = await sendEnhancedSlickTextSMS({
              phoneNumber: phoneNumber,
              message: cleanMessage,
              userId: userId
            });

            if (smsResult.success) {
              successCount++;
              console.log(`✅ ${smsType} SMS sent successfully to user ${userId}`);
            } else {
              failureCount++;
              console.log(`❌ Failed to send ${smsType} SMS to user ${userId}:`, smsResult.error);
            }

          } catch (smsError) {
            failureCount++;
            console.error(`❌ Error sending ${smsType} SMS to user ${userId}:`, smsError);
          }
        }

      } catch (userError) {
        failureCount++;
        console.error(`❌ Error processing user ${userId}:`, userError);
      }
    }

    const totalProcessed = successCount + failureCount;
    
    console.log(`📊 SMS Processing Complete:
      - Users processed: ${userSMSMap.size}
      - SMS sent successfully: ${successCount}
      - SMS failed: ${failureCount}
      - Total processed: ${totalProcessed}
    `);

    return NextResponse.json({
      success: true,
      processed: totalProcessed,
      successCount,
      failureCount,
      usersProcessed: userSMSMap.size,
      message: `Processed ${totalProcessed} SMS for ${userSMSMap.size} users`
    });

  } catch (error) {
    console.error('❌ Error in SMS cron job:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'SMS processing failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
} 