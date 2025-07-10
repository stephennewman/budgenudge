'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { createSupabaseClient } from '@/utils/supabase/client';

interface RefreshResult {
  newTransactions: number;
  updatedTransactions: number;
  [key: string]: unknown;
}

export default function ManualRefreshButton({ 
  onRefresh 
}: { 
  onRefresh?: () => void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const supabase = createSupabaseClient();

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      // Get session for authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/plaid/manual-refresh', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to refresh transactions');
      }

      const result: RefreshResult = await response.json();
      setLastRefresh(new Date().toLocaleTimeString());
      
      // Call parent refresh callback
      if (onRefresh) {
        onRefresh();
      }

      alert(`✅ Refresh complete!\nNew: ${result.newTransactions}\nUpdated: ${result.updatedTransactions}`);
    } catch (error) {
      console.error('Refresh failed:', error);
      if (error instanceof Error && error.message === 'Not authenticated') {
        alert('❌ Authentication required. Please refresh the page and try again.');
      } else {
        alert('❌ Failed to refresh transactions. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <Button
        onClick={handleRefresh}
        disabled={isLoading}
        variant="outline"
        size="default"
        className="w-full"
      >
        {isLoading ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
            Refreshing...
          </>
        ) : (
          <>
            🔄 Refresh Transactions
          </>
        )}
      </Button>

      {/* Show result feedback */}
      {lastRefresh && (
        <div className="text-sm p-3 rounded-lg border bg-green-50 border-green-200 text-green-800">
          <div className="font-medium flex items-center">
            ✅ Refresh Complete
            {lastRefresh && (
              <span className="ml-2 text-xs opacity-75">
                at {lastRefresh}
              </span>
            )}
          </div>
          <div className="mt-1">Your data has been refreshed.</div>
        </div>
      )}
    </div>
  );
} 