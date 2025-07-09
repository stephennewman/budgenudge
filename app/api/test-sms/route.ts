import { NextResponse } from 'next/server';
import { getSmsGatewayWithFallback } from '@/utils/sms/user-phone';

export async function POST(request: Request) {
  try {
    // Try to get userId from request body, if provided
    let userId: string | undefined;
    try {
      const body = await request.json();
      userId = body.userId;
    } catch {
      // No body or invalid JSON - use fallback
    }

    const testMessage = `🧪 BudgeNudge Test SMS
    
✅ Webhook system operational
✅ SMS delivery working
✅ Timestamp: ${new Date().toLocaleString('en-US', { 
      timeZone: 'America/New_York',
      month: 'short', 
      day: 'numeric', 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    })} EST

If you're reading this, everything is working! 🎯`;

    // Get user's SMS gateway (with fallback to default)
    const smsGateway = await getSmsGatewayWithFallback(userId);
    console.log(`📱 Test SMS sending to: ${smsGateway}`);

    const smsResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'BudgeNudge <noreply@krezzo.com>',
        to: [smsGateway],
        subject: 'BudgeNudge Test',
        text: testMessage,
      }),
    });

    if (!smsResponse.ok) {
      throw new Error(`SMS failed: ${smsResponse.status}`);
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Test SMS sent successfully' 
    });

  } catch (error) {
    console.error('Test SMS error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
} 