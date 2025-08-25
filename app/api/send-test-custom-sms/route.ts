import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/server';
import { sendUnifiedSMS } from '@/utils/sms/unified-sms';
import { getUserPhoneNumber } from '@/utils/sms/user-phone';

export async function POST(request: NextRequest) {
  try {
    const { message, templateName } = await request.json();
    
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ 
        error: 'Message is required and must be a string' 
      }, { status: 400 });
    }

    // Create Supabase client with proper server-side authentication
    const supabase = await createSupabaseClient();
    
    // Get current user (uses cookies automatically)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`📱 Test SMS request from user: ${user.id}`);

    // Get user's phone number
    const phoneNumber = await getUserPhoneNumber(user.id);
    
    if (!phoneNumber) {
      return NextResponse.json({ 
        error: 'No phone number found. Please add a phone number to your profile to receive test SMS messages.' 
      }, { status: 400 });
    }

    console.log(`📱 Sending test SMS to phone ending in: ${phoneNumber.slice(-4)}`);

    // Prepare the test message with template name and line break
    const displayName = templateName || 'Test Template';
    const testMessage = `🧪 ${displayName}: \n\n${message}`;

    // Send SMS using the existing unified SMS system
    const smsResult = await sendUnifiedSMS({
      phoneNumber,
      message: testMessage,
      userId: user.id,
      userEmail: user.email,
      context: 'custom-template-test'
    });
    
    if (smsResult.success) {
      console.log(`✅ Test SMS sent successfully via ${smsResult.provider}:`, smsResult.messageId);
      
      return NextResponse.json({ 
        success: true, 
        message: 'Test SMS sent successfully!',
        provider: smsResult.provider,
        messageId: smsResult.messageId
      });
    } else {
      console.error('❌ Test SMS failed:', smsResult.error);
      
      return NextResponse.json({ 
        error: `Failed to send SMS: ${smsResult.error}` 
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('❌ Test SMS API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error while sending test SMS' 
    }, { status: 500 });
  }
}

// GET method for API documentation/testing
export async function GET() {
  return NextResponse.json({
    name: 'Custom Template Test SMS API',
    description: 'Send test SMS messages for custom template builder',
    usage: {
      method: 'POST',
      body: {
        message: 'string - The SMS message content to send'
      },
      headers: {
        'Authorization': 'Bearer <user_token>',
        'Content-Type': 'application/json'
      }
    },
    notes: [
      'Requires valid user authentication',
      'User must have a phone number in their profile', 
      'Test messages are prefixed with "🧪 TEST SMS:" for clarity',
      'Uses the unified SMS system (SlickText with Resend fallback)'
    ]
  });
}
