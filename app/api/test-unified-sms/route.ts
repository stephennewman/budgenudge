import { NextRequest, NextResponse } from 'next/server';
import { sendUnifiedSMS, getCurrentSMSConfig, testSlickTextAvailability } from '../../../utils/sms/unified-sms';

export async function GET() {
  try {
    console.log('🔍 Testing Unified SMS Configuration...');
    
    const config = getCurrentSMSConfig();
    const slicktextAvailable = await testSlickTextAvailability();
    
    return NextResponse.json({
      success: true,
      configuration: {
        ...config,
        slicktextConnectionTest: slicktextAvailable
      },
      capabilities: {
        canSendViaBoth: config.resendAvailable && config.slicktextAvailable,
        hasFailover: config.enableFallback,
        testModeEnabled: config.testMode
      },
      recommendations: {
        readyForTesting: config.slicktextAvailable && config.resendAvailable,
        suggestedNextStep: !slicktextAvailable 
          ? 'Upgrade SlickText account to enable message sending'
          : 'Ready to test unified SMS sending'
      }
    });
  } catch (error: any) {
    console.error('❌ Unified SMS config test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message || 'Configuration test failed'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Testing Unified SMS Sending...');

    // Parse request body
    let phoneNumber: string;
    let message: string;
    let testMode: boolean = false;
    
    try {
      const body = await request.json();
      phoneNumber = body.phoneNumber || '+16173472721';
      message = body.message || '🧪 Unified SMS Test - Testing both Resend and SlickText providers';
      testMode = body.testMode || false;
    } catch {
      phoneNumber = '+16173472721';
      message = '🧪 Unified SMS Test - Default test message';
    }

    // Temporarily enable test mode if requested
    if (testMode) {
      process.env.SMS_TEST_MODE = 'true';
    }

    const result = await sendUnifiedSMS({
      phoneNumber,
      message,
      context: 'unified-test',
      userId: 'test-user',
      userEmail: 'test@example.com'
    });

    // Reset test mode
    if (testMode) {
      delete process.env.SMS_TEST_MODE;
    }

    if (result.success) {
      return NextResponse.json({
        success: true,
        provider: result.provider,
        messageId: result.messageId,
        deliveryTime: result.deliveryTime,
        fallbackUsed: result.fallbackUsed || false,
        message: `SMS sent successfully via ${result.provider}${result.fallbackUsed ? ' (fallback)' : ''}`,
        testDetails: {
          phoneNumber: phoneNumber.slice(-4),
          messageLength: message.length,
          timestamp: new Date().toISOString()
        }
      });
    } else {
      return NextResponse.json({
        success: false,
        provider: result.provider,
        error: result.error,
        deliveryTime: result.deliveryTime,
        fallbackUsed: result.fallbackUsed || false,
        troubleshooting: {
          suggestions: [
            'Check if both providers are properly configured',
            'Verify environment variables are set correctly',
            'Test individual providers separately',
            'Check account status for both services'
          ]
        }
      }, { status: 400 });
    }
  } catch (error: any) {
    console.error('❌ Unified SMS test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message || 'Unified SMS test failed',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 