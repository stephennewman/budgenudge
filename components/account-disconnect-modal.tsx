'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

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

interface BankItem {
  plaid_item_id: string;
  institution_name: string;
  accounts: Account[];
}

interface AccountDisconnectModalProps {
  item: BankItem | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (itemId: string) => Promise<void>;
}

export default function AccountDisconnectModal({ 
  item, 
  isOpen, 
  onClose, 
  onConfirm 
}: AccountDisconnectModalProps) {
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  if (!item) return null;

  const handleDisconnect = async () => {
    if (!item.plaid_item_id) {
      console.error('❌ Missing plaid_item_id in item:', item);
      alert('Error: Bank connection missing required plaid_item_id. Please refresh the page and try again.');
      return;
    }
    
    setIsDisconnecting(true);
    try {
      await onConfirm(item.plaid_item_id);
      onClose();
    } catch (error) {
      console.error('Disconnect failed:', error);
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            🔌 Disconnect Bank Connection
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Bank Info */}
          <div className="p-4 bg-gray-50 rounded-lg border">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-lg">{item.institution_name}</div>
                <div className="text-sm text-muted-foreground">
                  {item.accounts.length} account{item.accounts.length !== 1 ? 's' : ''} connected
                </div>
              </div>
            </div>
          </div>

          {/* Account List */}
          <div>
            <div className="font-medium mb-2">Accounts to be disconnected:</div>
            <div className="space-y-2">
              {item.accounts.map((account) => (
                <div key={account.plaid_account_id} className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{account.official_name || account.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {account.type} • {account.subtype}
                        {account.mask && ` ••••${account.mask}`}
                      </div>
                    </div>
                    {account.current_balance && (
                      <div className="text-right">
                        <div className="font-medium">${account.current_balance.toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">Current Balance</div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Warning/Confirmation */}
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-3">
              <div className="text-amber-600 text-lg">⚠️</div>
              <div>
                <div className="font-medium text-amber-800">Confirm Disconnection</div>
                <p className="text-sm text-amber-700">
                  Are you sure you want to disconnect <strong>{item.institution_name}</strong>? All {item.accounts.length} account{item.accounts.length !== 1 ? 's' : ''} and their transactions will no longer be visible.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end">
            <Button 
              variant="outline" 
              onClick={onClose}
              disabled={isDisconnecting}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleDisconnect}
              disabled={isDisconnecting}
            >
              {isDisconnecting ? '🔄 Disconnecting...' : `🔌 Disconnect ${item.institution_name}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}