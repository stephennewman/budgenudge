import { NextResponse } from 'next/server';
import { generateSMSMessage } from '@/utils/sms/templates';

export async function GET() {
  try {
    console.log('🧪 Testing Weekly Summary SMS Template...');
    
    // Test with a real user ID (you can replace this)
    const testUserId = 'bc474c8b-4b47-4c7d-b202-f469330af2a2';
    
    console.log(`📝 Generating weekly-summary SMS for user: ${testUserId}`);
    
    // Generate the weekly summary message
    const weeklyMessage = await generateSMSMessage(testUserId, 'weekly-summary');
    
    console.log('📊 Weekly Summary Message Generated:');
    console.log('---');
    console.log(weeklyMessage);
    console.log('---');
    console.log(`📏 Message length: ${weeklyMessage.length} characters`);
    
    return NextResponse.json({
      success: true,
      template: 'weekly-summary',
      userId: testUserId,
      message: weeklyMessage,
      messageLength: weeklyMessage.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Weekly Summary SMS Test Failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 