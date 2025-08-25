'use client';

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface FlowBreakdownData {
  userId: string;
  windowStart: string;
  windowEnd: string;
  calculation: {
    totalFlow: number;
    dailyFlow: number;
    totalFixed: number;
    totalTransfers: number;
    totalSpending: number;
    flowPercentage: number;
  };
  breakdown: {
    merchants: Array<{
      merchant: string;
      amount: number;
      dailyAmount: number;
      transactionCount: number;
      transactions: Array<{
        id: string;
        name: string;
        ai_merchant_name: string;
        ai_category_tag: string;
        amount: string;
        date: string;
      }>;
    }>;
    categories: Array<{
      category: string;
      amount: number;
      dailyAmount: number;
      transactionCount: number;
      transactions: Array<{
        id: string;
        name: string;
        ai_merchant_name: string;
        ai_category_tag: string;
        amount: string;
        date: string;
      }>;
    }>;
  };
  summary: {
    totalFlowTransactions: number;
    totalFixedTransactions: number;
    totalTransferTransactions: number;
    averageFlowTransaction: number;
  };
}

interface FlowBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export function FlowBreakdownModal({ isOpen, onClose, userId }: FlowBreakdownModalProps) {
  const [data, setData] = useState<FlowBreakdownData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'calculation' | 'merchants' | 'categories' | 'transactions'>('calculation');

