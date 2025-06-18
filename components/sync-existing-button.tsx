'use client';

import { useState } from 'react';
import { Button } from './ui/button';

export default function SyncExistingButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string>('');

  const handleSync = async () => {
    setIsLoading(true);
    setResult('');
    
    try {
      const response = await fetch('/api/plaid/sync-existing', {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (data.success) {
        const results = data.results.map((r: { item_id: string; status: string; accounts?: number; transactions?: number }) => 
          `${r.item_id}: ${r.status} - ${r.accounts || 0} accounts, ${r.transactions || 0} transactions`
        ).join('\n');
        setResult(`✅ Sync completed!\n${results}`);
      } else {
        setResult(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      setResult(`❌ Failed to sync: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Button 
        onClick={handleSync} 
        disabled={isLoading}
        className="bg-blue-600 hover:bg-blue-700"
      >
        {isLoading ? 'Syncing...' : '🔄 Fix Missing Data'}
      </Button>
      
      {result && (
        <div className="p-4 bg-gray-100 rounded-lg">
          <pre className="text-sm whitespace-pre-wrap">{result}</pre>
        </div>
      )}
    </div>
  );
} 