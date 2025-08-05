'use client';

import { createSupabaseClient } from '@/utils/supabase/client';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import PlaidLinkButton from './plaid-link-button';
import { AccountSkeletonLoader } from '@/components/ui/account-skeleton-loader';

import AccountRemoveModal from './account-remove-modal';

interface Account {
  id: number;
  item_id: string;
  plaid_account_id: string;
  plaid_item_id: string;
  name: string;
  official_name?: string;
  type: string;
  subtype: string;
  mask?: string;
  current_balance?: number;
  available_balance?: number;
  verification_status?: string;
  balance_last_updated?: string;
  institution_name?: string;
}

export default function TransactionDashboard() {
  const [isConnected, setIsConnected] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [disconnectAccountModal, setDisconnectAccountModal] = useState<{
    isOpen: boolean;
    account: Account | null;
  }>({ isOpen: false, account: null });
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
        setIsLoadingAccounts(true);
        await fetchAccounts();
      } else {
        setIsLoadingAccounts(false);
      }
    } catch (error) {
      console.error('Error checking connection:', error);
      setIsLoadingAccounts(false);
    }
  }

  async function fetchAccounts() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsLoadingAccounts(false);
        return;
      }

      const response = await fetch('/api/plaid/transactions', {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const accounts = data.accounts || [];
        
        // Validate account data and add debug logging
        const validAccounts = accounts.filter((account: Account) => {
          if (!account.plaid_account_id) {
            console.warn('Account missing plaid_account_id:', account);
            return false;
          }
          return true;
        });
        
        console.log('🏦 Fetched accounts:', validAccounts.length);
        console.log('🔍 First account sample:', validAccounts[0]);
        console.log('🔍 Account keys:', validAccounts[0] ? Object.keys(validAccounts[0]) : 'No accounts');
        setAccounts(validAccounts);
      } else {
        console.error('Failed to fetch accounts:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
    } finally {
      setIsLoadingAccounts(false);
    }
  }

  useEffect(() => {
    checkConnection();
  }, []);

  const handleConnectionSuccess = () => {
    setIsConnected(true);
    setIsLoadingAccounts(true);
    fetchAccounts();
  };



  const handleAccountDisconnect = async (accountId: number) => {
    try {
      console.log('🗑️ handleAccountDisconnect called with:', { accountId });
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('No session found');
        return;
      }

      const requestBody = {
        account_id: accountId
      };
      
      console.log('📤 Sending account disconnect request:', requestBody);

      const response = await fetch('/api/plaid/disconnect-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(requestBody),
      });

      console.log('📡 Account disconnect response status:', response.status);

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Account disconnected successfully:', result);
        
        // Refresh accounts list
        await fetchAccounts();
        
        // Check if any accounts are still connected
        await checkConnection();
      } else {
        console.error('❌ Account disconnect failed. Status:', response.status);
        
        let errorData;
        const responseText = await response.text();
        console.error('❌ Raw response text:', responseText);
        
        try {
          errorData = JSON.parse(responseText);
          console.error('❌ Parsed error data:', errorData);
        } catch (parseError) {
          console.error('❌ Failed to parse response as JSON:', parseError);
          errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
        }
        
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('💥 Error disconnecting account:', error);
      throw error;
    }
  };



  const openDisconnectAccountModal = (account: Account) => {
    setDisconnectAccountModal({ isOpen: true, account });
  };

  const closeDisconnectAccountModal = () => {
    setDisconnectAccountModal({ isOpen: false, account: null });
  };



  // Show skeleton while loading accounts, regardless of connection state
  if (isLoadingAccounts) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>🏦 Connected Accounts</CardTitle>
            <PlaidLinkButton 
              onSuccess={handleConnectionSuccess}
              buttonText="+ Account"
              buttonVariant="default"
              showSkeleton={true}
            />
          </CardHeader>
          <CardContent>
            <AccountSkeletonLoader 
              accountGroups={2} 
              accountsPerGroup={2} 
            />
          </CardContent>
        </Card>
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
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle>🏦 Connected Accounts</CardTitle>
          <PlaidLinkButton 
            onSuccess={handleConnectionSuccess}
            buttonText="+ Account"
            buttonVariant="default"
          />
        </CardHeader>
        <CardContent>
          {accounts.length > 0 ? (
            <div className="space-y-4">
              {(() => {
                // Group accounts by plaid_item_id (same bank connection)
                const accountsByItem = accounts.reduce((acc, account) => {
                  if (!account || !account.plaid_account_id || !account.plaid_item_id) {
                    console.warn('Invalid account data:', account);
                    return acc;
                  }
                  
                  const itemId = account.plaid_item_id;
                  if (!acc[itemId]) {
                    acc[itemId] = {
                      plaid_item_id: itemId,
                      institution_name: account.institution_name || '',
                      accounts: []
                    };
                  }
                  acc[itemId].accounts.push(account);
                  return acc;
                }, {} as Record<string, { plaid_item_id: string; institution_name: string; accounts: Account[] }>);

                return Object.values(accountsByItem).map((item) => (
                  <div key={item.plaid_item_id} className="border rounded-lg p-4">
                    {/* Bank Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <div>
                          <div className="text-sm text-muted-foreground">
                            {item.accounts.length} account{item.accounts.length !== 1 ? 's' : ''} connected
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Account List */}
                    <div className="space-y-2">
                      {item.accounts.map((account) => (
                        <div 
                          key={`account-${account.plaid_account_id}`}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
                        >
                          <div className="flex-1">
                            <div className="font-medium">{account.name || 'Unknown Account'}</div>
                            <div className="text-sm text-muted-foreground">
                              {account.type || 'Unknown'} • {account.subtype || 'Unknown'}
                              {account.mask && ` ••••${account.mask}`}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {(account.available_balance !== null && account.available_balance !== undefined) ? (
                              <div className="text-right">
                                <div className="font-medium text-green-600">
                                  ${account.available_balance.toLocaleString()} 
                                  {account.type === 'credit' ? ' available credit' : ' available'}
                                </div>
                                {account.current_balance !== null && account.current_balance !== undefined && (
                                  <div className="text-xs text-muted-foreground">
                                    ${account.current_balance.toLocaleString()} current
                                  </div>
                                )}
                              </div>
                            ) : account.current_balance !== null && account.current_balance !== undefined ? (
                              <div className="text-right">
                                <div className="font-medium">${account.current_balance.toLocaleString()}</div>
                                <div className="text-xs text-muted-foreground">Current Balance</div>
                              </div>
                            ) : (
                              <div className="text-right">
                                <div className="text-xs text-muted-foreground">Balance unavailable</div>
                              </div>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openDisconnectAccountModal(account)}
                              className="h-8 w-8 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
                              title="Remove this account"
                            >
                              ×
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ));
              })()}
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


      
      {/* Account Disconnect Modal */}
      <AccountRemoveModal
        account={disconnectAccountModal.account}
        isOpen={disconnectAccountModal.isOpen}
        onClose={closeDisconnectAccountModal}
        onConfirm={handleAccountDisconnect}
      />
    </div>
  );
} 