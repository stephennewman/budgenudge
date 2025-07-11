import { NextRequest, NextResponse } from 'next/server';
import { createSlickTextClient, sendEnhancedSlickTextSMS } from '../../../utils/sms/slicktext-client';

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Testing SlickText SMS integration...');

    // Parse request body for optional parameters
    let phoneNumber: string | undefined;
    let message: string | undefined;
    let userId: string | undefined;
    let userEmail: string | undefined;

    try {
      const body = await request.json();
      phoneNumber = body.phoneNumber;
      message = body.message;
      userId = body.userId;
      userEmail = body.userEmail;
    } catch {
      // No body or invalid JSON - use defaults
    }

    // Test message
    const testMessage = message || `🚀 SlickText Integration Test - BudgeNudge

✅ Professional SMS delivery active
✅ Contact management enabled
✅ Two-way messaging ready
✅ Timestamp: ${new Date().toLocaleString('en-US', { 
      timeZone: 'America/New_York',
      month: 'short', 
      day: 'numeric', 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    })} EST

This message was sent via SlickText API! 🎯`;

    // Default phone number (you can change this)
    const targetPhone = phoneNumber || '+16173472721';

    console.log('📱 SlickText test details:', {
      phoneNumber: targetPhone,
      messageLength: testMessage.length,
      userId: userId || 'test-user',
      userEmail: userEmail || undefined
    });

    // Test SlickText connection first
    const client = createSlickTextClient();
    const connectionTest = await client.testConnection();
    
    if (!connectionTest.success) {
      throw new Error(`SlickText connection failed: ${connectionTest.error}`);
    }

    console.log('✅ SlickText connection verified:', connectionTest.data);

    // Send test SMS
    const result = await sendEnhancedSlickTextSMS({
      phoneNumber: targetPhone,
      message: testMessage,
      userId: userId || 'test-user',
      userEmail: userEmail
    });

    if (result.success) {
      console.log('✅ SlickText SMS test successful:', {
        messageId: result.messageId,
        deliveryStatus: result.deliveryStatus
      });

      return NextResponse.json({
        success: true,
        method: 'slicktext',
        messageId: result.messageId,
        brandInfo: connectionTest.data,
        message: 'SlickText SMS sent successfully!',
        timestamp: new Date().toISOString(),
        phoneNumber: targetPhone
      });
    } else {
      throw new Error(result.error || 'SlickText SMS send failed');
    }

  } catch (error: unknown) {
    console.error('❌ SlickText test endpoint error:', error);
    
    return NextResponse.json({
      success: false,
      method: 'slicktext',
      error: error instanceof Error ? error.message : 'SlickText test failed',
      timestamp: new Date().toISOString(),
      troubleshooting: {
        checklist: [
          'Verify SLICKTEXT_API_KEY is set correctly',
          'Verify SLICKTEXT_BRAND_ID is set correctly',
          'Check SlickText account credits and status',
          'Ensure phone number format is correct (+1XXXXXXXXXX)',
          'Check SlickText API documentation for any changes'
        ]
      }
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    console.log('🔍 SlickText status check...');
    
    // Test connection without sending SMS
    const client = createSlickTextClient();
    const brandInfo = await client.getBrandInfo();
    
    if (brandInfo.success) {
      return NextResponse.json({
        success: true,
        method: 'slicktext',
        status: 'ready',
        brandInfo: brandInfo.data,
        message: 'SlickText API is ready to send SMS',
        timestamp: new Date().toISOString()
      });
    } else {
      throw new Error(brandInfo.error || 'Brand info fetch failed');
    }
    
  } catch (error: unknown) {
    console.error('❌ SlickText status check failed:', error);
    
    return NextResponse.json({
      success: false,
      method: 'slicktext',
      status: 'error',
      error: error instanceof Error ? error.message : 'SlickText status check failed',
      timestamp: new Date().toISOString(),
      troubleshooting: {
        possibleCauses: [
          'Missing or invalid SLICKTEXT_API_KEY environment variable',
          'Missing or invalid SLICKTEXT_BRAND_ID environment variable',
          'SlickText API service is down',
          'Account suspended or out of credits',
          'Network connectivity issues'
        ]
      }
    }, { status: 500 });
  }
} 