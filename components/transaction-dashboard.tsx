'use client';

import { createSupabaseClient } from '@/utils/supabase/client';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PlaidLinkButton from './plaid-link-button';

interface Account {
  account_id: string;
  name: string;
  type: string;
  subtype: string;
}

export default function TransactionDashboard() {
  const [isConnected, setIsConnected] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
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

      console.log('🏦 TransactionDashboard Debug:');
      console.log('Items found:', items?.length || 0);
      console.log('Items data:', items);

      setIsConnected(!!(items && items.length > 0));
      
      if (items && items.length > 0) {
        await fetchAccounts();
      }
    } catch (error) {
      console.error('Error checking connection:', error);
    }
  }

  async function fetchAccounts() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      console.log('🔍 Fetching accounts from API...');

      const response = await fetch('/api/plaid/transactions', {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('📊 API Response:', data);
        console.log('🏦 Accounts returned:', data.accounts?.length || 0);
        console.log('💳 Accounts data:', data.accounts);
        setAccounts(data.accounts || []);
      } else {
        console.error('Failed to fetch accounts:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('Error response:', errorText);
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

  if (!isConnected) {
    return (
      <div className="flex justify-center">
        <PlaidLinkButton onSuccess={handleConnectionSuccess} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>🏦 Connected Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          {accounts.length > 0 ? (
            <div className="space-y-3">
              {accounts.map((account) => (
                <div 
                  key={account.account_id} 
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <div className="font-medium">{account.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {account.type} • {account.subtype}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-sm text-green-700">Connected</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                No accounts found. Try reconnecting your bank.
              </p>
              <PlaidLinkButton onSuccess={handleConnectionSuccess} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 