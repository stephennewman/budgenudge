import { NextRequest, NextResponse } from 'next/server';
import { generateSMSMessage } from '@/utils/sms/templates';

const DEFAULT_USER_ID = 'bc474c8b-4b47-4c7d-b202-f469330af2a2';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || DEFAULT_USER_ID;
    
    const results: Record<string, { success: boolean; message?: string; length?: number; error?: string }> = {};
    const templateTypes = ['recurring', 'recent', 'pacing'] as const;
    for (const templateType of templateTypes) {
      try {
        const message = await generateSMSMessage(userId, templateType);
        results[templateType] = { success: true, message, length: message.length };
      } catch (error) {
        results[templateType] = { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    }
    return NextResponse.json({ userId, results });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
} 