'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import AddRecipientButton from '@/components/add-recipient-button';

export default function RecipientsPanel() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<{ additional_phone: string | null; raw_present: boolean } | null>(null);

  const refresh = async () => {
    try {
      const res = await fetch('/api/sms-recipient');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch {
      // no-op
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Recipients</h2>
          <p className="text-sm text-muted-foreground">Add someone to receive all texts (daily, weekly, monthly).</p>
          <p className="text-sm mt-2">
            {loading ? 'Loading…' : status?.raw_present ? `Recipient: ${status.additional_phone}` : 'No recipient added yet.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {status?.raw_present && (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  const res = await fetch('/api/sms-recipient', { method: 'DELETE' });
                  if (res.ok) {
                    await refresh();
                  }
                } catch {
                  // no-op
                }
              }}
            >
              Remove recipient
            </Button>
          )}
          <AddRecipientButton onSuccess={refresh} />
        </div>
      </div>
    </Card>
  );
}


