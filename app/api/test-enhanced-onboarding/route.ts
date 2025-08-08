import { NextRequest, NextResponse } from 'next/server';
import { generateSMSMessage } from '@/utils/sms/templates';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();
    
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    console.log(`🧪 Generating enhanced onboarding analysis for user: ${userId}`);

    // Generate the comprehensive analysis message
    const analysisMessage = await generateSMSMessage(userId, 'onboarding-analysis-complete');
    
    return NextResponse.json({
      success: true,
      userId: userId,
      message: analysisMessage,
      messageLength: analysisMessage.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Enhanced onboarding analysis error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate enhanced analysis',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
