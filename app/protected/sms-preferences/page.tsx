'use client';

import { useState, useEffect } from 'react';
import { createSupabaseClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

interface SMSPreference {
  id?: number;
  user_id: string;
  sms_type: 'bills' | 'spending' | 'activity';
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
  spending: {
    title: 'Spending Analysis',
    description: 'Budget analysis, account balance, and AI-powered recommendations',
    icon: '💰',
    example: `📊 SPENDING PACING\nJuly 2025\nMonth Progress: 47% (Day 14)\n\n🟢 Amazon:\n   This month: $120\n   Avg monthly: $130\n   Pacing: 92%\n\n🟡 Publix:\n   This month: $200\n   Avg monthly: $150\n   Pacing: 133%\n\n🟢 Circle K:\n   This month: $40\n   Avg monthly: $45\n   Pacing: 89%`
  },
  activity: {
    title: 'Recent Activity',
    description: 'Recent transactions from the last 3 days',
    icon: '📋',
    example: `📱 RECENT ACTIVITY\nLast 20 Transactions\n\nJul 13: Blush Nail Lounge - $50.00\nJul 13: Legends Hospitalit - $47.31\nJul 13: Publix - $4.99\nJul 13: Publix - $65.88\nJul 13: Vercel Inc. - $20.00\nJul 13: Cursor Usage Mid J - $100.04\nJul 13: Circle K - $43.96\nJul 12: Advance Auto Parts - $17.11\nJul 12: Publix - $56.12\nJul 12: Walmart - $30.87\nJul 12: Amazon - $25.99\nJul 12: Target - $45.67\nJul 11: Starbucks - $8.50\nJul 11: Gas Station - $35.00\nJul 11: Restaurant - $67.89\nJul 10: Grocery Store - $89.45\nJul 10: Pharmacy - $12.99\nJul 10: Coffee Shop - $4.75\nJul 9: Hardware Store - $23.45\nJul 9: Bookstore - $15.99\n\n💰 Total: $678.90`
  }
};

export default function SMSPreferencesPage() {
  const [preferences, setPreferences] = useState<SMSPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [userId, setUserId] = useState<string>('');
  // const [sendTime, setSendTime] = useState<string>('18:00');
  // const [sendTimeSaving, setSendTimeSaving] = useState(false);

  const supabase = createSupabaseClient();

  useEffect(() => {
    loadUserAndPreferences();
    loadSendTime();
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

      setUserId(user.id);

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

  const loadSendTime = async () => {
    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) return;
      const { data: settings } = await supabase
        .from('user_sms_settings')
        .select('send_time')
        .eq('user_id', user.id)
        .single();
      if (settings && settings.send_time) {
        // setSendTime(settings.send_time);
      }
    } catch {
      // ignore
    }
  };

  // const handleSendTimeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  //   const newTime = e.target.value;
  //   // setSendTime(newTime);
  //   // setSendTimeSaving(true);
  //   setMessage(null);
  //   try {
  //     // Get current user
  //     const { data: { user }, error: userError } = await supabase.auth.getUser();
  //     if (userError || !user) return;
  //     // Upsert user_sms_settings
  //     const { error: upsertError } = await supabase
  //       .from('user_sms_settings')
  //       .upsert({ user_id: user.id, send_time: newTime }, { onConflict: 'user_id' });
  //     if (!upsertError) {
  //       setMessage({ type: 'success', text: 'Daily SMS send time updated!' });
  //     } else {
  //       setMessage({ type: 'error', text: 'Failed to update send time.' });
  //     }
  //   } catch {
  //     setMessage({ type: 'error', text: 'Failed to update send time.' });
  //   } finally {
  //     // setSendTimeSaving(false);
  //   }
  // };

  const handlePreferenceChange = (smsType: string, field: keyof SMSPreference, value: string | boolean) => {
    setPreferences(prev => 
      prev.map(pref => 
        pref.sms_type === smsType 
          ? { ...pref, [field]: value }
          : pref
      )
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/sms-preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          preferences
        })
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'SMS preferences updated successfully!' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to update preferences' });
      }

    } catch (error) {
      console.error('Error saving preferences:', error);
      setMessage({ type: 'error', text: 'Failed to save preferences' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-lg">Loading SMS preferences...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">SMS Preferences</h1>
        <p className="text-gray-600">
          All SMS will be sent daily at <span className="font-semibold">7:00 AM EST</span>.
        </p>
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
        <div className={`p-4 rounded-lg ${
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
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{info.icon}</span>
                    <div>
                      <h3 className="text-xl font-semibold">{info.title}</h3>
                      <p className="text-gray-600">{info.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Label htmlFor={`${pref.sms_type}-enabled`} className="text-sm font-medium">
                      Enable
                    </Label>
                    <input
                      id={`${pref.sms_type}-enabled`}
                      type="checkbox"
                      checked={pref.enabled}
                      onChange={(e) => handlePreferenceChange(pref.sms_type, 'enabled', e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </div>
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

      <div className="flex justify-center pt-6">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="px-8 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Preferences'}
        </Button>
      </div>

      <div className="mt-8 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">How it works:</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Each SMS type can be enabled/disabled independently</li>
          <li>• All SMS will be sent daily at 7:00 AM EST</li>
          <li>• Optionally override phone numbers for specific SMS types</li>
          <li>• SMS messages are only sent when there&apos;s meaningful data to report</li>
          <li>• All messages are labeled with their type (📅 BILLS SMS, 📅 SPENDING SMS, etc.)</li>
        </ul>
      </div>
    </div>
  );
} 