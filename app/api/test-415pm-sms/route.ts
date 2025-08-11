import { NextRequest, NextResponse } from 'next/server';
import { generateSMSMessage } from '@/utils/sms/templates';

export async function GET(request: NextRequest) {
  try {
    // Get user ID from query params
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ 
        error: 'Missing userId parameter',
        example: '/api/test-415pm-sms?userId=your-user-id'
      }, { status: 400 });
    }

    console.log(`🧪 Testing 4:15 PM SMS template for user: ${userId}`);
    
    // Generate the message
    const message = await generateSMSMessage(userId, '415pm-special');
    
    if (!message || message.includes('Error')) {
      return NextResponse.json({ 
        error: 'Failed to generate message',
        message: message 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      userId,
      templateType: '415pm-special',
      message,
      messageLength: message.length,
      preview: message.substring(0, 200) + '...'
    });

  } catch (error) {
    console.error('❌ Error testing 4:15 PM SMS template:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId } = body;
    
    if (!userId) {
      return NextResponse.json({ 
        error: 'Missing userId in request body',
        example: { userId: 'your-user-id' }
      }, { status: 400 });
    }

    console.log(`🧪 Testing 4:15 PM SMS template for user: ${userId}`);
    
    // Generate the message
    const message = await generateSMSMessage(userId, '415pm-special');
    
    if (!message || message.includes('Error')) {
      return NextResponse.json({ 
        error: 'Failed to generate message',
        message: message 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      userId,
      templateType: '415pm-special',
      message,
      messageLength: message.length,
      preview: message.substring(0, 200) + '...'
    });

  } catch (error) {
    console.error('❌ Error testing 4:15 PM SMS template:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
