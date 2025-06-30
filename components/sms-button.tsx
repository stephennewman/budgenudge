'use client';

import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

interface SmsButtonProps {
  message?: string;
  phoneNumber?: string;
  buttonText?: string;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  disabled?: boolean;
  userId?: string; // Required for scheduling
  allowScheduling?: boolean; // Enable/disable scheduling feature
}

export default function SmsButton({ 
  message, 
  phoneNumber, 
  buttonText = "Send SMS", 
  variant = "default",
  disabled = false,
  userId,
  allowScheduling = true
}: SmsButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledTime, setScheduledTime] = useState('');
  const [showScheduleOptions, setShowScheduleOptions] = useState(false);

  // Generate minimum datetime (current time + 1 minute) in user's local timezone
  const getMinDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 1);
    // Return in local timezone format for datetime-local input
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Get user's current timezone
  const getUserTimezone = () => {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  };

  // Convert local datetime-local string to ISO string with timezone
  const convertToScheduledISO = (localDateTimeString: string) => {
    // Create a date object from the local datetime string
    // datetime-local gives us "2025-01-02T14:30"
    const localDate = new Date(localDateTimeString);
    
    // This correctly preserves the user's intended time in their timezone
    return localDate.toISOString();
  };

  const handleSendSms = async () => {
    setIsLoading(true);
    setStatus('');

    try {
      const payload: any = {
        message: message,
        phoneNumber: phoneNumber,
      };

      // If scheduling is enabled and time is set
      if (isScheduled && scheduledTime) {
        if (!userId) {
          setStatus('❌ User ID required for scheduling');
          setIsLoading(false);
          return;
        }
        
        // Convert the local time to ISO format with proper timezone handling
        payload.scheduledTime = convertToScheduledISO(scheduledTime);
        payload.userId = userId;
        payload.userTimezone = getUserTimezone(); // Send user's timezone for reference
      }

      const response = await fetch('/api/manual-sms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (result.success) {
        if (isScheduled && scheduledTime) {
          const scheduledDate = new Date(scheduledTime);
          const timezoneName = getUserTimezone();
          const tzAbbr = scheduledDate.toLocaleString('en-US', { timeZoneName: 'short' }).split(' ').pop();
          setStatus(`📅 SMS scheduled for ${scheduledDate.toLocaleString()} ${tzAbbr}`);
          setScheduledTime(''); // Reset the time picker
          setIsScheduled(false); // Reset to immediate mode
          setShowScheduleOptions(false); // Hide schedule options
        } else {
          setStatus('✅ SMS sent successfully!');
        }
        setTimeout(() => setStatus(''), 5000); // Clear after 5 seconds
      } else {
        setStatus(`❌ ${result.error}`);
        setTimeout(() => setStatus(''), 5000);
      }
    } catch (error) {
      console.error('Error with SMS:', error);
      setStatus('❌ Error with SMS request');
      setTimeout(() => setStatus(''), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleScheduleOptions = () => {
    setShowScheduleOptions(!showScheduleOptions);
    if (!showScheduleOptions) {
      setIsScheduled(false);
      setScheduledTime('');
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 max-w-md mx-auto">
      {/* Schedule Options Toggle */}
      {allowScheduling && (
        <div className="flex items-center gap-2">
          <Label htmlFor="schedule-toggle" className="text-sm text-muted-foreground">
            Schedule for later?
          </Label>
          <Button
            id="schedule-toggle"
            type="button"
            variant="ghost"
            size="sm"
            onClick={toggleScheduleOptions}
            className="h-6 px-2"
          >
            {showScheduleOptions ? '🕐 Hide' : '⏰ Schedule'}
          </Button>
        </div>
      )}

      {/* Scheduling Options */}
      {showScheduleOptions && allowScheduling && (
        <div className="w-full space-y-3 p-4 border rounded-lg bg-muted/50">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="schedule-checkbox"
              checked={isScheduled}
              onChange={(e) => setIsScheduled(e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="schedule-checkbox" className="text-sm">
              Schedule this message
            </Label>
          </div>
          
          {isScheduled && (
            <div className="space-y-2">
              <Label htmlFor="scheduled-time" className="text-sm">
                Select date and time (your local time):
              </Label>
              <Input
                id="scheduled-time"
                type="datetime-local"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                min={getMinDateTime()}
                className="w-full"
              />
              {scheduledTime && (
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Will send: {new Date(scheduledTime).toLocaleString()}</p>
                  <p>Your timezone: {getUserTimezone()}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Send Button */}
      <Button
        onClick={handleSendSms}
        disabled={isLoading || disabled || (isScheduled && !scheduledTime)}
        variant={variant}
        className="min-w-[140px]"
      >
        {isLoading ? (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            {isScheduled && scheduledTime ? 'Scheduling...' : 'Sending...'}
          </div>
        ) : (
          <>
            {isScheduled && scheduledTime ? '📅 Schedule SMS' : buttonText}
          </>
        )}
      </Button>
      
      {/* Status Message */}
      {status && (
        <p className={`text-sm text-center max-w-full break-words ${
          status.includes('✅') || status.includes('📅') ? 'text-green-600' : 'text-red-600'
        }`}>
          {status}
        </p>
      )}
    </div>
  );
} 