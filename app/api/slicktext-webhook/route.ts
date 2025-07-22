import { NextRequest, NextResponse } from 'next/server';

/**
 * SlickText Webhook Handler for Two-Way SMS Messaging
 * Processes incoming SMS replies and sends intelligent responses
 */
export async function POST(request: NextRequest) {
  try {
    console.log('📨 SlickText webhook received...');
    
    const webhookData = await request.json();
    console.log('�� Webhook payload:', JSON.stringify(webhookData, null, 2));
    
    // Extract from SlickText's actual payload format
    const data = webhookData.data || webhookData;
    const {
      _contact_id: contactId,
      last_message: message,
      last_message_direction: direction
    } = data;
    
    // Only process incoming messages
    if (direction !== 'incoming') {
      console.log('⏭️ Skipping non-incoming message');
      return NextResponse.json({ success: true, message: 'Non-incoming message ignored' });
    }
    
    if (!message || !contactId) {
      throw new Error('Invalid webhook payload: missing message or contact_id');
    }
    
    const userMessage = message.trim().toUpperCase();
    
    console.log(`📱 Processing message from contact ${contactId}: "${message}"`);
    
    let responseMessage = '';
    
    // Command processing
    switch (userMessage) {
      case 'STOP':
      case 'UNSUBSCRIBE':
                  responseMessage = "You've been unsubscribed from Krezzo alerts. Text START to resume. For support: https://budgenudge.vercel.app";
        break;
        
      case 'START':
      case 'SUBSCRIBE':
                  responseMessage = "Welcome back! You'll receive Krezzo transaction alerts again. Text HELP for assistance or STOP to unsubscribe.";
        break;
        
      case 'HELP':
                  responseMessage = "Krezzo Financial Alerts 💰\n\nCommands:\n• BALANCE - Check account\n• STOP - Unsubscribe\n• START - Resubscribe\n\nOr ask questions about your spending! Visit: https://budgenudge.vercel.app";
        break;
        
      case 'BALANCE':
                  responseMessage = "💰 To check your account balance and recent transactions, please log into your Krezzo dashboard at https://budgenudge.vercel.app. For immediate help, text HELP.";
        break;
        
      default:
        // Generate AI response for non-commands
        responseMessage = await generateAIResponse(message);
        break;
    }
    
    // Send response back via SlickText
    if (responseMessage && contactId) {
      try {
        console.log(`📤 Sending response to contact ${contactId}:`, responseMessage);
        
        const apiKey = process.env.SLICKTEXT_API_KEY;
        const slickTextBrandId = process.env.SLICKTEXT_BRAND_ID;
        
        const response = await fetch(`https://dev.slicktext.com/v1/brands/${slickTextBrandId}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'User-Agent': 'Krezzo/1.0'
          },
          body: JSON.stringify({
            body: responseMessage,
            contact_id: parseInt(contactId),
            send_immediately: true
          })
        });
        
        if (response.ok) {
          console.log('✅ Response sent successfully');
        } else {
          const errorText = await response.text();
          console.error('❌ Failed to send response:', errorText);
        }
      } catch (error) {
        console.error('❌ Error sending response:', error);
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Webhook processed successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Webhook processing failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Webhook processing failed',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * Generate AI response for non-command messages
 */
async function generateAIResponse(message: string): Promise<string> {
  try {
    if (process.env.SMS_AI_RESPONSES_ENABLED !== 'true' || !process.env.OPENAI_API_KEY) {
      // Fallback to keyword-based responses
      return getKeywordResponse(message);
    }
    
    // Use OpenAI for intelligent responses
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are Krezzo's AI assistant for SMS support. Krezzo is a real-time financial transaction monitoring app that sends SMS alerts when users spend money.

Key features:
- Real-time transaction alerts via SMS
- Spending categorization and analysis  
- Weekly spending summaries
- Recurring bill tracking
- Calendar view of transactions

Respond helpfully but keep responses under 300 characters for SMS. Direct users to https://budgenudge.vercel.app for detailed account access. Be friendly and professional.`
          },
          {
            role: 'user',
            content: message
          }
        ],
        max_tokens: 150,
        temperature: 0.7,
      }),
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.choices[0]?.message?.content || getKeywordResponse(message);
    } else {
      console.warn('AI response failed, using fallback');
      return getKeywordResponse(message);
    }
  } catch (error) {
    console.error('AI response error:', error);
    return getKeywordResponse(message);
  }
}

/**
 * Fallback keyword-based responses
 */
function getKeywordResponse(message: string): string {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('spend') || lowerMessage.includes('money') || lowerMessage.includes('transaction')) {
                return "💰 To view your spending and transactions, please log into Krezzo at https://budgenudge.vercel.app. Text HELP for more options!";
  }
  
  if (lowerMessage.includes('balance') || lowerMessage.includes('account')) {
                return "💳 Check your account balance and recent activity on the Krezzo dashboard: https://budgenudge.vercel.app";
  }
  
  if (lowerMessage.includes('alert') || lowerMessage.includes('notification')) {
                return "🔔 Krezzo sends real-time alerts when you spend money. Manage alerts at https://budgenudge.vercel.app or text STOP to unsubscribe.";
  }
  
  // Default helpful response
              return "Hi! I'm Krezzo's assistant. I help with financial monitoring questions. Visit https://budgenudge.vercel.app or text HELP for commands!";
} 