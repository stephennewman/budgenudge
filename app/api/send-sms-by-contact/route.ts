import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { contactId, message } = await request.json();
    
    if (!contactId || !message) {
      throw new Error('Contact ID and message are required');
    }
    
    console.log(`📱 Sending SMS to contact ID: ${contactId}`);
    
    const apiKey = process.env.SLICKTEXT_API_KEY;
    const brandId = process.env.SLICKTEXT_BRAND_ID;
    const baseUrl = 'https://dev.slicktext.com/v1';
    
    if (!apiKey || !brandId) {
      throw new Error('SlickText API credentials not configured');
    }
    
    // Send message directly using contact ID
    const response = await fetch(`${baseUrl}/brands/${brandId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'BudgeNudge/1.0'
      },
      body: JSON.stringify({
        body: message,
        contact_id: parseInt(contactId),
        send_immediately: true
      })
    });
    
    const responseText = await response.text();
    console.log(`📝 SlickText Message Response (${response.status}):`, responseText);
    
    if (!response.ok) {
      throw new Error(`SlickText API error: ${response.status} - ${responseText}`);
    }
    
    let responseData: Record<string, unknown> = {};
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { message: responseText };
    }
    
    console.log('✅ SMS sent successfully via contact ID');
    
    return NextResponse.json({
      success: true,
      provider: 'slicktext',
      messageId: responseData.id || responseData.message_id,
      contactId: contactId,
      responseData: responseData,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: unknown) {
    console.error('❌ Failed to send SMS by contact ID:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send SMS',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 