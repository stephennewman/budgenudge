import { NextRequest, NextResponse } from 'next/server';

// Type definitions for webhook data
interface ContactData {
  phone_number?: string;
  phone?: string;
  first_name?: string;
  firstName?: string;
  last_name?: string;
  lastName?: string;
  email?: string;
}

interface WebhookData {
  data?: ContactData;
  contact?: ContactData;
  [key: string]: unknown;
}

/**
 * SlickText Webhook Handler for Two-Way SMS Messaging
 * Processes incoming SMS replies and sends intelligent responses
 */
export async function POST(request: NextRequest) {
  try {
    console.log('📨 SlickText webhook received...');
    
    const webhookData = await request.json();
    
    // Check if this is a contact creation event (form submission)
    if (webhookData.name === 'contact_created' || webhookData.event === 'contact_created') {
      return await handleContactCreated(webhookData);
    }
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
                  responseMessage = "You've been unsubscribed from Krezzo texts. Text START to resume. For support: https://get.krezzo.com";
        break;
        
      case 'START':
      case 'SUBSCRIBE':
                  responseMessage = "Welcome back! You'll receive Krezzo texts again. Text HELP for assistance or STOP to unsubscribe.";
        break;
        
      case 'HELP':
                  responseMessage = "Krezzo texts 💰\n\nCommands:\n• BALANCE - Check account\n• STOP - Unsubscribe\n• START - Resubscribe\n\nOr ask questions about your spending! Visit: https://get.krezzo.com";
        break;
        
      case 'BALANCE':
                  responseMessage = "💰 To check your account balance and recent transactions, please log into Krezzo at https://get.krezzo.com. For immediate help, text HELP.";
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
            content: `You are Krezzo AI, a helpful assistant providing support via SMS texts. Krezzo is a financial transaction monitoring app that sends SMS alerts about the user's money and purchasing habits across merchants, transactions, categories, and more.

Key features:
- Financial alerts via SMS
- Spending categorization and analysis  
- Weekly spending summaries
- Recurring bill tracking

Respond helpfully but keep responses under 300 characters for SMS. Direct users to https://get.krezzo.com for detailed account access. Be concise, friendly and professional.`
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
                return "💰 To view your spending and transactions, please log into Krezzo at https://get.krezzo.com. Text HELP for more options!";
  }
  
  if (lowerMessage.includes('balance') || lowerMessage.includes('account')) {
                return "💳 Check your account balance and recent activity on the Krezzo dashboard: https://get.krezzo.com";
  }
  
  if (lowerMessage.includes('alert') || lowerMessage.includes('notification')) {
                return "🔔 Krezzo sends texts about your money and spending. Manage alerts at https://get.krezzo.com or text STOP to unsubscribe.";
  }
  
    // Default helpful response
  return "Hi! I'm Krezzo AI. I help with financial monitoring questions. Visit https://get.krezzo.com or text HELP for commands!";
}

/**
 * Handle contact creation events (form submissions)
 */
async function handleContactCreated(webhookData: WebhookData): Promise<NextResponse> {
  try {
    console.log('📝 Processing SlickText contact creation...');
    
    const contactData = webhookData.data || webhookData.contact || (webhookData as ContactData);
    
    // Extract contact information
    const phoneNumber = contactData?.phone_number || contactData?.phone || '';
    const firstName = contactData?.first_name || contactData?.firstName || '';
    const lastName = contactData?.last_name || contactData?.lastName || '';
    const email = contactData?.email || '';
    
    console.log('📊 Contact data extracted:', { phoneNumber, firstName, lastName, email });
    
    if (!phoneNumber) {
      console.log('⚠️ No phone number found in contact data');
      return NextResponse.json({ success: true, message: 'No phone number to process' });
    }
    
    // Store in our database
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Clean phone number
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    
    // Generate tracking token
    const trackingToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    const { data, error } = await supabase
      .from('sample_sms_leads')
      .insert({
        phone_number: cleanPhone,
        email: email,
        first_name: firstName,
        last_name: lastName,
        source: 'slicktext_webhook',
        tracking_token: trackingToken,
        opted_in_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (error) {
      console.error('❌ Database error:', error);
      return NextResponse.json({ 
        success: false, 
        error: 'Database error',
        details: error.message 
      }, { status: 500 });
    }
    
    console.log('✅ Contact stored successfully:', data);
    
    return NextResponse.json({
      success: true,
      message: 'Contact created and stored',
      leadId: data.id,
      trackingToken: trackingToken
    });
    
  } catch (error) {
    console.error('❌ Contact creation handler error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Contact creation failed'
    }, { status: 500 });
  }
} 