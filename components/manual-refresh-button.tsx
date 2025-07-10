'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface ManualRefreshButtonProps {
  onRefreshComplete?: (data: any) => void;
  variant?: 'default' | 'outline' | 'secondary';
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}

export default function ManualRefreshButton({ 
  onRefreshComplete, 
  variant = 'outline',
  size = 'default',
  className 
}: ManualRefreshButtonProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastResult, setLastResult] = useState<{
    success: boolean;
    message: string;
    newTransactions?: number;
    timestamp?: string;
  } | null>(null);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setLastResult(null);

    try {
      const response = await fetch('/api/plaid/manual-refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok) {
        setLastResult({
          success: true,
          message: data.message,
          newTransactions: data.newTransactions,
          timestamp: new Date().toLocaleTimeString()
        });
        
        // Call the callback if provided (for parent components to refresh their data)
        if (onRefreshComplete) {
          onRefreshComplete(data);
        }
      } else {
        setLastResult({
          success: false,
          message: data.error || 'Refresh failed',
          timestamp: new Date().toLocaleTimeString()
        });
      }
    } catch (error) {
      console.error('Manual refresh error:', error);
      setLastResult({
        success: false,
        message: 'Network error. Please try again.',
        timestamp: new Date().toLocaleTimeString()
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="space-y-3">
      <Button
        onClick={handleRefresh}
        disabled={isRefreshing}
        variant={variant}
        size={size}
        className={className}
      >
        {isRefreshing ? (
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
      {lastResult && (
        <div className={`text-sm p-3 rounded-lg border ${
          lastResult.success 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="font-medium flex items-center">
            {lastResult.success ? '✅' : '❌'} {lastResult.success ? 'Success!' : 'Error'}
            {lastResult.timestamp && (
              <span className="ml-2 text-xs opacity-75">
                at {lastResult.timestamp}
              </span>
            )}
          </div>
          <div className="mt-1">{lastResult.message}</div>
          {lastResult.success && lastResult.newTransactions !== undefined && (
            <div className="mt-2 text-xs">
              {lastResult.newTransactions > 0 ? (
                <span className="font-medium">
                  {lastResult.newTransactions} new/updated transaction{lastResult.newTransactions !== 1 ? 's' : ''}
                </span>
              ) : (
                <span>Your data is already up to date</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
} 