'use client';

import { useState, useEffect } from 'react';
import { createSupabaseClient } from '@/utils/supabase/client';

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
        await fetchTransactions();
      }
    } catch (error) {
      console.error('Error checking connection:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchTransactions() {
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
      console.error('Error fetching transactions:', error);
    }
  }

  useEffect(() => {
    checkConnection();
  }, []);

  const handleConnectionSuccess = () => {
    setIsConnected(true);
    fetchTransactions();
  };



  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>🏦 Connect Your Bank Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Connect your Schwab account to start tracking transactions automatically.
              Once connected, new transactions will sync via webhooks instantly!
            </p>
            <PlaidLinkButton onSuccess={handleConnectionSuccess} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Connected Accounts - FULL WIDTH */}
      {accounts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Connected Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {accounts.map((account) => (
                <div key={account.account_id} className="flex justify-between items-center p-2 border rounded">
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

      {/* REMOVED: All Transactions card
      <Card>
        <CardHeader>
          <CardTitle>All Transactions ({transactions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No transactions found. Make a purchase and it will appear here automatically!
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {transactions.map((transaction) => {
                const merchantName = transaction.merchant_name || transaction.name;
                const isTagged = taggedMerchants.has(merchantName.toLowerCase());
                const isStarring = starringMerchant === merchantName;
                
                return (
                  <div key={transaction.id} className="flex justify-between items-center p-3 border rounded hover:bg-gray-50">
                    <div className="flex items-center gap-3 flex-1">
                      <button
                        onClick={() => isTagged ? handleUnstarMerchant(merchantName) : handleStarMerchant(merchantName)}
                        disabled={isStarring}
                        className={`text-lg transition-all duration-200 ${
                          isTagged 
                            ? 'text-yellow-500 hover:text-yellow-600' 
                            : 'text-gray-300 hover:text-yellow-400'
                        } ${isStarring ? 'opacity-50' : ''}`}
                        title={isTagged ? 'Remove from recurring bills' : 'Add to recurring bills'}
                      >
                        {isStarring ? '⏳' : isTagged ? '⭐' : '☆'}
                      </button>
                      
                      <div className="flex-1">
                        <div className="font-medium">{transaction.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {transaction.date} • {transaction.category?.[0]}
                          {transaction.pending && <span className="ml-2 text-yellow-600">Pending</span>}
                          {isTagged && <span className="ml-2 text-blue-600">🏷️ Tracked</span>}
                        </div>
                      </div>
                    </div>
                    
                    <div className={`font-medium ${transaction.amount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      ${Math.abs(transaction.amount).toFixed(2)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      */}

    </div>
  );
} 