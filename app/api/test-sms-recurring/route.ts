import { NextRequest, NextResponse } from 'next/server';
import { generateSMSMessage } from '@/utils/sms/templates';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();
    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'userId is required',
        apiRoute: '/api/test-sms-recurring'
      }, { status: 400 });
    }
    const message = await generateSMSMessage(userId, 'recurring');
    return NextResponse.json({
      success: true,
      apiRoute: '/api/test-sms-recurring',
      templateType: 'recurring',
      message,
      messageLength: message.length
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      apiRoute: '/api/test-sms-recurring',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 