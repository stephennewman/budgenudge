import { NextRequest, NextResponse } from 'next/server';
import { generateSMSMessage } from '@/utils/sms/templates';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();
    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'userId is required',
        apiRoute: '/api/test-sms-pacing'
      }, { status: 400 });
    }
    const message = await generateSMSMessage(userId, 'pacing');
    return NextResponse.json({
      success: true,
      apiRoute: '/api/test-sms-pacing',
      templateType: 'pacing',
      message,
      messageLength: message.length
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      apiRoute: '/api/test-sms-pacing',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 