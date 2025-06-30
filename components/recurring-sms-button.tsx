'use client';

import { useState } from 'react';
import { Button } from './ui/button';

interface RecurringSmsButtonProps {
  phoneNumber?: string;
  userId?: string;
  buttonText?: string;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  disabled?: boolean;
}

export default function RecurringSmsButton({ 
  phoneNumber, 
  userId,
  buttonText = "📊 Text My Recurring Bills", 
  variant = "outline",
  disabled = false
}: RecurringSmsButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<string>('');

  const handleSendRecurringSms = async () => {
    if (!userId) {
      setStatus('❌ User ID required for recurring transactions');
      return;
    }

    setIsLoading(true);
    setStatus('');

    try {
      const response = await fetch('/api/recurring-sms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber: phoneNumber,
          userId: userId
        }),
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        if (result.recurringCount === 0) {
          setStatus('📱 SMS sent - No recurring bills detected yet');
        } else {
          setStatus(`📱 SMS sent - ${result.recurringCount} recurring bills ($${result.totalMonthly}/month)`);
        }
      } else {
        setStatus(`❌ Error: ${result.error || 'Failed to send SMS'}`);
      }
    } catch (error) {
      console.error('Error with recurring SMS:', error);
      setStatus('❌ Network error - please try again');
    } finally {
      setIsLoading(false);
      
      // Clear status after 5 seconds
      setTimeout(() => {
        setStatus('');
      }, 5000);
    }
  };

  return (
    <div className="space-y-2">
      <Button 
        onClick={handleSendRecurringSms}
        disabled={disabled || isLoading || !userId}
        variant={variant}
        className="w-full"
      >
        {isLoading ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
            Sending...
          </>
        ) : (
          buttonText
        )}
      </Button>
      
      {status && (
        <div className="text-sm p-2 rounded bg-gray-100 dark:bg-gray-800">
          {status}
        </div>
      )}
      
      <div className="text-xs text-muted-foreground">
        💡 Sends a summary of your recurring bills/subscriptions detected from transaction patterns
      </div>
    </div>
  );
} 