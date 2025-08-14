'use client';

import { useState, useEffect } from 'react';
import { createSupabaseClient } from '@/utils/supabase/client';
import { Card } from '@/components/ui/card';
import { ContentAreaLoader } from '@/components/ui/content-area-loader';
import { Button } from '@/components/ui/button';
// Removed add-recipient UI; it now lives on /protected/texts

interface SMSPreference {
  id?: number;
  user_id: string;
  sms_type: 'bills' | 'activity' | 'merchant-pacing' | 'category-pacing' | 'weekly-summary' | 'monthly-summary' | 'cash-flow-runway' | '415pm-special';
  // TEMPORARILY DISABLED - Paycheck templates
  // | 'paycheck-efficiency' | 'cash-flow-runway';
  enabled: boolean;
  frequency: '30min' | 'hourly' | 'daily' | 'weekly';
  phone_number?: string;
}

  // Define active SMS template types for previews (activity removed)
  const activeSmsTypes = ['bills', 'merchant-pacing', 'category-pacing', 'weekly-summary', 'monthly-summary', 'cash-flow-runway', '415pm-special', '415-krezzo', 'five-oclock-somewhere'];

const smsTypeInfo = {
  '415-krezzo': {
    title: '415 Krezzo',
    description: 'Daily 5:00 PM Eastern summary (alias of Krezzo report)',
    icon: '📊',
    example: 'Sample 4:15 Krezzo report preview.'
  },
  'five-oclock-somewhere': {
    title: "5 o'clock Somewhere",
    description: 'Daily 5:00 PM Eastern summary (friendly alias)',
    icon: '🕔',
    example: 'Sample 5 o\'clock summary preview.'
  },
  bills: {
    title: 'Bills & Payments',
    description: 'Upcoming bills and payment reminders from tagged merchants',
    icon: '💳',
    example: `⭐ Recurring Bills\n9 upcoming\n\nJul 15: Disney+ - $3.41\nJul 16: Netflix - $28.30\nJul 16: Duke Energy - $308.00\nJul 16: Fccu A2a Acct - $424.61\nJul 21: Everydaydose Dose  - $36.00\nJul 22: GEICO - $114.18\nJul 23: Prudential - $30.02\nJul 27: Amazon Prime - $15.13\nJul 28: Spectrum - $118.00\n\nNEXT 7 DAYS: $800.32\nNEXT 14 DAYS: $1077.65\nNEXT 30 DAYS: $3841.29`
  },

  'merchant-pacing': {
    title: 'Merchant Pacing',
    description: 'Spending pacing analysis for your tracked merchants (configure on Merchants page)',
    icon: '🏪',
    example: `📊 MERCHANT PACING\nJuly 2025\nMonth Progress: 68% (Day 21)\n\n🟢 Amazon:\n   Month to date: $156.00\n   Expected by now: $142.35\n   Avg monthly: $280.00\n   Pacing: 90%\n   Status: Under pace\n\n🔴 Publix:\n   Month to date: $287.50\n   Expected by now: $210.45\n   Avg monthly: $325.00\n   Pacing: 137%\n   Status: Over pace`
  },
  'category-pacing': {
    title: 'Category Pacing',
    description: 'Spending pacing analysis for your tracked spending categories (configure on Categories page)',
    icon: '📊',
    example: `📊 CATEGORY PACING\nJuly 2025\nMonth Progress: 68% (Day 21)\n\n🟢 Groceries:\n   Month to date: $287.50\n   Expected by now: $210.45\n   Avg monthly: $325.00\n   Pacing: 90%\n   Status: Under pace\n\n🔴 Restaurant:\n   Month to date: $156.00\n   Expected by now: $142.35\n   Avg monthly: $180.00\n   Pacing: 137%\n   Status: Over pace`
  },
  'weekly-summary': {
    title: 'Weekly Spending Summary',
    description: 'Comprehensive weekly spending analysis sent every Sunday at 7:00 AM EST',
    icon: '📊',
    example: `📊 WEEKLY SPENDING SUMMARY\nJul 13 - Jul 19\n\n💰 Available Balance: $3,083.26\n\n💳 Total Spent: $3,962.93\n📈 Transactions: 73\n📈 98% more than prev week\n\n🏷️ Top Categories:\n1. Tithe: $1,065.00 (27%)\n2. Utilities: $398.79 (10%)\n3. Restaurant: $358.36 (9%)\n\n🏪 Top Merchants:\n1. Generations: $1,065.00\n2. Venmo: $355.00\n3. Duke Energy: $258.98\n4. Publix: $250.80\n\n📅 Daily Breakdown:\nSun: $1,712.40  Mon: $357.29  Tue: $206.13  Wed: $758.23  Thu: $615.59  Fri: $144.98  Sat: $168.31`
  },
  'monthly-summary': {
    title: 'Monthly Spending Summary',
    description: 'Comprehensive monthly spending recap sent on the 1st of each month at 7:00 AM EST',
    icon: '🗓️',
    example: `📊 MONTHLY SPENDING SUMMARY\nJune 2025\n\n💰 Current Balance: $3,083.26\n\n💳 Total Spent: $12,547.89\n📈 Transactions: 234\n📉 15% less than prev month\n\n🏷️ Top Categories:\n1. Groceries: $2,847 (23%)\n2. Restaurant: $1,965 (16%)\n3. Utilities: $1,234 (10%)\n4. Transportation: $987 (8%)\n\n🏪 Top Merchants:\n1. Publix: $1,456\n2. Amazon: $1,234\n3. Duke Energy: $798\n4. Shell: $634\n\n📅 Weekly Breakdown:\nWeek 1: $3,124  Week 2: $2,987  Week 3: $3,456  Week 4: $2,981\n\n📊 Daily Average: $405`
  },
  'cash-flow-runway': {
    title: 'Cash Flow Runway',
    description: 'Daily at 5:00 PM EST. Forecast until next paycheck and whether you\'re on track.',
    icon: '🛤️',
    example: `🛤️ CASH FLOW RUNWAY\n9 days until next paycheck (Jul 29)\nBills before then: $842\nProjected spend: $567\nStatus: At risk\nTip: Reduce discretionary by ~$63/day to stay on track.\n\n⚠️ Predictions based on historical data`
  },
  '415pm-special': {
    title: 'Krezzo Report (Daily)',
    description: 'Daily at 5:00 PM Eastern. Comprehensive snapshot with transactions, pacing, income, and expenses.',
    icon: '📊',
    example: `📊 DAILY SNAPSHOT\n\nHey there! Here's your daily financial snapshot.\n\n📋 YESTERDAY'S ACTIVITY\n━━━━━━━━━━━━━━━━━━\nTotal posted transactions: 3\n\nPublix: $45.12\nAmazon: $28.99\nShell: $52.67\n\nTotal spend: $126.78\nBalance: $3,083\n\n📊 SPENDING PACE\n━━━━━━━━━━━━━━━━━━\nGROCERIES\nSpent: $288 | Expected: $210\n🚨 OVER by 37%\n\n🏪 MERCHANT WATCH\n━━━━━━━━━━━━━━━━━━\nAMAZON\nSpent: $156 | Expected: $142\n⚠️ APPROACHING by 10%\n\n💵 DAILY BUDGET\n━━━━━━━━━━━━━━━━━━\nNext income: Jul 29: $4,020\nUpcoming expenses before then: 5 for $842\nAvailable now: $3,083\nAfter expenses: $2,241\nDaily spend limit: $249/day for 9 days (until Jul 29)\n\n🙌 INSPIRATION\n━━━━━━━━━━━━━━━━━━\nYou're doing great! 🌟 Keep monitoring your spending and stay within your daily budget.`
  },
  // TEMPORARILY DISABLED - Paycheck templates
  // 'paycheck-efficiency': {
  //   title: 'Paycheck Efficiency Analysis',
  //   description: 'Paycheck-period insights sent on Tuesdays & Fridays at 9 AM EST analyzing spending vs income timing',
  //   icon: '💰',
  //   example: `💰 PAYCHECK EFFICIENCY\n6 days into current period\n\n🏦 Period Income: $5,820\n💸 Spent So Far: $2,140 (37%)\n📊 On track for $3,680 total\n\n🏷️ Top Categories:\n1. Groceries: $847 (40%)\n2. Restaurant: $456 (21%)\n3. Gas: $234 (11%)\n\n⏰ Next CHECKIT paycheck: Jul 29\n🎯 Projected balance: $2,963`
  // },
  // 'cash-flow-runway': {
  //   title: 'Cash Flow Runway',
  //   description: 'Financial runway analysis sent on Tuesdays & Fridays at 9 AM EST showing how long current balance will last',
  //   icon: '🛤️',
  //   example: `🛤️ CASH FLOW RUNWAY\nCurrent Balance: $3,083\n\n⏰ Next Income: 11 days\n💰 Expected: $4,020 (CHECKIT)\n💸 Known Bills: $847\n📊 Runway: 18 days at current pace\n\n🔄 Income Sources:\n• CHECKIT LLC: $4,020 bi-weekly\n• GCA PAY: $1,800 bi-weekly\n\n🎯 Projected after next paycheck: $6,256`
  // }
};

