import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// Initialize clients
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// System prompt for income profile setup
const SYSTEM_PROMPT = `You are Krezzo's AI assistant helping users set up their income profiles for personalized financial insights.

Your goal: Understand the user's income schedule(s) and convert to structured data.

Key patterns to recognize:
- "bi-weekly" or "every two weeks" = bi-weekly pattern
- "twice a month", "15th and last day", "semi-monthly" = bi-monthly pattern  
- "every Friday", "weekly" = weekly pattern
- "first of the month", "monthly" = monthly pattern

For couples/families:
- Ask about shared accounts
- Identify multiple income sources
- Get both schedules

Business day adjustments:
- "15th or preceding business day"
- "last day of month unless weekend"

Always confirm details before finalizing.

Respond conversationally and naturally. Extract these fields when complete:
{
  "income_sources": [
    {
      "source_name": "CHECKIT LLC PAYROLL",
      "pattern_type": "bi-monthly", 
      "schedule": {"days": [15, -1], "business_day_adjustment": true},
      "amount": 4020,
      "person": "user"
    }
  ],
  "shared_account": true,
  "setup_complete": true
}`;

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function POST(request: NextRequest) {
  try {
    const { message, userId, conversationId } = await request.json();

    if (!message || !userId) {
      return NextResponse.json({ error: 'Message and userId required' }, { status: 400 });
    }

    // Generate conversation ID if not provided
    const currentConversationId = conversationId || crypto.randomUUID();

    // Get conversation history
    const { data: conversationHistory } = await supabase
      .from('ai_conversations')
      .select('message_type, content')
      .eq('user_id', userId)
      .eq('conversation_id', currentConversationId)
      .order('created_at', { ascending: true });

    // Build messages array for OpenAI
    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT }
    ];

    // Add conversation history
    if (conversationHistory) {
      conversationHistory.forEach(msg => {
        if (msg.message_type === 'user' || msg.message_type === 'assistant') {
          messages.push({
            role: msg.message_type,
            content: msg.content
          });
        }
      });
    }

    // Add current user message
    messages.push({ role: 'user', content: message });

    // Get response from OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: messages,
      temperature: 0.7,
      max_tokens: 500,
      functions: [
        {
          name: 'save_income_profile',
          description: 'Save the completed income profile when user confirms all details',
          parameters: {
            type: 'object',
            properties: {
              income_sources: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    source_name: { type: 'string' },
                    pattern_type: { type: 'string', enum: ['weekly', 'bi-weekly', 'bi-monthly', 'monthly', 'custom'] },
                    schedule: { type: 'object' },
                    amount: { type: 'number' },
                    person: { type: 'string' }
                  }
                }
              },
              shared_account: { type: 'boolean' },
              setup_complete: { type: 'boolean' }
            },
            required: ['income_sources', 'setup_complete']
          }
        }
      ],
      function_call: 'auto'
    });

    const aiResponse = completion.choices[0]?.message;
    let responseContent = aiResponse?.content || 'I apologize, but I had trouble processing that. Could you please try again?';
    let extractedData = {};
    let profileSaved = false;

    // Handle function call (profile saving)
    if (aiResponse?.function_call?.name === 'save_income_profile') {
      try {
        const profileData = JSON.parse(aiResponse.function_call.arguments);
        extractedData = profileData;

        // Save to user_income_profiles
        const { data: savedProfile, error: profileError } = await supabase
          .from('user_income_profiles')
          .upsert({
            user_id: userId,
            profile_data: profileData,
            setup_completed: profileData.setup_complete || false,
            last_conversation_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (!profileError && savedProfile) {
          profileSaved = true;
          responseContent = "Perfect! I've saved your income profile. Your SMS insights will now be personalized to your specific paycheck schedule. You can update this anytime by chatting with me again.";
        }
      } catch (error) {
        console.error('Error saving profile:', error);
        responseContent = "I understood your income details, but had trouble saving them. Let me try again.";
      }
    }

    // Save conversation messages
    const conversationInserts = [
      {
        user_id: userId,
        conversation_id: currentConversationId,
        message_type: 'user',
        content: message,
        intent: 'income_setup',
        extracted_data: {}
      },
      {
        user_id: userId,
        conversation_id: currentConversationId,
        message_type: 'assistant',
        content: responseContent,
        intent: 'income_setup',
        extracted_data: extractedData
      }
    ];

    await supabase
      .from('ai_conversations')
      .insert(conversationInserts);

    return NextResponse.json({
      success: true,
      response: responseContent,
      conversationId: currentConversationId,
      profileSaved,
      extractedData: Object.keys(extractedData).length > 0 ? extractedData : undefined
    });

  } catch (error) {
    console.error('AI Chat Error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat message' },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve conversation history
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const conversationId = searchParams.get('conversationId');

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    let query = supabase
      .from('ai_conversations')
      .select('*')
      .eq('user_id', userId);

    if (conversationId) {
      query = query.eq('conversation_id', conversationId);
    }

    const { data: conversations, error } = await query
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    // Also get current profile if exists
    const { data: profile } = await supabase
      .from('user_income_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    return NextResponse.json({
      success: true,
      conversations: conversations || [],
      profile: profile || null
    });

  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversation history' },
      { status: 500 }
    );
  }
} 