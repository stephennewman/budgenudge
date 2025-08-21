'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function MorningExpensesTestPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{success: boolean; error?: string; message?: string; result?: unknown} | null>(null);
  const [previewMessage, setPreviewMessage] = useState<string>('');

  const testMorningSMS = async () => {
    setIsLoading(true);
    setResult(null);
    
    try {
      const response = await fetch('/api/test-morning-expenses', {
        method: 'GET',
      });
      
      const data = await response.json();
      setResult(data);
      
      if (data.success) {
        console.log('✅ Morning SMS test successful:', data);
      } else {
        console.error('❌ Morning SMS test failed:', data.error);
      }
    } catch (error) {
      console.error('❌ Error testing morning SMS:', error);
      setResult({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setIsLoading(false);
    }
  };

  const previewMorningMessage = async () => {
    setIsLoading(true);
    setPreviewMessage('');
    
    try {
      // Call a preview version that doesn't send but returns the message
      const response = await fetch('/api/morning-expenses-preview', {
        method: 'GET',
      });
      
      const data = await response.json();
      if (data.success) {
        setPreviewMessage(data.message);
      } else {
        setPreviewMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('❌ Error previewing message:', error);
      setPreviewMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="max-w-4xl">
        <h1 className="text-3xl font-bold mb-2">Morning Expenses SMS Test</h1>
        <p className="text-muted-foreground mb-6">
          Test the morning expenses SMS functionality for user: bc474c8b-4b47-4c7d-b202-f469330af2a2
        </p>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Preview Message</CardTitle>
              <CardDescription>
                See what the morning expenses message looks like without sending
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={previewMorningMessage}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? 'Loading...' : 'Preview Message'}
              </Button>
              
              {previewMessage && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold mb-2">Message Preview:</h4>
                  <pre className="whitespace-pre-wrap text-sm text-gray-700">
                    {previewMessage}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Send Test SMS</CardTitle>
              <CardDescription>
                Actually send the morning expenses SMS to the target user
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={testMorningSMS}
                disabled={isLoading}
                variant="destructive"
                className="w-full"
              >
                {isLoading ? 'Sending...' : 'Send Morning SMS'}
              </Button>
              
              {result && (
                <div className={`p-4 rounded-lg ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  <h4 className={`font-semibold mb-2 ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                    {result.success ? 'Success!' : 'Error'}
                  </h4>
                  <pre className={`text-sm ${result.success ? 'text-green-700' : 'text-red-700'}`}>
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Message Format</CardTitle>
            <CardDescription>Expected format for the morning expenses SMS</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-gray-50 p-4 rounded-lg text-sm">
{`🌅 MORNING SNAPSHOT

💸 UPCOMING EXPENSES (rest of the month only)
{date}: {merchant} {amount}

Unpaid: Add all these up

✅ RECENTLY PAID (show historical expenses that are now paid)
{date}: {merchant} {amount}

Paid: Add all up`}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
