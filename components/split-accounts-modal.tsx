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
}

interface TransactionGroup {
  id: string;
  transactions: Transaction[];
  averageAmount: number;
  frequency: string;
  confidence: number;
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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && merchant) {
      fetchMerchantTransactions();
    }
  }, [isOpen, merchant]);

  const fetchMerchantTransactions = async () => {
    if (!merchant.ai_merchant_name) return;
    
    setLoading(true);
    try {
      // Use AI merchant name for precise matching
      const response = await fetch(`/api/merchant-transactions?merchant=${encodeURIComponent(merchant.ai_merchant_name)}`);
      const data = await response.json();
      
      if (data.success) {
        setTransactions(data.transactions || []);
        suggestGroups(data.transactions || []);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const suggestGroups = (txs: Transaction[]) => {
    if (txs.length < 4) {
      // Not enough transactions to suggest meaningful groups
      setGroups([{
        id: '1',
        transactions: txs,
        averageAmount: txs.reduce((sum, t) => sum + t.amount, 0) / txs.length,
        frequency: 'monthly',
        confidence: 50
      }]);
      return;
    }

    // Simple amount-based clustering
    const clusters = clusterByAmount(txs);
    const suggestedGroups = clusters.map((cluster, index) => ({
      id: (index + 1).toString(),
      transactions: cluster,
      averageAmount: cluster.reduce((sum, t) => sum + t.amount, 0) / cluster.length,
      frequency: detectFrequency(cluster),
      confidence: calculateConfidence(cluster)
    }));

    setGroups(suggestedGroups);
  };

  const clusterByAmount = (txs: Transaction[]): Transaction[][] => {
    if (txs.length < 4) return [txs];

    // Sort by amount
    const sorted = [...txs].sort((a, b) => a.amount - b.amount);
    const clusters: Transaction[][] = [];
    let currentCluster: Transaction[] = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const currentAmount = sorted[i].amount;
      const clusterAverage = currentCluster.reduce((sum, t) => sum + t.amount, 0) / currentCluster.length;
      
      // If amount is within 20% of cluster average, add to cluster
      if (Math.abs(currentAmount - clusterAverage) / clusterAverage <= 0.2) {
        currentCluster.push(sorted[i]);
      } else {
        // Start new cluster
        clusters.push(currentCluster);
        currentCluster = [sorted[i]];
      }
    }
    
    clusters.push(currentCluster);
    
    // Filter out clusters with less than 2 transactions
    return clusters.filter(cluster => cluster.length >= 2);
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
    
    const amounts = txs.map(t => t.amount);
    const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const variance = amounts.reduce((acc, amount) => acc + Math.pow(amount - avg, 2), 0) / amounts.length;
    const stdDev = Math.sqrt(variance);
    
    // Lower variance = higher confidence
    const coefficientOfVariation = stdDev / avg;
    return Math.max(60, Math.min(95, 95 - (coefficientOfVariation * 100)));
  };

  const handleSplit = () => {
    onConfirm(groups);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">
            Split {merchant.ai_merchant_name || merchant.merchant_name} into Multiple Accounts
          </h2>
          <Button variant="outline" onClick={onClose}>✕</Button>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="text-gray-500">Loading transaction history...</div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="text-sm text-gray-600">
              Based on {transactions.length} transactions, we suggest {groups.length} separate account(s):
            </div>

            {groups.map((group) => (
              <Card key={group.id} className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-medium">
                    {merchant.ai_merchant_name || merchant.merchant_name} {group.id}
                  </h3>
                  <div className="text-sm text-gray-500">
                    ~${Math.round(group.averageAmount)}/{group.frequency} • {Math.round(group.confidence)}% confidence
                  </div>
                </div>
                
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {group.transactions.map((tx) => (
                    <div key={tx.id} className="flex justify-between text-sm">
                      <span>{tx.date}</span>
                      <span>${tx.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            ))}

            <div className="flex justify-between items-center pt-4 border-t">
              <div className="text-sm text-gray-500">
                Original &ldquo;{merchant.ai_merchant_name || merchant.merchant_name}&rdquo; will be deactivated
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={onClose}>Cancel</Button>
                <Button onClick={handleSplit} disabled={groups.length === 0}>
                  Create {groups.length} Separate Bills
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 