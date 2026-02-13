import { NextRequest, NextResponse } from 'next/server';
import { generateSMSMessage } from '@/utils/sms/templates';

export async function POST(request: NextRequest) {
  try {
    const { user_id, template_types } = await request.json();
    
    if (!user_id) {
      return NextResponse.json({ 
        success: false, 
        error: 'user_id is required' 
      }, { status: 400 });
    }

    const templatesToTest = template_types || [];
// TEMPORARILY DISABLED - Paycheck templates
// ['paycheck-efficiency', 'cash-flow-runway']
    const results = [];
    
    for (const templateType of templatesToTest) {
      const message = await generateSMSMessage(user_id, templateType);
      
      results.push({
        template: templateType,
        message,
        messageLength: message.length,
        success: !message.includes('Error')
      });
    }
    
    return NextResponse.json({
      success: true,
      user_id,
      results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Paycheck-period SMS template test failed:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST with user_id to test paycheck-period SMS templates',
    example: {
      user_id: 'your-user-id-here',
      template_types: []
// TEMPORARILY DISABLED - Paycheck templates
// ['paycheck-efficiency', 'cash-flow-runway']
    }
  });
} 