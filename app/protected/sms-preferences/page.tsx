'use client';

import { useState, useEffect } from 'react';
import { createSupabaseClient } from '@/utils/supabase/client';
import { Card } from '@/components/ui/card';
import { BouncingMoneyLoader } from '@/components/ui/bouncing-money-loader';

interface SMSPreference {
  id?: number;
  user_id: string;
  sms_type: 'bills' | 'activity' | 'merchant-pacing' | 'category-pacing';
  enabled: boolean;
  frequency: '30min' | 'hourly' | 'daily' | 'weekly';
  phone_number?: string;
}

// const frequencyOptions = [
//   { value: '30min', label: 'Every 30 minutes' },
//   { value: 'hourly', label: 'Every hour' },
//   { value: 'daily', label: 'Daily' },
//   { value: 'weekly', label: 'Weekly' }
// ];

const smsTypeInfo = {
  bills: {
    title: 'Bills & Payments',
    description: 'Upcoming bills and payment reminders from tagged merchants',
    icon: '💳',
    example: `⭐ Recurring Bills\n9 upcoming\n\nJul 15: Disney+ - $3.41\nJul 16: Netflix - $28.30\nJul 16: Duke Energy - $308.00\nJul 16: Fccu A2a Acct - $424.61\nJul 21: Everydaydose Dose  - $36.00\nJul 22: GEICO - $114.18\nJul 23: Prudential - $30.02\nJul 27: Amazon Prime - $15.13\nJul 28: Spectrum - $118.00\n\nNEXT 7 DAYS: $800.32\nNEXT 14 DAYS: $1077.65\nNEXT 30 DAYS: $3841.29`
  },

  activity: {
    title: 'Yesterday\'s Activity',
    description: 'All transactions from yesterday',
    icon: '📋',
    example: `📱 YESTERDAY'S ACTIVITY\n\nJul 16: Publix - $65.88\nJul 16: Amazon - $25.99\nJul 16: Starbucks - $8.50\nJul 16: Gas Station - $35.00\nJul 16: Restaurant - $67.89\nJul 16: Grocery Store - $89.45\n\n💰 Yesterday's Total: $292.71`
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
  }
};

export default function SMSPreferencesPage() {
  const [preferences, setPreferences] = useState<SMSPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
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

  if (loading) {
    return <BouncingMoneyLoader />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Texts</h1>
          <p className="text-gray-600">
            All SMS will be sent daily at <span className="font-semibold">7:00 AM EST</span>.
          </p>
        </div>
      </div>

      {/* Daily SMS Send Time Picker (hidden) */}
      {/*
      <div className="flex flex-col items-center mb-4">
        <label htmlFor="send-time" className="font-medium mb-1">Daily SMS Send Time (EST):</label>
        <input
          id="send-time"
          type="time"
          value={sendTime}
          onChange={handleSendTimeChange}
          className="border border-gray-300 rounded px-3 py-2 text-lg"
          disabled={sendTimeSaving}
          style={{ width: '120px' }}
        />
        <span className="text-xs text-gray-500 mt-1">All SMS will be sent at this time (Eastern Time)</span>
      </div>
      */}

      {message && (
        <div className={`p-4 rounded-lg mb-6 ${
          message.type === 'success' 
            ? 'bg-green-50 border border-green-200 text-green-800' 
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {message.text}
        </div>
      )}

      <div className="grid gap-6">
        {preferences.map((pref) => {
          const info = smsTypeInfo[pref.sms_type];
          return (
            <Card key={pref.sms_type} className="p-6">
              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{info.icon}</span>
                    <div>
                      <h3 className="text-xl font-semibold">{info.title}</h3>
                      <p className="text-gray-600">{info.description}</p>
                    </div>
                  </div>
                  {/* Hidden enabled checkmarks */}
                </div>

                <div className="bg-gray-50 p-3 rounded-lg">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono" style={{ margin: 0 }}>
                    <strong>Example:</strong>{"\n"}{info.example}
                  </pre>
                </div>

                {/* Frequency dropdown (hidden) */}
                {/*
                {pref.enabled && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor={`${pref.sms_type}-frequency`} className="text-sm font-medium">
                        Frequency
                      </Label>
                      <select
                        id={`${pref.sms_type}-frequency`}
                        value={pref.frequency}
                        onChange={(e) => handlePreferenceChange(pref.sms_type, 'frequency', e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      >
                        {frequencyOptions.map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                        </select>
                    </div>
                  </div>
                )}
                */}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Hidden save button and how it works section */}
    </div>
  );
} 