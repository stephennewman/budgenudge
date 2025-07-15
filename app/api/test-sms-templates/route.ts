import { NextRequest, NextResponse } from 'next/server';
import { generateSMSMessage } from '@/utils/sms/templates';

// Split into three separate routes for debugging
// 1. /api/test-sms-pacing
// 2. /api/test-sms-recurring
// 3. /api/test-sms-recent
// Each should be a separate file in app/api/

// POST /api/test-sms-templates/recurring
export async function POST(request: NextRequest) {
  try {
    const { userId, templateType } = await request.json();
    if (!userId || !templateType) {
      return NextResponse.json({
        success: false,
        error: 'userId and templateType are required',
        apiRoute: '/api/test-sms-templates'
      }, { status: 400 });
    }
    const message = await generateSMSMessage(userId, templateType);
    return NextResponse.json({
      success: true,
      apiRoute: '/api/test-sms-templates',
      templateType,
      message,
      messageLength: message.length
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      apiRoute: '/api/test-sms-templates',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 