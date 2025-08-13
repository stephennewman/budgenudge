import { NextRequest, NextResponse } from 'next/server';
import { generateDailyReportV2 } from '@/utils/sms/templates';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({
        error: 'Missing userId parameter',
        example: '/api/test-daily-v2-snapshot?userId=<uuid>'
      }, { status: 400 });
    }

    const message = await generateDailyReportV2(userId);

    return NextResponse.json({
      success: true,
      userId,
      message,
      messageLength: message.length,
      preview: message.substring(0, 200) + '...'
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}


