import { NextRequest, NextResponse } from 'next/server';
import { generateBoatOutlookSMS } from '@/utils/boat/outlook';
import { sendEnhancedSlickTextSMS } from '@/utils/sms/slicktext-client';

// Daily "Boat Outlook" text for tomorrow's conditions (Palm Harbor).
// Auth: Vercel cron header or Bearer CRON_SECRET.
// ?preview=true returns the generated message WITHOUT sending.
export async function GET(request: NextRequest) {
  const isVercelCron = request.headers.get('x-vercel-cron');
  const authHeader = request.headers.get('authorization');
  const CRON_SECRET = process.env.CRON_SECRET;
  if (!isVercelCron && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const preview = request.nextUrl.searchParams.get('preview') === 'true';
  const phone = process.env.BOAT_OUTLOOK_PHONE;

  try {
    const message = await generateBoatOutlookSMS();

    if (preview) {
      return NextResponse.json({ success: true, preview: true, message });
    }

    if (!phone) {
      return NextResponse.json(
        { success: false, error: 'BOAT_OUTLOOK_PHONE env var is not set' },
        { status: 500 },
      );
    }

    const result = await sendEnhancedSlickTextSMS({ phoneNumber: phone, message });
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error, message }, { status: 502 });
    }

    return NextResponse.json({ success: true, messageId: result.messageId, message });
  } catch (error) {
    console.error('❌ Boat outlook cron error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
