'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface SMSPreference {
  id?: number;
  user_id: string;
  sms_type: 'bills' | 'spending' | 'activity';
  enabled: boolean;
  frequency: '30min' | 'hourly' | 'daily' | 'weekly';
  phone_number?: string;
}

const frequencyOptions = [
  { value: '30min', label: 'Every 30 minutes' },
  { value: 'hourly', label: 'Every hour' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' }
];

const smsTypeInfo = {
  bills: {
    title: 'Bills & Payments',
    description: 'Upcoming bills and payment reminders from tagged merchants',
    icon: '💳',
    example: 'Disney+ $3.41, Netflix $28.30, Duke Energy $308.00'
  },
  spending: {
    title: 'Spending Analysis',
    description: 'Budget analysis, account balance, and AI-powered recommendations',
    icon: '💰',
    example: 'Balance: $361, Publix vs expected pace, Amazon spending analysis'
  },
  activity: {
    title: 'Recent Activity',
    description: 'Recent transactions from the last 3 days',
    icon: '📋',
    example: 'Publix $56.12, Walmart $30.87, Local Brewing $70.00'
  }
};

export default function SMSPreferencesPage() {
  const [preferences, setPreferences] = useState<SMSPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [userId, setUserId] = useState<string>('');

  const supabase = createClient();

  useEffect(() => {
    loadUserAndPreferences();
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

  const handlePreferenceChange = (smsType: string, field: keyof SMSPreference, value: any) => {
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
          Customize your BudgeNudge SMS notifications. Choose which types of messages you want to receive and how often.
        </p>
      </div>

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
                  <p className="text-sm text-gray-700">
                    <strong>Example:</strong> {info.example}
                  </p>
                </div>

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

                    <div>
                      <Label htmlFor={`${pref.sms_type}-phone`} className="text-sm font-medium">
                        Phone Number Override (optional)
                      </Label>
                      <Input
                        id={`${pref.sms_type}-phone`}
                        type="tel"
                        placeholder="+1234567890"
                        value={pref.phone_number || ''}
                        onChange={(e) => handlePreferenceChange(pref.sms_type, 'phone_number', e.target.value)}
                        className="mt-1"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Leave empty to use default phone number
                      </p>
                    </div>
                  </div>
                )}
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
          <li>• Set different frequencies for each SMS type (30min, hourly, daily, weekly)</li>
          <li>• Optionally override phone numbers for specific SMS types</li>
          <li>• SMS messages are only sent when there's meaningful data to report</li>
          <li>• All messages are labeled with their type (📅 BILLS SMS, 📅 SPENDING SMS, etc.)</li>
        </ul>
      </div>
    </div>
  );
} 