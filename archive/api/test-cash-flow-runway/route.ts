import { NextResponse } from 'next/server';
import { generateSMSMessage } from '@/utils/sms/templates';
import { checkAndLogSMS } from '@/utils/sms/deduplication';
import { sendEnhancedSlickTextSMS } from '@/utils/sms/slicktext-client';

// Sends a one-off Cash Flow Runway SMS to Stephen using live data
export async function GET() {
  try {
    const userId = 'bc474c8b-4b47-4c7d-b202-f469330af2a2'; // Stephen
    const phoneNumber = '+16173472721';

    // Dedup: ensure we don't send this template more than once today
    const dedupe = await checkAndLogSMS({
      phoneNumber,
      templateType: 'cash-flow-runway',
      userId,
      sourceEndpoint: 'test',
      success: true,
    });

    if (!dedupe.canSend) {
      return NextResponse.json({ success: false, skipped: true, reason: dedupe.reason }, { status: 200 });
    }

    const message = await generateSMSMessage(userId, 'cash-flow-runway');

    const sendResult = await sendEnhancedSlickTextSMS({
      phoneNumber,
      message,
      userId,
    });

    return NextResponse.json({ success: sendResult.success, messagePreview: message.substring(0, 120), messageId: sendResult.messageId });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}


