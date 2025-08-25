import { NextRequest, NextResponse } from 'next/server';
import { sendEnhancedSMS } from '../../../utils/sms/enhanced-sms';

export async function POST(request: NextRequest) {
  try {
    const { userId, phoneNumber, message } = await request.json();

    console.log('🧪 Testing Bandwidth SMS with enhanced fallback...');

    // Test message
    const testMessage = message || '🔧 Testing Bandwidth SMS - professional delivery like Ramp uses! If you receive this, the upgrade worked.';
    
    // Use enhanced SMS (tries Bandwidth first, then email gateway)
    const result = await sendEnhancedSMS({
      phoneNumber: phoneNumber || '+16173472721', // Default to hardcoded number if not provided
      message: testMessage,
      userId: userId,
      preferBandwidth: true
    });

    console.log('📊 SMS Test Result:', result);

    return NextResponse.json({
      success: result.success,
      method: result.method,
      messageId: result.messageId,
      error: result.error,
      timestamp: new Date().toISOString(),
      message: result.success 
        ? `SMS sent successfully via ${result.method}!` 
        : `SMS failed: ${result.error}`
    });

  } catch (error: unknown) {
    console.error('❌ Test SMS endpoint error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 