export default function SMSPreferencesPage() {
  // Retained for potential future enablement toggles; currently unused in simplified preview UI
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [preferences, setPreferences] = useState<SMSPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [liveSmsContent, setLiveSmsContent] = useState<Record<string, { content: string; loading: boolean; error?: string; isSample?: boolean }>>({});
  const supabase = createSupabaseClient();

  useEffect(() => {
    loadUserAndPreferences();
    // No dependencies needed, functions are defined inline
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadUserAndPreferences = async () => {
    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        setMessage({ type: 'error', text: 'Please log in to manage SMS preferences' });
        setLoading(false);
        return;
      }

      // Fetch SMS preferences
      const response = await fetch(`/api/sms-preferences?userId=${user.id}`);
      const data = await response.json();

      if (data.success) {
        setPreferences(data.preferences);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to load preferences' });
      }

    } catch (error) {
      console.error('Error loading preferences:', error);
      setMessage({ type: 'error', text: 'Failed to load preferences' });
    } finally {
      setLoading(false);
    }
  };

  const generateLiveSMS = async (smsType: string) => {
    try {
      setLiveSmsContent(prev => ({
        ...prev,
        [smsType]: { content: '', loading: true, error: undefined }
      }));

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Generate live SMS content using the SMS templates API
      // Map friendly aliases to 415pm-special generator
      const templateType = (smsType === '415-krezzo' || smsType === 'five-oclock-somewhere') ? '415pm-special' : smsType;

      const response = await fetch('/api/manual-sms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          templateType,
          phoneNumber: user.user_metadata?.signupPhone || user.phone
        })
      });

      const data = await response.json();
      
      if (data.success && data.smsContent) {
        setLiveSmsContent(prev => ({
          ...prev,
          [smsType]: { content: data.smsContent, loading: false, error: undefined, isSample: false }
        }));
      } else {
        // Fallback to sample if no real data
        const info = smsTypeInfo[smsType as keyof typeof smsTypeInfo];
        setLiveSmsContent(prev => ({
          ...prev,
          [smsType]: { content: info?.example || 'Sample preview unavailable', loading: false, error: undefined, isSample: true }
        }));
      }

    } catch (error) {
      console.error(`Error generating ${smsType} SMS:`, error);
      setLiveSmsContent(prev => ({
        ...prev,
        [smsType]: { 
          content: smsTypeInfo[smsType as keyof typeof smsTypeInfo]?.example || '', 
          loading: false, 
          error: undefined,
          isSample: true
        }
      }));
    }
  };

  if (loading) {
    return (
      <div className="relative min-h-[600px]">
        <ContentAreaLoader />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div className="flex flex-col">
          <h1 className="text-2xl font-medium">📱 Texts</h1>
          <p className="text-muted-foreground mt-2">
            Daily summary is sent every day at <span className="font-semibold">5:00 PM EST</span>.
            <br />
            Weekly summaries are sent every <span className="font-semibold">Sunday at 7:00 AM EST</span>.
            <br />
            Monthly summaries are sent on the <span className="font-semibold">1st of each month at 7:00 AM EST</span>.
          </p>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-lg mb-6 ${
          message.type === 'success' 
            ? 'bg-green-50 border border-green-200 text-green-800' 
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {message.text}
        </div>
      )}

      {/* Preview first: actual data preview at top */}
      <div className="mb-6">
        <Card className="p-4">
          <h2 className="text-lg font-medium mb-3">🔍 Preview</h2>
          <p className="text-sm text-gray-600 mb-3">Select a template below to generate a preview. If real data is unavailable, a clearly marked sample will be shown.</p>
        </Card>
      </div>

      <div className="grid gap-6">
        {activeSmsTypes.map((type) => {
          const key = type as keyof typeof smsTypeInfo;
          const info = smsTypeInfo[key];
          const liveContent = liveSmsContent[type];
          
          return (
            <Card key={type} className="p-6">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{info.icon}</span>
                    <div>
                      <h3 className="text-xl font-semibold">{info.title}</h3>
                      <p className="text-gray-600">{info.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => generateLiveSMS(type)}
                      disabled={liveContent?.loading}
                      variant="outline"
                      size="sm"
                    >
                      {liveContent?.loading ? 'Generating...' : 'Show Live SMS'}
                    </Button>
                    {/* Add recipient lives on /protected/texts */}
                  </div>
                </div>

                {/* Live SMS Content */}
                {liveContent && (liveContent.content || liveContent.error) && (
                  <div className={`p-3 rounded-lg ${
                    liveContent.error ? 'bg-red-50 border border-red-200' : 'bg-blue-50 border border-blue-200'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">
                        {liveContent.error ? 'Error' : (liveContent.isSample ? 'Sample Preview' : 'Live SMS Content')}
                      </span>
                      {liveContent.content && (
                        <span className="text-xs text-gray-500">
                          {liveContent.content.length} characters
                        </span>
                      )}
                    </div>
                    {liveContent.error ? (
                      <p className="text-sm text-red-700">{liveContent.error}</p>
                    ) : (
                      <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono" style={{ margin: 0 }}>
                        {liveContent.content}
                      </pre>
                    )}
                  </div>
                )}

                {/* Example SMS Content */}
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-600">Example Template</span>
                    <span className="text-xs text-gray-500">
                      {info.example.length} characters
                    </span>
                  </div>
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono" style={{ margin: 0 }}>
                    {info.example}
                  </pre>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
} 

// (Add recipient UI removed)