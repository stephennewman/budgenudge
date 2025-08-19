'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ContentAreaLoader } from '@/components/ui/content-area-loader';
import { createSupabaseClient } from '@/utils/supabase/client';
import { isSuperAdmin } from '@/utils/auth/superadmin';

interface SMSFeedEntry {
  id: number;
  timestamp: string;
  template_type: string;
  user_id_short: string;
  phone_short: string;
  success: boolean;
  message_id: string | null;
  source_endpoint: string;
}

interface SMSFeedStats {
  total: number;
  successful: number;
  failed: number;
  successRate: number;
  todayCount: number;
  lastUpdate: string;
}

interface SMSFeedData {
  entries: SMSFeedEntry[];
  stats: SMSFeedStats;
}

export default function AdminFeedPage() {
  const [data, setData] = useState<SMSFeedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  // Check superadmin access on mount
  useEffect(() => {
    checkSuperAdminAccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkSuperAdminAccess = async () => {
    try {
      const supabase = createSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user || !isSuperAdmin(user.id)) {
        console.log('❌ Not superadmin, redirecting...');
        router.push('/protected');
        return;
      }
      
      // If superadmin, load feed data
      fetchFeedData();
    } catch (err) {
      console.error('❌ Auth check error:', err);
      router.push('/protected');
    }
  };

  const fetchFeedData = async () => {
    try {
      setError(null);
      
      const response = await fetch('/api/admin/sms-feed');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch feed: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Unknown error');
      }
      
      setData(result.data);
    } catch (err) {
      console.error('❌ Error fetching SMS feed:', err);
      setError(err instanceof Error ? err.message : 'Failed to load SMS feed');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchFeedData();
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  const getStatusIcon = (success: boolean) => {
    return success ? '✅' : '❌';
  };

  const getTemplateIcon = (templateType: string) => {
    const icons: Record<string, string> = {
      'recurring': '🔄',
      'recent': '📱',
      'activity': '📊',
      'merchant-pacing': '🏪',
      'category-pacing': '🗂️',
      'weekly-summary': '📅',
      'monthly-summary': '📆',
      'cash-flow-runway': '💰',
      'onboarding-immediate': '👋',
      'onboarding-analysis-complete': '🎉',
      'onboarding-day-before': '⏰',
      '415pm-special': '🌅',
      'bogo-dinner-plan': '🍽️'
    };
    return icons[templateType] || '📨';
  };

  if (loading) {
    return (
      <div className="relative min-h-[600px]">
        <ContentAreaLoader />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-w-md mx-auto">
            <p className="text-red-700">Error: {error}</p>
            <Button onClick={handleRefresh} className="mt-2">
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return <div>No data available</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="text-2xl font-medium">📡 SMS Feed</h1>
          <p className="text-muted-foreground mt-1">
            Real-time SMS monitoring for platform activity
          </p>
        </div>
        <Button 
          onClick={handleRefresh} 
          disabled={refreshing}
          variant="outline"
        >
          {refreshing ? '🔄 Refreshing...' : '🔄 Refresh'}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-center">
              {data.stats.todayCount}
            </div>
            <div className="text-sm text-gray-600 text-center">
              SMS Today
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-center text-green-600">
              {data.stats.successful}
            </div>
            <div className="text-sm text-gray-600 text-center">
              Successful
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-center text-red-600">
              {data.stats.failed}
            </div>
            <div className="text-sm text-gray-600 text-center">
              Failed
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-center text-blue-600">
              {data.stats.successRate}%
            </div>
            <div className="text-sm text-gray-600 text-center">
              Success Rate
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SMS Feed Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent SMS Activity</CardTitle>
          <p className="text-sm text-gray-600">
            Last updated: {new Date(data.stats.lastUpdate).toLocaleString()}
          </p>
        </CardHeader>
        <CardContent>
          {data.entries.length === 0 ? (
            <div className="text-center py-8 text-gray-600">
              No recent SMS activity found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-2 font-medium text-gray-900">Time</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-900">Template</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-900">User</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-900">Phone</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-900">Status</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-900">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {data.entries.map((entry) => (
                    <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-2 text-sm">
                        {formatTimestamp(entry.timestamp)}
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-lg">{getTemplateIcon(entry.template_type)}</span>
                          <span className="text-sm font-medium">{entry.template_type}</span>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-sm font-mono">
                        {entry.user_id_short}
                      </td>
                      <td className="py-3 px-2 text-sm font-mono">
                        {entry.phone_short}
                      </td>
                      <td className="py-3 px-2">
                        <span className="text-lg">
                          {getStatusIcon(entry.success)}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-sm text-gray-600">
                        {entry.source_endpoint}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
