import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSmsGatewayWithFallback } from '@/utils/sms/user-phone';
import { sendUnifiedSMS } from '@/utils/sms/unified-sms';

// Create a Supabase client for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { message, phoneNumber, scheduledTime, userId, userTimezone } = await request.json();
    
    // Get user's SMS gateway (with fallback to default)
    const targetPhoneNumber = phoneNumber || await getSmsGatewayWithFallback(userId);
    
    // Default message if none provided
    const smsMessage = message || `🔔 Manual BudgeNudge Alert!\n\nTriggered at: ${new Date().toLocaleString()}\n\nThis is a test message from your BudgeNudge app.`;
    
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
      
      // Validate the scheduled time is in the future
      if (scheduledDate <= now) {
        console.log(`❌ Scheduled time validation failed:
          - Scheduled: ${scheduledDate.toISOString()}
          - Current: ${now.toISOString()}
          - Difference: ${scheduledDate.getTime() - now.getTime()}ms
        `);
        return NextResponse.json({ 
          success: false, 
          error: 'Scheduled time must be in the future' 
        }, { status: 400 });
      }

      // Store the scheduled message in the database
      const { data, error } = await supabase
        .from('scheduled_sms')
        .insert({
          user_id: userId,
          phone_number: targetPhoneNumber,
          message: smsMessage,
          scheduled_time: scheduledDate.toISOString(),
          status: 'pending'
        })
        .select()
        .single();

      if (error) {
        console.error('Error scheduling SMS:', error);
        return NextResponse.json({ 
          success: false, 
          error: 'Failed to schedule SMS',
          details: error.message 
        }, { status: 500 });
      }

      console.log('📅 SMS scheduled successfully:', {
        id: data.id,
        scheduled_time: data.scheduled_time,
        user_timezone: userTimezone
      });
      
      return NextResponse.json({ 
        success: true, 
        message: `SMS scheduled for ${scheduledDate.toLocaleString()}`,
        scheduledId: data.id,
        scheduledTimeUTC: scheduledDate.toISOString(),
        userTimezone: userTimezone
      });
    }

    // Send immediately using unified SMS service
    console.log('📱 Sending manual SMS via unified service...');
    
    const smsResult = await sendUnifiedSMS({
      phoneNumber: targetPhoneNumber,
      message: smsMessage,
      userId: userId,
      context: 'manual-sms'
    });

    if (smsResult.success) {
      console.log(`📱 Manual SMS sent successfully via ${smsResult.provider}${smsResult.fallbackUsed ? ' (fallback)' : ''} in ${smsResult.deliveryTime}ms`);
      
      return NextResponse.json({ 
        success: true, 
        message: 'SMS sent successfully!',
        provider: smsResult.provider,
        messageId: smsResult.messageId,
        deliveryTime: smsResult.deliveryTime,
        fallbackUsed: smsResult.fallbackUsed || false
      });
    } else {
      console.log('📱 Manual SMS failed:', smsResult.error);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to send SMS',
        provider: smsResult.provider,
        details: smsResult.error,
        fallbackUsed: smsResult.fallbackUsed || false
      }, { status: 500 });
    }
  } catch (error) {
    console.error('📱 Manual SMS error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 