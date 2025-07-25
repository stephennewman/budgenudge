'use client';

import { useState, useEffect, useRef } from 'react';
import { createSupabaseClient } from '@/utils/supabase/client';

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  profileSaved?: boolean;
}

interface IncomeProfile {
  income_sources: Array<{
    source_name: string;
    pattern_type: string;
    schedule: object;
    amount: number;
    person: string;
  }>;
  shared_account: boolean;
  setup_complete: boolean;
}

export default function AIIncomeChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<IncomeProfile | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createSupabaseClient();

  useEffect(() => {
    // Get current user and initialize conversation
    const initializeChat = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        
        // Load existing conversations and profile
        try {
          const response = await fetch(`/api/ai-chat/income-setup?userId=${user.id}`);
          const data = await response.json();
          
          if (data.success) {
            // Convert conversations to chat messages
            const chatMessages: ChatMessage[] = data.conversations.map((conv: { id: number; message_type: string; content: string; created_at: string; extracted_data?: { setup_complete?: boolean } }) => ({
              id: conv.id.toString(),
              type: conv.message_type,
              content: conv.content,
              timestamp: new Date(conv.created_at),
              profileSaved: conv.extracted_data?.setup_complete || false
            }));
            
            setMessages(chatMessages);
            setProfile(data.profile?.profile_data || null);
            
            // Get conversation ID from last message if exists
            if (data.conversations.length > 0) {
              setConversationId(data.conversations[0].conversation_id);
            }
          }
          
          // Add welcome message if no conversation exists
          if (!data.conversations || data.conversations.length === 0) {
            const welcomeMessage: ChatMessage = {
              id: 'welcome',
              type: 'assistant',
              content: "Hi! I'm here to help set up your income profile for personalized SMS insights. When do you typically get paid?",
              timestamp: new Date()
            };
            setMessages([welcomeMessage]);
          }
        } catch (error) {
          console.error('Error loading chat history:', error);
        }
      }
    };

    initializeChat();
  }, [supabase.auth]);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!currentMessage.trim() || !userId || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: currentMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setCurrentMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai-chat/income-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: currentMessage,
          userId,
          conversationId
        })
      });

      const data = await response.json();

      if (data.success) {
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: data.response,
          timestamp: new Date(),
          profileSaved: data.profileSaved
        };

        setMessages(prev => [...prev, assistantMessage]);
        
        // Update conversation ID and profile if provided
        if (data.conversationId) {
          setConversationId(data.conversationId);
        }
        if (data.extractedData) {
          setProfile(data.extractedData);
        }
      } else {
        throw new Error(data.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: "I'm sorry, I encountered an error. Please try again.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 rounded-t-lg">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-semibold">AI</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Income Profile Setup</h3>
            <p className="text-sm text-gray-500">
              {profile?.setup_complete 
                ? "✅ Profile configured" 
                : "Let's set up your personalized SMS insights"
              }
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="bg-gray-50 h-96 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                message.type === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-900 border border-gray-200'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              <p className={`text-xs mt-1 ${
                message.type === 'user' ? 'text-blue-100' : 'text-gray-500'
              }`}>
                {formatTime(message.timestamp)}
                {message.profileSaved && <span className="ml-2">✅ Saved</span>}
              </p>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white text-gray-900 border border-gray-200 max-w-xs lg:max-w-md px-4 py-2 rounded-lg">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 p-4 rounded-b-lg">
        <div className="flex space-x-2">
          <input
            type="text"
            value={currentMessage}
            onChange={(e) => setCurrentMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
          />
          <button
            onClick={sendMessage}
            disabled={!currentMessage.trim() || isLoading}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </div>

      {/* Profile Summary */}
      {profile && profile.setup_complete && (
        <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="text-lg font-semibold text-green-800 mb-2">✅ Income Profile Configured</h4>
          <div className="space-y-2">
            {profile.income_sources.map((source, index) => (
              <div key={index} className="text-sm text-green-700">
                <strong>{source.source_name}</strong>: ${source.amount.toLocaleString()} ({source.pattern_type})
                {source.person !== 'user' && <span className="text-gray-600"> - {source.person}</span>}
              </div>
            ))}
            {profile.shared_account && (
              <p className="text-sm text-green-600">📊 Shared account detected</p>
            )}
          </div>
          <p className="text-sm text-green-600 mt-2">
            Your SMS insights are now personalized to your paycheck schedule!
          </p>
        </div>
      )}
    </div>
  );
} 