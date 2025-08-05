import { NextRequest, NextResponse } from 'next/server';
import { notifySlackNewUserSignup, notifySlackSimple } from '@/utils/slack/notifications';

export async function POST(request: NextRequest) {
  try {
    const { testType } = await request.json();
    
    console.log(`🧪 Testing Slack notification: ${testType}`);
    
    if (testType === 'simple') {
      const result = await notifySlackSimple('🧪 Test notification from BudgeNudge - Slack integration is working!');
      
      return NextResponse.json({
        success: result,
        message: result ? 'Simple notification sent successfully' : 'Simple notification failed',
        timestamp: new Date().toISOString()
      });
    }
    
    if (testType === 'signup') {
      const testUser = {
        id: 'test-user-123',
        email: 'test@example.com',
        phone: '+15551234567',
        firstName: 'Test',
        lastName: 'User',
        signupSource: 'Test Environment',
        conversionSource: 'API Test Call'
      };
      
      const result = await notifySlackNewUserSignup(testUser);
      
      return NextResponse.json({
        success: result,
        message: result ? 'Signup notification sent successfully' : 'Signup notification failed',
        testUser: testUser,
        timestamp: new Date().toISOString()
      });
    }
    
    return NextResponse.json({
      success: false,
      error: 'Invalid test type. Use "simple" or "signup"',
      availableTypes: ['simple', 'signup']
    }, { status: 400 });
    
  } catch (error) {
    console.error('❌ Slack notification test error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Test failed',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Slack Notification Test Endpoint',
    usage: 'POST with { "testType": "simple" } or { "testType": "signup" }',
    environment: {
      slackWebhookConfigured: !!process.env.SLACK_WEBHOOK_URL,
      timestamp: new Date().toISOString()
    }
  });
}