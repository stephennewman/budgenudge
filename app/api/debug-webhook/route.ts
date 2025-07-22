import { NextRequest, NextResponse } from 'next/server';

/**
 * Debug version of SlickText webhook to troubleshoot AI responses
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔍 DEBUG: SlickText webhook received...');
    
    const webhookData = await request.json();
    console.log('📋 DEBUG: Webhook payload:', webhookData);
    
    const {
      contact_id,
      phone_number,
      message
    } = webhookData;
    
    if (!message || !phone_number) {
      throw new Error('Invalid webhook payload: missing message or phone_number');
    }
    
    const userMessage = message.trim().toUpperCase();
    const cleanPhone = phone_number.replace(/^\+1/, '').replace(/\D/g, '');
    
    console.log(`📱 DEBUG: Processing message from ${cleanPhone}: "${message}"`);
    console.log(`📱 DEBUG: Uppercase version: "${userMessage}"`);
    
    let responseMessage = '';
    let responseType = 'unknown';
    
    // Command processing
    switch (userMessage) {
      case 'STOP':
      case 'UNSUBSCRIBE':
                  responseMessage = "You've been unsubscribed from Krezzo alerts. Text START to resume.";
        responseType = 'command:STOP';
        break;
        
      case 'START':
      case 'SUBSCRIBE':
                  responseMessage = "Welcome back! You'll receive Krezzo transaction alerts again.";
        responseType = 'command:START';
        break;
        
      case 'HELP':
                  responseMessage = "Krezzo Financial Alerts 💰\n\nCommands: BALANCE, STOP, START\n\nVisit: https://budgenudge.vercel.app";
        responseType = 'command:HELP';
        break;
        
      case 'BALANCE':
        responseMessage = "💰 Check your account at https://budgenudge.vercel.app";
        responseType = 'command:BALANCE';
        break;
        
      default:
        // Generate AI response for non-commands
        console.log('🤖 DEBUG: Non-command detected, generating AI response...');
        responseType = 'ai-response';
        responseMessage = await generateAIResponseDebug(message);
        break;
    }
    
    console.log(`📤 DEBUG: Response type: ${responseType}`);
    console.log(`📤 DEBUG: Response message: "${responseMessage}"`);
    
    // Simulate sending response (don't actually send via SlickText in debug mode)
    let sendResult = { success: false, error: 'Debug mode - not actually sent' };
    
    if (responseMessage && contact_id) {
      console.log(`📤 DEBUG: Would send to contact ${contact_id}:`);
      console.log(`📤 DEBUG: Message length: ${responseMessage.length} characters`);
      
      // Just log what we would send, don't actually send
      sendResult = { success: true, error: '' };
    }
    
    return NextResponse.json({
      success: true,
      debug: {
        originalMessage: message,
        uppercaseMessage: userMessage,
        phoneNumber: cleanPhone,
        contactId: contact_id,
        responseType: responseType,
        responseMessage: responseMessage,
        responseLength: responseMessage.length,
        sendResult: sendResult,
        aiConfigured: {
          aiEnabled: process.env.SMS_AI_RESPONSES_ENABLED === 'true',
          openaiKeyExists: !!process.env.OPENAI_API_KEY,
          slicktextKeyExists: !!process.env.SLICKTEXT_API_KEY,
          brandIdExists: !!process.env.SLICKTEXT_BRAND_ID
        }
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ DEBUG: Webhook processing failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Webhook processing failed',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * Debug version of AI response generation
 */
async function generateAIResponseDebug(message: string): Promise<string> {
  try {
    console.log('🤖 DEBUG: Checking AI configuration...');
    console.log('🤖 DEBUG: SMS_AI_RESPONSES_ENABLED =', process.env.SMS_AI_RESPONSES_ENABLED);
    console.log('🤖 DEBUG: OPENAI_API_KEY exists =', !!process.env.OPENAI_API_KEY);
    
    if (process.env.SMS_AI_RESPONSES_ENABLED !== 'true' || !process.env.OPENAI_API_KEY) {
      console.log('⚠️ DEBUG: AI disabled or key missing, using fallback');
      return getKeywordResponseDebug(message);
    }
    
    console.log('✅ DEBUG: AI configured, calling OpenAI...');
    
    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are Krezzo AI assistant. Keep responses under 300 characters for SMS. Help with financial questions.'
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
      const aiResponse = data.choices[0]?.message?.content;
      console.log('✅ DEBUG: OpenAI response received:', aiResponse);
      return aiResponse || getKeywordResponseDebug(message);
    } else {
      const errorText = await response.text();
      console.warn('⚠️ DEBUG: AI response failed:', errorText);
      return getKeywordResponseDebug(message);
    }
  } catch (error) {
    console.error('❌ DEBUG: AI response error:', error);
    return getKeywordResponseDebug(message);
  }
}

/**
 * Debug version of keyword responses
 */
function getKeywordResponseDebug(message: string): string {
  const lowerMessage = message.toLowerCase();
  console.log('🔍 DEBUG: Using keyword fallback for:', lowerMessage);
  
  if (lowerMessage.includes('spend') || lowerMessage.includes('money') || lowerMessage.includes('groceries')) {
    return "💰 Check your spending at https://budgenudge.vercel.app";
  }
  
  if (lowerMessage.includes('balance') || lowerMessage.includes('account')) {
    return "💳 View account balance at https://budgenudge.vercel.app";
  }
  
              return "Hi! I'm Krezzo's assistant. Visit https://budgenudge.vercel.app or text HELP!";
} 