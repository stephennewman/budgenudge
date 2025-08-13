"use client";
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export default function SendTestSMSButton({ userId, templateType, label = 'Send SMS' }: { userId: string; templateType: string; label?: string }) {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleSend = async () => {
    setSending(true);
    setResult(null);
    try {
      const res = await fetch('/api/manual-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, templateType })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setResult('✅ Sent');
      } else {
        setResult('❌ Failed');
      }
    } catch {
      setResult('❌ Error');
    } finally {
      setSending(false);
      setTimeout(() => setResult(null), 3000);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <Button onClick={handleSend} disabled={sending} variant="outline">
        {sending ? 'Sending...' : label}
      </Button>
      {result && <span className="text-sm text-muted-foreground">{result}</span>}
    </div>
  );
}


