import { NextRequest, NextResponse } from 'next/server';
import { generateSMSMessage } from '@/utils/sms/templates';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();
    
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    console.log(`🧪 Testing enhanced onboarding template for user: ${userId}`);

    // Generate the enhanced analysis message with new bill detection
    const analysisMessage = await generateSMSMessage(userId, 'onboarding-analysis-complete');
    
    return NextResponse.json({
      success: true,
      userId: userId,
      message: analysisMessage,
      messageLength: analysisMessage.length,
      hasEnhancedDetection: analysisMessage.includes('Recurring Bills:'),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Enhanced onboarding template test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to test enhanced template',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
