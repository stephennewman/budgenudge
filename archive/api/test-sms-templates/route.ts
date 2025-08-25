import { NextResponse } from 'next/server';
import { generateSMSMessage } from '@/utils/sms/templates';

export async function GET() {
  try {
    console.log('🧪 Testing Weekly & Monthly Summary SMS Templates...');
    
    // Test with a real user ID (you can replace this)
    const testUserId = 'bc474c8b-4b47-4c7d-b202-f469330af2a2';
    
    // Test both templates
    const templates = ['weekly-summary', 'monthly-summary'] as const;
    const results = [];
    
    for (const template of templates) {
      console.log(`📝 Generating ${template} SMS for user: ${testUserId}`);
      
      // Generate the message
      const message = await generateSMSMessage(testUserId, template);
      
      console.log(`📊 ${template === 'weekly-summary' ? 'Weekly' : 'Monthly'} Summary Message Generated:`);
      console.log('---');
      console.log(message);
      console.log('---');
      console.log(`📏 Message length: ${message.length} characters`);
      
      results.push({
        template,
        message,
        messageLength: message.length
      });
    }
    
    return NextResponse.json({
      success: true,
      userId: testUserId,
      results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Summary SMS Templates Test Failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 