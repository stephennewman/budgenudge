import { NextRequest, NextResponse } from 'next/server';

/**
 * Test endpoint to simulate SlickText webhook calls
 * Use this to test the two-way messaging functionality
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Testing SlickText webhook simulation...');
    
    const { phoneNumber, message, testCommand } = await request.json();
    
    // Use provided values or defaults
    const testPhoneNumber = phoneNumber || '+16173472721';
    const testMessage = message || testCommand || 'HELP';
    
    // Simulate SlickText webhook payload
    const webhookPayload = {
      message_id: `test_${Date.now()}`,
      contact_id: `37910017`, // Stephen's contact ID
      phone_number: testPhoneNumber,
      message: testMessage,
      received_at: new Date().toISOString(),
      brand_id: "11489"
    };
    
    console.log('📤 Simulating webhook payload:', webhookPayload);
    
    // Call the actual webhook endpoint locally
    const baseUrl = process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://get.krezzo.com';
    
    const webhookResponse = await fetch(`${baseUrl}/api/slicktext-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookPayload)
    });
    
    const webhookResult = await webhookResponse.json();
    
    if (webhookResponse.ok) {
      console.log('✅ Webhook test successful');
      
      return NextResponse.json({
        success: true,
        message: 'SlickText webhook test completed successfully',
        testPayload: webhookPayload,
        webhookResponse: webhookResult,
        timestamp: new Date().toISOString()
      });
    } else {
      throw new Error(`Webhook test failed: ${webhookResult.error || 'Unknown error'}`);
    }
    
  } catch (error) {
    console.error('❌ SlickText webhook test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Test failed',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'SlickText webhook test endpoint ready',
    usage: {
      method: 'POST',
      body: {
        phoneNumber: '+16173472721 (optional)',
        message: 'Your message here (optional)',
        testCommand: 'STOP|START|HELP|BALANCE (optional)'
      }
    },
    examples: [
      {
        description: 'Test BALANCE command',
        curl: `curl -X POST http://localhost:3000/api/test-slicktext-webhook -H "Content-Type: application/json" -d '{"testCommand": "BALANCE"}'`
      },
      {
        description: 'Test HELP command',
        curl: `curl -X POST http://localhost:3000/api/test-slicktext-webhook -H "Content-Type: application/json" -d '{"testCommand": "HELP"}'`
      },
      {
        description: 'Test custom message',
        curl: `curl -X POST http://localhost:3000/api/test-slicktext-webhook -H "Content-Type: application/json" -d '{"message": "What is my balance?"}'`
      }
    ],
    timestamp: new Date().toISOString()
  });
} 