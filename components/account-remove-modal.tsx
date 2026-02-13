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

interface AccountRemoveModalProps {
  account: Account | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (accountId: number) => Promise<void>;
}

export default function AccountRemoveModal({ 
  account, 
  isOpen, 
  onClose, 
  onConfirm 
}: AccountRemoveModalProps) {
  const [isRemoving, setIsRemoving] = useState(false);

  if (!account) return null;

  const handleRemove = async () => {
    if (!account.id) {
      console.error('❌ Missing account.id in account:', account);
      alert('Error: Account missing required ID. Please refresh the page and try again.');
      return;
    }
    
    setIsRemoving(true);
    try {
      await onConfirm(account.id);
      onClose();
    } catch (error) {
      console.error('Remove failed:', error);
    } finally {
      setIsRemoving(false);
    }
  };

  const accountDisplayName = account.official_name || account.name;
  const accountDetails = `${account.type} • ${account.subtype || ''}`.trim();
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            🗑️ Remove Account
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Account Info */}
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{accountDisplayName}</div>
                <div className="text-sm text-muted-foreground">
                  {accountDetails}
                  {account.mask && ` ••••${account.mask}`}
                </div>
                {account.institution_name && (
                  <div className="text-sm text-muted-foreground mt-1">
                    {account.institution_name}
                  </div>
                )}
              </div>
              {account.current_balance && (
                <div className="text-right">
                  <div className="font-medium">${account.current_balance.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">Current Balance</div>
                </div>
              )}
            </div>
          </div>

          {/* Warning/Confirmation */}
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-3">
              <div className="text-amber-600 text-lg">⚠️</div>
              <div>
                <div className="font-medium text-amber-800">Remove Account</div>
                <p className="text-sm text-amber-700">
                  Are you sure you want to remove <strong>{accountDisplayName}</strong>? This account and its transactions will no longer be visible. Your other accounts from {account.institution_name || 'this bank'} will remain connected.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end">
            <Button 
              variant="outline" 
              onClick={onClose}
              disabled={isRemoving}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleRemove}
              disabled={isRemoving}
            >
              {isRemoving ? '🔄 Removing...' : '🗑️ Remove Account'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}