import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSmsGatewayWithFallback } from '@/utils/sms/user-phone';
import { sendUnifiedSMS } from '@/utils/sms/unified-sms';
import { generateSMSMessage } from '@/utils/sms/templates';

// Create a Supabase client for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { message, phoneNumber, scheduledTime, userId, userTimezone, templateType } = await request.json();
    
    // Debug: Log incoming request
    console.log('DEBUG: manual-sms POST body:', { message, phoneNumber, scheduledTime, userId, userTimezone });
    
    // Get user's SMS gateway (with fallback to default)
    const targetPhoneNumber = phoneNumber || await getSmsGatewayWithFallback(userId);
    
    // Debug: Log target phone number
    console.log('DEBUG: Target phone number:', targetPhoneNumber);
    
    let smsMessage = message || `🔔 MANUAL SMS - Krezzo Alert!\n\nTriggered at: ${new Date().toLocaleString()}\n\nThis is a test message from your Krezzo app.`;
    let transactionsText = '';
    
    // If a valid templateType is provided, use the corresponding SMS template
    if (userId && templateType && ['recurring','recent','merchant-pacing','category-pacing','weekly-summary','monthly-summary','paycheck-efficiency','cash-flow-runway'].includes(templateType)) {
      smsMessage = await generateSMSMessage(userId, templateType);
    } else if (userId) {
      const { data: userItems, error: itemsError } = await supabase
        .from('items')
        .select('plaid_item_id')
        .eq('user_id', userId);
      console.log('DEBUG: Supabase items for user:', { userItems, itemsError });
      if (userItems && userItems.length > 0) {
        const itemIds = userItems.map(item => item.plaid_item_id);
        const { data: transactions, error: txError } = await supabase
          .from('transactions')
          .select('date, merchant_name, name, amount')
          .in('plaid_item_id', itemIds)
          .order('date', { ascending: false })
          .limit(10); // Changed from 5 to 10
        console.log('DEBUG: Supabase transactions for user:', { transactions, txError });
        if (transactions && transactions.length > 0) {
          transactionsText = '\n\nRecent Transactions:';
          transactions.forEach(t => {
            // Use the raw date string from Supabase
            const date = t.date; // e.g., '2025-07-13'
            const merchant = (t.merchant_name || t.name).substring(0, 18);
            const amount = t.amount.toFixed(2);
            transactionsText += `\n${date}: ${merchant} - $${amount}`;
          });
          smsMessage += transactionsText;
        }
      }
    }
    
    // Default message if none provided
    // const smsMessage = message || `🔔 MANUAL SMS - Krezzo Alert!\n\nTriggered at: ${new Date().toLocaleString()}\n\nThis is a test message from your Krezzo app.`;
    
    // Debug: Log message content
    console.log('DEBUG: SMS message content:', smsMessage);
    
    // If userId is provided, try to fetch recent transactions for debug
    // if (userId) {
    //   const { data: userItems, error: itemsError } = await supabase
    //     .from('items')
    //     .select('plaid_item_id')
    //     .eq('user_id', userId);
    //   console.log('DEBUG: Supabase items for user:', { userItems, itemsError });
    //   if (userItems && userItems.length > 0) {
    //     const itemIds = userItems.map(item => item.plaid_item_id);
    //     const { data: transactions, error: txError } = await supabase
    //       .from('transactions')
    //       .select('date, merchant_name, name, amount')
    //       .in('plaid_item_id', itemIds)
    //       .order('date', { ascending: false })
    //       .limit(5);
    //     console.log('DEBUG: Supabase transactions for user:', { transactions, txError });
    //   }
    // }
    
    // If scheduled time is provided, store in database for later processing
    if (scheduledTime) {
      if (!userId) {
        return NextResponse.json({ 
          success: false, 
          error: 'User ID required for scheduled messages' 
        }, { status: 400 });
      }

      // The scheduledTime comes as an ISO string from the frontend
      const scheduledDate = new Date(scheduledTime);
      const now = new Date();
      
      console.log(`📅 Scheduling SMS:
        - User Timezone: ${userTimezone || 'Unknown'}
        - Scheduled Time (ISO): ${scheduledTime}
        - Scheduled Time (Date): ${scheduledDate.toISOString()}
        - Scheduled Time (Local): ${scheduledDate.toLocaleString()}
        - Current Time (UTC): ${now.toISOString()}
        - Current Time (Local): ${now.toLocaleString()}
      `);
      // You may want to store the scheduled SMS in a database table here
      return NextResponse.json({ success: true, scheduled: true });
    }

    // Send SMS immediately
    const sendResult = await sendUnifiedSMS({ phoneNumber: targetPhoneNumber, message: smsMessage, userId });
    return NextResponse.json({ success: true, sent: true, sendResult });
  } catch (error) {
    console.error('Error in manual-sms POST:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
