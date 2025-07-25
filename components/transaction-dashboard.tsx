'use client';

import { createSupabaseClient } from '@/utils/supabase/client';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PlaidLinkButton from './plaid-link-button';
import { ContentAreaLoader } from '@/components/ui/content-area-loader';

interface Account {
  account_id: string;
  name: string;
  type: string;
  subtype: string;
}

export default function TransactionDashboard() {
  const [isConnected, setIsConnected] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createSupabaseClient();

  async function checkConnection() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if user has any connected items
      const { data: items } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', user.id);

      setIsConnected(!!(items && items.length > 0));
      
      if (items && items.length > 0) {
        await fetchAccounts();
      }
    } catch (error) {
      console.error('Error checking connection:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchAccounts() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/plaid/transactions', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setAccounts(data.accounts || []);
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
    }
  }

  useEffect(() => {
    checkConnection();
  }, []);

  const handleConnectionSuccess = () => {
    setIsConnected(true);
    fetchAccounts();
  };



  if (isLoading) {
    return (
      <div className="relative min-h-[400px]">
        <ContentAreaLoader />
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="flex justify-center">
        <PlaidLinkButton onSuccess={handleConnectionSuccess} />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Connected Bank Accounts */}
      {accounts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Your Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {accounts.map((account, index) => (
                <div key={`account-${account.account_id}-${index}`} className="flex justify-between items-center p-2 border rounded">
                  <div>
                    <div className="font-medium">{account.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {account.type} - {account.subtype}
                    </div>
                  </div>
                  <div className="text-green-600">✅ Connected</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}



    </div>
  );
} 