import { NextRequest, NextResponse } from 'next/server';

/**
 * Test endpoint for AI response generation
 * Tests OpenAI integration for SMS responses
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Testing AI response generation...');
    
    const { message, phone } = await request.json();
    
    if (!message) {
      throw new Error('Message is required');
    }
    
    const phoneNumber = phone || '+16173472721';
    const userMessage = message.trim();
    
    console.log(`🤖 Generating AI response for: "${userMessage}"`);
    
    // Test AI response generation
    const aiResponse = await generateAIResponse(userMessage, phoneNumber);
    
    return NextResponse.json({
      success: true,
      aiResponse: aiResponse,
      testContext: {
        phoneNumber: phoneNumber,
        userMessage: userMessage,
        userProfile: {
          hasAccount: true,
          recentTransactionCount: 12,
          smsEnabled: true
        }
      },
      timestamp: new Date().toISOString(),
      message: 'AI response generated successfully'
    });
    
  } catch (error) {
    console.error('❌ AI response test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'AI response test failed',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * Generate AI response for testing
 */
async function generateAIResponse(message: string, phoneNumber: string): Promise<{
  success: boolean;
  response?: string;
  tokensUsed?: number;
  fallbackUsed: boolean;
  error?: string;
}> {
  try {
    console.log('🤖 Checking AI configuration...');
    
    if (process.env.SMS_AI_RESPONSES_ENABLED !== 'true' || !process.env.OPENAI_API_KEY) {
      console.log('⚠️ AI responses disabled or OpenAI key missing, using fallback');
      return {
        success: true,
        response: getKeywordResponse(message),
        fallbackUsed: true
      };
    }
    
    console.log('✅ AI configuration found, calling OpenAI...');
    
    // Call OpenAI API
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
            content: `You are BudgeNudge's AI assistant for SMS support. BudgeNudge is a real-time financial transaction monitoring app that sends SMS alerts when users spend money.

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
      const aiResponseText = data.choices[0]?.message?.content;
      const tokensUsed = data.usage?.total_tokens;
      
      console.log(`✅ AI response generated: ${tokensUsed} tokens`);
      
      return {
        success: true,
        response: aiResponseText || getKeywordResponse(message),
        tokensUsed: tokensUsed,
        fallbackUsed: false
      };
    } else {
      const errorText = await response.text();
      console.warn('⚠️ AI response failed:', errorText);
      
      return {
        success: true,
        response: getKeywordResponse(message),
        fallbackUsed: true,
        error: `OpenAI API error: ${response.status}`
      };
    }
  } catch (error) {
    console.error('❌ AI response error:', error);
    
    return {
      success: true,
      response: getKeywordResponse(message),
      fallbackUsed: true,
      error: error instanceof Error ? error.message : 'AI response failed'
    };
  }
}

/**
 * Fallback keyword-based responses
 */
function getKeywordResponse(message: string): string {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('spend') || lowerMessage.includes('money') || lowerMessage.includes('transaction')) {
    return "💰 To view your spending and transactions, please log into BudgeNudge at https://budgenudge.vercel.app. Text HELP for more options!";
  }
  
  if (lowerMessage.includes('balance') || lowerMessage.includes('account')) {
    return "💳 Check your account balance and recent activity on the BudgeNudge dashboard: https://budgenudge.vercel.app";
  }
  
  if (lowerMessage.includes('alert') || lowerMessage.includes('notification')) {
    return "🔔 BudgeNudge sends real-time alerts when you spend money. Manage alerts at https://budgenudge.vercel.app or text STOP to unsubscribe.";
  }
  
  if (lowerMessage.includes('help')) {
    return "BudgeNudge Financial Alerts 💰\n\nCommands:\n• BALANCE - Check account\n• STOP - Unsubscribe\n• START - Resubscribe\n\nOr ask questions about your spending! Visit: https://budgenudge.vercel.app";
  }
  
  // Default helpful response
  return "Hi! I'm BudgeNudge's assistant. I help with financial monitoring questions. Visit https://budgenudge.vercel.app or text HELP for commands!";
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'AI response test endpoint ready',
    usage: {
      method: 'POST',
      body: {
        message: 'Your question here',
        phone: '+16173472721 (optional)'
      }
    },
    examples: [
      {
        description: 'Test spending question',
        curl: `curl -X POST http://localhost:3000/api/test-ai-response -H "Content-Type: application/json" -d '{"message": "What did I spend on groceries this week?"}'`
      },
      {
        description: 'Test balance question',
        curl: `curl -X POST http://localhost:3000/api/test-ai-response -H "Content-Type: application/json" -d '{"message": "What is my account balance?"}'`
      },
      {
        description: 'Test help command',
        curl: `curl -X POST http://localhost:3000/api/test-ai-response -H "Content-Type: application/json" -d '{"message": "HELP"}'`
      }
    ],
    timestamp: new Date().toISOString()
  });
} 