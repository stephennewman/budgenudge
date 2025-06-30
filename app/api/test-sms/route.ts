import { NextResponse } from 'next/server';

export async function POST() {
  try {
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

    const smsResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'BudgeNudge <noreply@krezzo.com>',
        to: ['6173472721@tmomail.net'],
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