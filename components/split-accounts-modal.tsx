'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface Transaction {
  id: string;
  date: string;
  amount: number;
  name: string;
  merchant_name?: string;
  ai_merchant_name?: string;
  ai_category_tag?: string;
  plaid_transaction_id?: string;
  is_tracked_for_this_split?: boolean;
}

interface TransactionGroup {
  id: string;
  name: string;
  transactions: Transaction[];
  averageAmount: number;
  frequency: string;
  confidence: number;
  nextPredictedDate: string;
}

interface TaggedMerchant {
  id: number;
  merchant_name: string;
  ai_merchant_name?: string;
  expected_amount: number;
  prediction_frequency: string;
  confidence_score: number;
  is_active: boolean;
  auto_detected: boolean;
  next_predicted_date: string;
  account_identifier?: string;
  created_at: string;
}

interface SplitAccountsModalProps {
  merchant: TaggedMerchant;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (groups: TransactionGroup[]) => void;
}

export default function SplitAccountsModal({ merchant, isOpen, onClose, onConfirm }: SplitAccountsModalProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [groups, setGroups] = useState<TransactionGroup[]>([]);
  const [ungroupedTransactions, setUngroupedTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [draggedTransaction, setDraggedTransaction] = useState<Transaction | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successGroups, setSuccessGroups] = useState<TransactionGroup[]>([]);

  useEffect(() => {
    if (isOpen && merchant) {
      fetchMerchantTransactions();
    }
  }, [isOpen, merchant]);

  // Separate effect for loading existing splits after transactions are loaded
  useEffect(() => {
    if (isOpen && merchant && merchant.account_identifier && transactions.length > 0) {
      loadExistingSplits();
    }
  }, [isOpen, merchant, transactions]);

  const fetchMerchantTransactions = async () => {
    const searchTerm = merchant.ai_merchant_name || merchant.merchant_name;
    if (!searchTerm) return;
    
    setLoading(true);
    try {
      // Use merchant name for matching (don't pass merchantId here since we're fetching for splitting)
      const response = await fetch(`/api/merchant-transactions?merchant=${encodeURIComponent(searchTerm)}`);
      const data = await response.json();
      
      if (data.success) {
        const txs = data.transactions || [];
        // Ensure each transaction has the plaid_transaction_id as the id
        const normalizedTxs = txs.map((tx: Transaction) => ({
          ...tx,
          id: tx.plaid_transaction_id || tx.id // Use plaid_transaction_id if available
        }));
        setTransactions(normalizedTxs);
        if (!merchant.account_identifier) {
          // Only reset groups for new splits, not edits
          setUngroupedTransactions(normalizedTxs);
          // Create one empty group by default for new splits
          setGroups([{
            id: '1',
            name: `${merchant.merchant_name} 1`,
            transactions: [],
            averageAmount: 0,
            frequency: 'monthly',
            confidence: 0,
            nextPredictedDate: ''
          }]);
        }
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadExistingSplits = async () => {
    try {

      // Fetch all split merchants for this merchant name
      const response = await fetch(`/api/tagged-merchants`);
      const data = await response.json();
      
      if (data.success) {
        const allMerchants = data.taggedMerchants || [];
        const splitMerchants = allMerchants.filter((m: TaggedMerchant) => 
          m.merchant_name === merchant.merchant_name && 
          m.account_identifier && 
          m.is_active
        );

        // Load existing groups and their tracked transactions
        const existingGroups = [];
        let remainingTransactions = [...transactions];

        for (const splitMerchant of splitMerchants) {
          // Get tracked transactions for this split
          const txResponse = await fetch(`/api/merchant-transactions?merchant=${encodeURIComponent(merchant.merchant_name)}&merchantId=${splitMerchant.id}`);
          const txData = await txResponse.json();
          
          if (txData.success) {
            const trackedTxs = (txData.transactions || [])
              .filter((tx: Transaction) => tx.is_tracked_for_this_split)
              .map((tx: Transaction) => ({
                ...tx,
                id: tx.plaid_transaction_id || tx.id
              }));

            if (trackedTxs.length > 0) {
              const groupTransactions = trackedTxs.filter((tx: Transaction) => 
                transactions.some(t => t.id === tx.id)
              );

              existingGroups.push({
                id: splitMerchant.account_identifier,
                name: `${merchant.merchant_name} ${splitMerchant.account_identifier}`,
                transactions: groupTransactions,
                ...calculateGroupPredictions(groupTransactions)
              });

              // Remove these transactions from remaining
              remainingTransactions = remainingTransactions.filter((tx: Transaction) => 
                !groupTransactions.some((gtx: Transaction) => gtx.id === tx.id)
              );
            }
          }
        }

        setGroups(existingGroups);
        setUngroupedTransactions(remainingTransactions);
      }
    } catch (error) {
      console.error('Error loading existing splits:', error);
    }
  };

  const createNewGroup = () => {
    const newGroup: TransactionGroup = {
      id: (groups.length + 1).toString(),
      name: `${merchant.ai_merchant_name || merchant.merchant_name} ${groups.length + 1}`,
      transactions: [],
      averageAmount: 0,
      frequency: 'monthly',
      confidence: 0,
      nextPredictedDate: ''
    };
    setGroups([...groups, newGroup]);
  };

  const addTransactionToGroup = (transaction: Transaction, groupId: string) => {
    // Remove from ungrouped
    setUngroupedTransactions(prev => prev.filter(t => t.id !== transaction.id));
    
    // Remove from other groups
    setGroups(prevGroups => {
      return prevGroups.map(group => {
        if (group.id === groupId) {
          const newTransactions = [...group.transactions, transaction];
          return {
            ...group,
            transactions: newTransactions,
            ...calculateGroupPredictions(newTransactions)
          };
        } else {
          return {
            ...group,
            transactions: group.transactions.filter(t => t.id !== transaction.id)
          };
        }
      });
    });
  };

  const removeTransactionFromGroup = (transaction: Transaction, groupId: string) => {
    // Add back to ungrouped
    setUngroupedTransactions(prev => [...prev, transaction]);
    
    // Remove from group
    setGroups(prevGroups => {
      return prevGroups.map(group => {
        if (group.id === groupId) {
          const newTransactions = group.transactions.filter(t => t.id !== transaction.id);
          return {
            ...group,
            transactions: newTransactions,
            ...calculateGroupPredictions(newTransactions)
          };
        }
        return group;
      });
    });
  };

  const calculateGroupPredictions = (txs: Transaction[]) => {
    if (txs.length === 0) {
      return {
        averageAmount: 0,
        frequency: 'monthly',
        confidence: 0,
        nextPredictedDate: ''
      };
    }

    const amounts = txs.map(t => Math.abs(t.amount));
    const averageAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    
    const frequency = detectFrequency(txs);
    const confidence = calculateConfidence(txs);
    const nextPredictedDate = calculateNextDate(txs, frequency);

    return {
      averageAmount,
      frequency,
      confidence,
      nextPredictedDate
    };
  };

  const detectFrequency = (txs: Transaction[]): string => {
    if (txs.length < 2) return 'monthly';
    
    const sortedTxs = [...txs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const intervals: number[] = [];
    
    for (let i = 1; i < sortedTxs.length; i++) {
      const diffDays = Math.abs((new Date(sortedTxs[i].date).getTime() - new Date(sortedTxs[i-1].date).getTime()) / (1000 * 60 * 60 * 24));
      intervals.push(diffDays);
    }
    
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    
    if (avgInterval <= 10) return 'weekly';
    if (avgInterval <= 40) return 'monthly';
    if (avgInterval <= 75) return 'bi-monthly';
    return 'quarterly';
  };

  const calculateConfidence = (txs: Transaction[]): number => {
    if (txs.length < 2) return 50;
    
    const amounts = txs.map(t => Math.abs(t.amount));
    const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const variance = amounts.reduce((acc, amount) => acc + Math.pow(amount - avg, 2), 0) / amounts.length;
    const stdDev = Math.sqrt(variance);
    
    // Lower variance = higher confidence
    const coefficientOfVariation = stdDev / avg;
    return Math.max(60, Math.min(95, 95 - (coefficientOfVariation * 100)));
  };

  const calculateNextDate = (txs: Transaction[], frequency: string): string => {
    if (txs.length === 0) return '';
    
    const sortedTxs = [...txs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const lastDate = new Date(sortedTxs[0].date);
    let nextDate: Date;

    const today = new Date();
    
    switch (frequency) {
      case 'weekly':
        nextDate = new Date(lastDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        nextDate = new Date(lastDate.getFullYear(), lastDate.getMonth() + 1, lastDate.getDate());
        break;
      case 'bi-monthly':
        nextDate = new Date(lastDate.getFullYear(), lastDate.getMonth() + 2, lastDate.getDate());
        break;
      case 'quarterly':
        nextDate = new Date(lastDate.getFullYear(), lastDate.getMonth() + 3, lastDate.getDate());
        break;
      default:
        nextDate = new Date(lastDate.getFullYear(), lastDate.getMonth() + 1, lastDate.getDate());
    }

    // If predicted date is in the past, calculate from today
    while (nextDate <= today) {
      switch (frequency) {
        case 'weekly':
          nextDate = new Date(nextDate.getTime() + 7 * 24 * 60 * 60 * 1000);
          break;
        case 'monthly':
          nextDate = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, nextDate.getDate());
          break;
        case 'bi-monthly':
          nextDate = new Date(nextDate.getFullYear(), nextDate.getMonth() + 2, nextDate.getDate());
          break;
        case 'quarterly':
          nextDate = new Date(nextDate.getFullYear(), nextDate.getMonth() + 3, nextDate.getDate());
          break;
      }
    }

    return nextDate.toISOString().split('T')[0];
  };

  const handleSplit = () => {
    // Only send groups that have transactions
    const validGroups = groups.filter(g => g.transactions.length > 0);
    
    if (merchant.account_identifier) {
      // This is an edit operation - we need to handle it differently
      handleEditSplit(validGroups);
    } else {
      // This is a new split operation - show success feedback first
      setSuccessGroups(validGroups);
      setShowSuccess(true);
      
      // Execute the split
      onConfirm(validGroups);
      
      // Hide success feedback and close modal after 2 seconds
      setTimeout(() => {
        setShowSuccess(false);
        onClose();
      }, 2000);
    }
  };

  const handleEditSplit = async (validGroups: TransactionGroup[]) => {
    try {
      // For editing, we need to:
      // 1. Deactivate all current split merchants for this merchant name
      // 2. Either create new split merchants OR restore original if unsplitting
      
      // First, deactivate existing splits
      const response = await fetch('/api/tagged-merchants', {
        method: 'GET'
      });
      const data = await response.json();
      
      if (data.success) {
        const existingSplits = data.taggedMerchants.filter((m: TaggedMerchant) => 
          m.merchant_name === merchant.merchant_name && 
          m.account_identifier && 
          m.is_active
        );

        // Deactivate existing splits
        for (const split of existingSplits) {
          await fetch(`/api/tagged-merchants/${split.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_active: false })
          });
        }
      }

      if (validGroups.length === 0) {
        // Unsplit case - find and reactivate the original merchant
        const originalMerchantResponse = await fetch('/api/tagged-merchants', {
          method: 'GET'
        });
        const originalData = await originalMerchantResponse.json();
        
        if (originalData.success) {
          const originalMerchant = originalData.taggedMerchants.find((m: TaggedMerchant) => 
            m.merchant_name === merchant.merchant_name && 
            !m.account_identifier && 
            !m.is_active
          );

          if (originalMerchant) {
            await fetch(`/api/tagged-merchants/${originalMerchant.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ is_active: true })
            });
          }
        }
        onClose();
      } else {
        // Normal split case - create new splits
        onConfirm(validGroups);
        onClose();
      }
    } catch (error) {
      console.error('Error editing split:', error);
      alert('Error updating split configuration');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-7xl w-full mx-4 max-h-[85vh] overflow-y-auto relative">
        
        {/* Success Overlay */}
        {showSuccess && (
          <div className="absolute inset-0 bg-green-50 bg-opacity-95 flex items-center justify-center z-10 rounded-lg">
            <div className="text-center">
              <div className="text-6xl mb-4">✅</div>
              <div className="text-xl font-semibold text-green-800 mb-2">
                Split Created Successfully!
              </div>
              <div className="text-green-600">
                Created {successGroups.length} separate billing accounts
              </div>
              <div className="mt-4 max-w-md">
                {successGroups.map((group, index) => (
                  <div key={index} className="text-sm bg-white rounded p-2 mb-2 shadow">
                    <strong>{group.name}</strong>: {group.transactions.length} transactions tracked
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">
            {merchant.account_identifier 
              ? `Edit ${merchant.ai_merchant_name || merchant.merchant_name}${transactions[0]?.ai_category_tag ? ` - ${transactions[0].ai_category_tag}` : ''} Split Configuration`
              : `Split ${merchant.ai_merchant_name || merchant.merchant_name}${transactions[0]?.ai_category_tag ? ` - ${transactions[0].ai_category_tag}` : ''} into Multiple Accounts`
            }
          </h2>
          <Button variant="outline" onClick={onClose}>✕</Button>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="text-gray-500">Loading transaction history...</div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="text-sm text-gray-600 mb-4">
              📋 <strong>{transactions.length} transactions found</strong> • 
              {merchant.account_identifier 
                ? " Edit existing groups by dragging transactions between groups"
                : " Drag transactions from left to right to group them into separate recurring bills"
              }
            </div>

            <div className="grid grid-cols-2 gap-6">
              {/* Left side - Ungrouped Transactions */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-medium">📄 All Transactions</h3>
                  <span className="text-sm text-gray-500">{ungroupedTransactions.length} ungrouped</span>
                </div>
                
                <div className="border rounded-lg p-4 min-h-[300px] bg-gray-50">
                  {ungroupedTransactions.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      All transactions have been grouped
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {ungroupedTransactions.map((tx) => (
                        <div
                          key={tx.id}
                          draggable
                          onDragStart={() => setDraggedTransaction(tx)}
                          className="bg-white p-3 rounded border cursor-move hover:shadow-md transition-shadow"
                        >
                          <div className="flex justify-between items-center">
                            <div className="flex-1">
                              <div className="text-xs text-gray-600 mb-1">
                                {tx.date} • ${Math.abs(tx.amount).toFixed(2)}
                              </div>
                              <div className="font-medium text-sm truncate">
                                {tx.ai_merchant_name || tx.merchant_name || tx.name}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right side - Groups */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-medium">🔀 Bill Groups</h3>
                  <Button size="sm" onClick={createNewGroup} className="text-xs">
                    + New Group
                  </Button>
                </div>

                <div className="space-y-4">
                  {groups.map((group) => (
                    <Card 
                      key={group.id} 
                      className="p-4"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (draggedTransaction) {
                          addTransactionToGroup(draggedTransaction, group.id);
                          setDraggedTransaction(null);
                        }
                      }}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-medium">{group.name}</h4>
                          {group.transactions.length > 0 && (
                            <div className="text-sm text-green-600">
                              Next: {group.nextPredictedDate} • ${Math.round(group.averageAmount)} • {group.frequency}
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          {group.transactions.length} transactions
                        </div>
                      </div>
                      
                      <div className="min-h-[80px] border-2 border-dashed border-gray-200 rounded p-2">
                        {group.transactions.length === 0 ? (
                          <div className="text-center text-gray-400 py-4 text-sm">
                            Drag transactions here
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {group.transactions.map((tx) => (
                              <div
                                key={tx.id}
                                className="bg-blue-50 p-2 rounded text-sm flex justify-between items-center"
                              >
                                <div className="flex-1">
                                  <div className="text-xs text-gray-600 mb-1">
                                    {tx.date} • ${Math.abs(tx.amount).toFixed(2)}
                                  </div>
                                  <div className="font-medium truncate text-xs">
                                    {tx.ai_merchant_name || tx.merchant_name || tx.name}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => removeTransactionFromGroup(tx, group.id)}
                                    className="text-gray-400 hover:text-gray-600 text-xs"
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                  
                  {groups.length === 0 && !merchant.account_identifier && (
                    <div className="text-center text-gray-500 py-8 border-2 border-dashed border-gray-200 rounded">
                      A default group has been created - start dragging transactions from the left!
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t">
              <div className="text-sm text-gray-500">
                {merchant.account_identifier 
                  ? "Previous split configuration will be replaced • One-off transactions can be left ungrouped"
                  : `Original "${merchant.ai_merchant_name || merchant.merchant_name}" will be deactivated • One-off transactions can be left ungrouped`
                }
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={onClose}>Cancel</Button>
                <Button 
                  onClick={handleSplit} 
                  disabled={!merchant.account_identifier && groups.filter(g => g.transactions.length > 0).length === 0}
                >
                  {merchant.account_identifier 
                    ? (groups.filter(g => g.transactions.length > 0).length === 0 
                        ? "Restore Original (Unsplit)" 
                        : `Update to ${groups.filter(g => g.transactions.length > 0).length} Separate Bills`)
                    : `Create ${groups.filter(g => g.transactions.length > 0).length} Separate Bills`
                  }
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 