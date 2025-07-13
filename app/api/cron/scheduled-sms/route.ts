import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEnhancedSlickTextSMS } from '@/utils/sms/slicktext-client';
import { buildBillsSMS, buildSpendingSMS, buildActivitySMS, SMSTemplateType } from '@/utils/sms/templates';

// Create a Supabase client for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Transaction interface
interface Transaction {
  date: string;
  merchant_name?: string;
  name: string;
  amount: number;
}

// SMS Preference interface
interface SMSPreference {
  user_id: string;
  sms_type: SMSTemplateType;
  enabled: boolean;
  frequency: string;
  phone_number?: string;
}

export async function GET(request: NextRequest) {
  // Secure GET method with same auth as POST
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    console.log('🕐 Starting SMS processing with template preferences...');
    
    const now = new Date();
    console.log(`⏰ SMS Analysis Time:
      - Server Time (UTC): ${now.toISOString()}
      - Server Time (Local): ${now.toLocaleString()}
      - Analysis: Template-based SMS for active users with preferences
    `);
    
    // Get all users with items (bank connections) and their SMS preferences
    const { data: itemsWithUsers, error: itemsError } = await supabase
      .from('items')
      .select(`
        id,
        user_id,
        plaid_item_id
      `);

    if (itemsError) {
      console.error('Error fetching items:', itemsError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch items' 
      }, { status: 500 });
    }

    if (!itemsWithUsers || itemsWithUsers.length === 0) {
      console.log('📭 No items (bank connections) found');
      return NextResponse.json({ 
        success: true, 
        processed: 0,
        message: 'No items found' 
      });
    }

    // Get current frequency (30min schedule)
    const currentFrequency = '30min';
    
    // Get SMS preferences for all users with enabled preferences matching current frequency
    const { data: smsPreferences, error: prefsError } = await supabase
      .from('user_sms_preferences')
      .select('user_id, sms_type, enabled, frequency, phone_number')
      .eq('enabled', true)
      .eq('frequency', currentFrequency);

    if (prefsError) {
      console.error('Error fetching SMS preferences:', prefsError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch SMS preferences' 
      }, { status: 500 });
    }

    if (!smsPreferences || smsPreferences.length === 0) {
      console.log('📭 No enabled SMS preferences found for current frequency');
      return NextResponse.json({ 
        success: true, 
        processed: 0,
        message: 'No enabled SMS preferences found' 
      });
    }

    console.log(`📨 Found ${smsPreferences.length} enabled SMS preferences to process`);
    
    let successCount = 0;
    let failureCount = 0;

    // Group preferences by user_id
    const userPreferences: Record<string, SMSPreference[]> = {};
    smsPreferences.forEach(pref => {
      if (!userPreferences[pref.user_id]) {
        userPreferences[pref.user_id] = [];
      }
      userPreferences[pref.user_id].push(pref);
    });

    // Process each user's preferences
    for (const userId of Object.keys(userPreferences)) {
      try {
        const userPrefs = userPreferences[userId];
        
        // Find the user's item
        const userItem = itemsWithUsers.find(item => item.user_id === userId);
        if (!userItem) {
          console.log(`⚠️ No item found for user ${userId} - skipping`);
          continue;
        }

        console.log(`🔍 Processing ${userPrefs.length} SMS types for user: ${userId}`);
        
        // Get all transactions for this user (last 90 days for analysis)
        const { data: allTransactions, error: transError } = await supabase
          .from('transactions')
          .select('date, name, merchant_name, amount')
          .eq('plaid_item_id', userItem.plaid_item_id)
          .gte('date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
          .order('date', { ascending: false });

        if (transError) {
          console.error(`Error fetching transactions for user ${userId}:`, transError);
          failureCount++;
          continue;
        }

        if (!allTransactions || allTransactions.length === 0) {
          console.log(`📭 No recent transactions found for user ${userId} - skipping all SMS`);
          continue;
        }

        // Process each enabled SMS type for this user
        for (const pref of userPrefs) {
          try {
            let smsMessage = '';
            let smsLabel = '';

            // Generate message based on SMS type
            switch (pref.sms_type) {
              case 'bills':
                smsMessage = await buildBillsSMS(userId);
                smsLabel = '📅 BILLS SMS';
                break;
              case 'spending':
                smsMessage = await buildSpendingSMS(allTransactions, userId);
                smsLabel = '📅 SPENDING SMS';
                break;
              case 'activity':
                smsMessage = await buildActivitySMS(allTransactions);
                smsLabel = '📅 ACTIVITY SMS';
                break;
              default:
                console.log(`⚠️ Unknown SMS type: ${pref.sms_type}`);
                continue;
            }

            // Skip if message is empty or too short
            if (!smsMessage || smsMessage.trim().length < 20) {
              console.log(`📭 ${pref.sms_type} SMS too short for user ${userId} - skipping`);
              continue;
            }

            // Skip if SMS contains only zero/empty values
            if (smsMessage.includes('💰 BALANCE: $0') && smsMessage.includes('vs $0 expected pace')) {
              console.log(`📭 ${pref.sms_type} SMS contains only zero values for user ${userId} - skipping`);
              continue;
            }

            // Use phone number from preference or default
            const phoneNumber = pref.phone_number || '+16173472721';
            
            console.log(`📱 Sending ${pref.sms_type} SMS to user ${userId}: ${smsMessage.substring(0, 100)}...`);

            // Send SMS using SlickText
            const smsResult = await sendEnhancedSlickTextSMS({
              phoneNumber: phoneNumber,
              message: `${smsLabel} - BUDGENUDGE INSIGHT\\n\\n${smsMessage}`,
              userId: userId
            });

            if (smsResult.success) {
              console.log(`✅ ${pref.sms_type} SMS sent successfully to user: ${userId}`);
              successCount++;
            } else {
              console.log(`❌ ${pref.sms_type} SMS failed for user ${userId}: ${smsResult.error}`);
              failureCount++;
            }

          } catch (error) {
            console.log(`❌ Error processing ${pref.sms_type} SMS for user ${userId}: ${error}`);
            failureCount++;
          }
        }

      } catch (error) {
        console.log(`❌ Error processing user ${userId}: ${error}`);
        failureCount++;
      }
    }

    console.log(`📊 Template-based SMS processing complete: ${successCount} sent, ${failureCount} failed`);

    return NextResponse.json({ 
      success: true, 
      processed: Object.keys(userPreferences).length,
      sent: successCount,
      failed: failureCount,
      message: `Processed template-based SMS for ${Object.keys(userPreferences).length} users`
    });

  } catch (error) {
    console.error('🚨 Template-based SMS processing error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error during template-based SMS processing' 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
} 