'use client';

import { useState, useEffect } from 'react';
import { createSupabaseClient } from '@/utils/supabase/client';
import { CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface Transaction {
  id: string | number;
  plaid_transaction_id?: string;
  amount: number;
  date: string;
  name: string;
  merchant_name?: string;
  ai_merchant_name?: string;
  ai_category_tag?: string;
  category: string[];
  account_id?: string;
}

interface TransactionVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  filterType: 'category' | 'merchant';
  filterValue: string; // category name or merchant name
  expectedTotal: number;
  timeRange: string;
}

export default function TransactionVerificationModal({ 
  isOpen, 
  onClose, 
  filterType,
  filterValue,
  expectedTotal,
  timeRange 
}: TransactionVerificationModalProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [actualTotal, setActualTotal] = useState(0);
  
  const supabase = createSupabaseClient();

  useEffect(() => {
    if (isOpen && filterValue) {
      // Clear previous data to avoid stale state
      setTransactions([]);
      setFilteredTransactions([]);
      setSearchTerm('');
      setActualTotal(0);
      
      fetchTransactions();
    }
  }, [isOpen, filterValue, filterType]);

  useEffect(() => {
    // Filter transactions based on search term
    const filtered = transactions.filter(transaction => {
      const merchantName = transaction.ai_merchant_name || transaction.merchant_name || transaction.name;
      return merchantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
             transaction.date.includes(searchTerm) ||
             transaction.amount.toString().includes(searchTerm);
    });
    
    
    
    setFilteredTransactions(filtered);
    
    // Calculate actual total
    const total = filtered.reduce((sum, tx) => sum + tx.amount, 0);
    setActualTotal(total);
  }, [transactions, searchTerm]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Calculate date range for current month with precise filtering
      const now = new Date();
      const currentMonth = now.getMonth(); // 0-based
      const currentYear = now.getFullYear();
      
      // Dynamic current month filtering
      const startDateString = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
      const endDateString = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(new Date(currentYear, currentMonth + 1, 0).getDate()).padStart(2, '0')}`;

      

      // Fetch transactions based on filter type
      let query = supabase
        .from('transactions')
        .select('*')
        .gte('date', startDateString)
        .lte('date', endDateString)
        .order('date', { ascending: false });

      // Apply appropriate filter based on type
      if (filterType === 'category') {
        query = query.eq('ai_category_tag', filterValue);
      } else if (filterType === 'merchant') {
        // For merchants, check both ai_merchant_name and merchant_name
        query = query.or(`ai_merchant_name.eq.${filterValue},merchant_name.eq.${filterValue}`);
      }

      const { data: transactionData, error } = await query;

      if (error) {
        console.error('Error fetching transactions:', error);
        return;
      }

      

      // Filter out any transactions from other months that might have slipped through
      const filteredData = transactionData?.filter((tx: Transaction) => {
        const txDate = new Date(tx.date + 'T12:00:00'); // Add noon to avoid timezone issues
        const isCurrentMonth = txDate.getMonth() === currentMonth;
        const isCurrentYear = txDate.getFullYear() === currentYear;
        const shouldInclude = isCurrentMonth && isCurrentYear;
        
        
        
        return shouldInclude;
      }) || [];

      

      setTransactions(filteredData);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    // Add noon time to avoid timezone conversion issues
    const dateWithTime = dateString.includes('T') ? dateString : dateString + 'T12:00:00';
    return new Date(dateWithTime).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (!isOpen) return null;

  const modalTitle = filterType === 'category' ? `${filterValue} Transactions` : `${filterValue} Transactions`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-5xl w-full mx-4 max-h-[85vh] overflow-hidden relative">
        
        {/* Header */}
        <CardHeader className="border-b bg-gray-50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {modalTitle}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {timeRange} • Verifying spending total
              </p>
            </div>
            <Button variant="outline" onClick={onClose} className="text-gray-500 hover:text-gray-700">
              ✕
            </Button>
          </div>
          
          {/* Summary Card */}
          <div className="mt-4 bg-white rounded-lg border p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {formatCurrency(actualTotal)}
                </div>
                <div className="text-sm text-gray-600">Calculated Total</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {formatCurrency(expectedTotal)}
                </div>
                <div className="text-sm text-gray-600">Expected Total</div>
              </div>
              <div>
                <div className={`text-2xl font-bold ${Math.abs(actualTotal - expectedTotal) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
                  {Math.abs(actualTotal - expectedTotal) < 0.01 ? '✓' : `${formatCurrency(Math.abs(actualTotal - expectedTotal))}`}
                </div>
                <div className="text-sm text-gray-600">
                  {Math.abs(actualTotal - expectedTotal) < 0.01 ? 'Verified' : 'Difference'}
                </div>
              </div>
            </div>
          </div>
        </CardHeader>

        {/* Content */}
        <CardContent className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Search */}
          <div className="mb-4">
            <Input
              type="text"
              placeholder="Search transactions by merchant, date, or amount..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>

          {/* Loading State */}
          {loading ? (
            <div className="text-center py-8">
              <div className="text-gray-500">Loading transactions...</div>
            </div>
          ) : (
            <>
              {/* Transaction Count */}
              <div className="mb-4 text-sm text-gray-600">
                Showing {filteredTransactions.length} of {transactions.length} transactions
              </div>

              {/* Transactions Table */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Merchant
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Description
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                    </tr>
                  </thead>
                                     <tbody className="bg-white divide-y divide-gray-200">
                     {filteredTransactions.map((transaction, index) => (
                      <tr key={transaction.id || index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(transaction.date)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="font-medium text-gray-900">
                            {transaction.ai_merchant_name || transaction.merchant_name || 'Unknown'}
                          </div>
                          {transaction.ai_merchant_name && transaction.merchant_name && 
                           transaction.ai_merchant_name !== transaction.merchant_name && (
                            <div className="text-xs text-gray-500">
                              Original: {transaction.merchant_name}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {transaction.name}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                          {formatCurrency(transaction.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {filteredTransactions.length === 0 && !loading && (
                  <div className="text-center py-8 text-gray-500">
                    No transactions found matching your search.
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>

        {/* Footer */}
        <div className="border-t bg-gray-50 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Total of {filteredTransactions.length} transactions: <span className="font-semibold">{formatCurrency(actualTotal)}</span>
            </div>
            <div className="flex space-x-2">
              <Button variant="outline" onClick={() => setSearchTerm('')}>
                Clear Search
              </Button>
              <Button onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 