  const fetchBreakdown = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/flow-breakdown?userId=${userId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch breakdown: ${response.statusText}`);
      }
      
      const breakdownData = await response.json();
      setData(breakdownData);
    } catch (err) {
      console.error('Error fetching breakdown:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Fetch data when modal opens
  React.useEffect(() => {
    if (isOpen && !data) {
      fetchBreakdown();
    }
  }, [isOpen, data, userId]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDailyCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">💰 Daily Flow Breakdown</h2>
          <Button variant="outline" onClick={onClose}>
            ✕ Close
          </Button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {loading && (
            <div className="text-center py-8">
              <div className="text-lg">Loading breakdown...</div>
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-700">Error: {error}</p>
                <Button onClick={fetchBreakdown} className="mt-2">
                  Try Again
                </Button>
              </div>
            </div>
          )}

          {data && (
            <div className="space-y-6">
              {/* Tab Navigation */}
              <div className="flex flex-wrap gap-2 border-b">
                <button
                  onClick={() => setActiveTab('calculation')}
                  className={`px-4 py-2 font-medium text-sm border-b-2 ${
                    activeTab === 'calculation' 
                      ? 'border-blue-500 text-blue-600' 
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  📊 Calculation
                </button>
                <button
                  onClick={() => setActiveTab('merchants')}
                  className={`px-4 py-2 font-medium text-sm border-b-2 ${
                    activeTab === 'merchants' 
                      ? 'border-blue-500 text-blue-600' 
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  🏪 Merchants ({data.breakdown.merchants.length})
                </button>
                <button
                  onClick={() => setActiveTab('categories')}
                  className={`px-4 py-2 font-medium text-sm border-b-2 ${
                    activeTab === 'categories' 
                      ? 'border-blue-500 text-blue-600' 
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  🗂️ Categories ({data.breakdown.categories.length})
                </button>
                <button
                  onClick={() => setActiveTab('transactions')}
                  className={`px-4 py-2 font-medium text-sm border-b-2 ${
                    activeTab === 'transactions' 
                      ? 'border-blue-500 text-blue-600' 
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  📝 Transactions ({data.summary.totalFlowTransactions})
                </button>
              </div>

              {/* Calculation Tab */}
              {activeTab === 'calculation' && (
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">📈 How Daily Flow is Calculated</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <h4 className="font-medium text-blue-900 mb-2">💡 Calculation Method</h4>
                          <p className="text-blue-800 text-sm mb-3">
                            Your Daily Flow is calculated from your last 30 days of discretionary spending:
                          </p>
                          <div className="space-y-2 text-sm text-blue-800">
                            <div>• <strong>Period:</strong> {formatDate(data.windowStart)} to {formatDate(data.windowEnd)}</div>
                            <div>• <strong>Total Flow Spending:</strong> {formatCurrency(data.calculation.totalFlow)}</div>
                            <div>• <strong>Daily Average:</strong> {formatCurrency(data.calculation.totalFlow)} ÷ 30 days = <strong>{formatDailyCurrency(data.calculation.dailyFlow)}</strong></div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="bg-green-50 p-4 rounded-lg text-center">
                            <div className="text-2xl font-bold text-green-600">
                              {formatCurrency(data.calculation.totalFlow)}
                            </div>
                            <div className="text-sm text-green-700 font-medium">Flow Spending</div>
                            <div className="text-xs text-green-600">
                              {data.calculation.flowPercentage.toFixed(1)}% of total
                            </div>
                          </div>

                          <div className="bg-gray-50 p-4 rounded-lg text-center">
                            <div className="text-2xl font-bold text-gray-600">
                              {formatCurrency(data.calculation.totalFixed)}
                            </div>
                            <div className="text-sm text-gray-700 font-medium">Fixed Expenses</div>
                            <div className="text-xs text-gray-600">
                              {((data.calculation.totalFixed / data.calculation.totalSpending) * 100).toFixed(1)}% of total
                            </div>
                          </div>

                          <div className="bg-blue-50 p-4 rounded-lg text-center">
                            <div className="text-2xl font-bold text-blue-600">
                              {formatCurrency(data.calculation.totalTransfers)}
                            </div>
                            <div className="text-sm text-blue-700 font-medium">Transfers</div>
                            <div className="text-xs text-blue-600">
                              {((data.calculation.totalTransfers / data.calculation.totalSpending) * 100).toFixed(1)}% of total
                            </div>
                          </div>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-lg">
                          <h4 className="font-medium text-gray-900 mb-2">📊 Summary Statistics</h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <div className="text-gray-600">Flow Transactions</div>
                              <div className="font-medium">{data.summary.totalFlowTransactions}</div>
                            </div>
                            <div>
                              <div className="text-gray-600">Average Transaction</div>
                              <div className="font-medium">{formatCurrency(data.summary.averageFlowTransaction)}</div>
                            </div>
                            <div>
                              <div className="text-gray-600">Fixed Transactions</div>
                              <div className="font-medium">{data.summary.totalFixedTransactions}</div>
                            </div>
                            <div>
                              <div className="text-gray-600">Transfer Transactions</div>
                              <div className="font-medium">{data.summary.totalTransferTransactions}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Merchants Tab */}
              {activeTab === 'merchants' && (
                <div className="space-y-4">
                  <div className="text-sm text-gray-600 mb-4">
                    Breakdown of your {formatDailyCurrency(data.calculation.dailyFlow)} daily flow by merchant:
                  </div>
                  
                  {data.breakdown.merchants.map((merchant) => (
                    <Card key={merchant.merchant}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium">{merchant.merchant}</div>
                          <div className="text-right">
                            <div className="font-bold">{formatDailyCurrency(merchant.dailyAmount)}/day</div>
                            <div className="text-xs text-gray-500">
                              {formatCurrency(merchant.amount)} total ({merchant.transactionCount} transactions)
                            </div>
                          </div>
                        </div>
                        
                        <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ 
                              width: `${Math.min(100, (merchant.amount / data.calculation.totalFlow) * 100)}%` 
                            }}
                          ></div>
                        </div>

                        <details className="text-sm">
                          <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                            View {merchant.transactionCount} transactions
                          </summary>
                          <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                            {merchant.transactions.map((tx) => (
                              <div key={tx.id} className="flex justify-between py-1 px-2 bg-gray-50 rounded text-xs">
                                <div>
                                  <span className="font-medium">{tx.name}</span>
                                  <span className="text-gray-500 ml-2">{formatDate(tx.date)}</span>
                                </div>
                                <div className="font-medium">{formatCurrency(parseFloat(tx.amount))}</div>
                              </div>
                            ))}
                          </div>
                        </details>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Categories Tab */}
              {activeTab === 'categories' && (
                <div className="space-y-4">
                  <div className="text-sm text-gray-600 mb-4">
                    Breakdown of your {formatDailyCurrency(data.calculation.dailyFlow)} daily flow by category:
                  </div>

                  {data.breakdown.categories.map((category) => (
                    <Card key={category.category}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium">{category.category}</div>
                          <div className="text-right">
                            <div className="font-bold">{formatDailyCurrency(category.dailyAmount)}/day</div>
                            <div className="text-xs text-gray-500">
                              {formatCurrency(category.amount)} total ({category.transactionCount} transactions)
                            </div>
                          </div>
                        </div>
                        
                        <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                          <div 
                            className="bg-green-600 h-2 rounded-full" 
                            style={{ 
                              width: `${Math.min(100, (category.amount / data.calculation.totalFlow) * 100)}%` 
                            }}
                          ></div>
                        </div>

                        <details className="text-sm">
                          <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                            View {category.transactionCount} transactions
                          </summary>
                          <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                            {category.transactions.map((tx) => (
                              <div key={tx.id} className="flex justify-between py-1 px-2 bg-gray-50 rounded text-xs">
                                <div>
                                  <span className="font-medium">{tx.ai_merchant_name}</span>
                                  <span className="text-gray-500 ml-2">{formatDate(tx.date)}</span>
                                </div>
                                <div className="font-medium">{formatCurrency(parseFloat(tx.amount))}</div>
                              </div>
                            ))}
                          </div>
                        </details>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Transactions Tab */}
              {activeTab === 'transactions' && (
                <div className="space-y-4">
                  <div className="text-sm text-gray-600 mb-4">
                    All {data.summary.totalFlowTransactions} transactions that contribute to your {formatDailyCurrency(data.calculation.dailyFlow)} daily flow:
                  </div>

                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {data.breakdown.merchants.flatMap(merchant => 
                      merchant.transactions.map(tx => ({
                        ...tx,
                        merchant: merchant.merchant
                      }))
                    )
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium">{tx.ai_merchant_name}</div>
                          <div className="text-sm text-gray-600">
                            {tx.ai_category_tag} • {formatDate(tx.date)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">{formatCurrency(parseFloat(tx.amount))}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
