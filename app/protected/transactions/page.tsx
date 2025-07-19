'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createSupabaseClient } from '@/utils/supabase/client';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  SortingState,
  ColumnFiltersState,
} from '@tanstack/react-table';

import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import ManualRefreshButton from '@/components/manual-refresh-button';

// Transaction interface - using flexible approach to handle API response
interface Transaction {
  id: string | number;
  plaid_transaction_id?: string;
  plaid_item_id?: string;
  account_id?: string;
  amount: number;
  date: string;
  name: string;
  merchant_name?: string;
  category: string[];
  subcategory?: string;
  transaction_type?: string;
  pending: boolean;
  account_owner?: string;
  created_at?: string;
  updated_at?: string;
  ai_merchant_name?: string;
  ai_category_tag?: string;
}

// Merchant analytics data from database
interface MerchantAnalyticsData {
  merchant_name: string;
  total_transactions: number;
  total_spending: number;
  spending_transactions: number;
  avg_weekly_spending: number;
  avg_monthly_spending: number;
  avg_weekly_transactions: number;
  avg_monthly_transactions: number;
  is_recurring: boolean;
  recurring_reason: string;
}

// Extended interface with calculated analytics
interface TransactionWithAnalytics extends Transaction {
  id: string | number;
  totalTransactionsAllTime: number;
  avgTransactionsMonthly: number;
  avgTransactionsWeekly: number;
  daysSinceFirstTransaction: number;
  daysOfHistoricalData: number;
  weeksOfHistoricalData: number;
  monthsOfHistoricalData: number;
  merchantTransactionCount: number;
  merchantTransactionsPerWeek: number;
  merchantTransactionsPerMonth: number;
  // NEW: Spending-focused analytics
  totalHistoricalSpending: number;
  avgWeeklySpending: number;
  avgMonthlySpending: number;
  totalMerchantTransactions: number;
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<TransactionWithAnalytics[]>([]);
  // Removed merchantAnalytics state and overallAnalytics state - data is now used directly in fetchData
  const [isLoading, setIsLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [taggedMerchants, setTaggedMerchants] = useState<Set<string>>(new Set());
  const [starringMerchant, setStarringMerchant] = useState<string | null>(null);
  
  const supabase = createSupabaseClient();

  // Frontend normalization function (matches backend normalize_merchant_name)
  function normalizeTransactionMerchantName(rawName: string): string {
    if (!rawName || rawName.trim() === '') {
      return 'Unknown Merchant';
    }
    
    let normalized = rawName.trim();
    
    // Apply same normalization patterns as backend
    if (normalized.match(/^JPM CHASE PAYMENT \d+/i)) {
      normalized = 'JPM Chase Payment';
    } else if (normalized.match(/^CHASE CREDIT CRD AUTOPAY/i)) {
      normalized = 'Chase Credit Card Autopay';
    } else if (normalized.match(/^BANK OF AMERICA/i)) {
      normalized = 'Bank of America';
    } else if (normalized.match(/^CERTIPAY PAYROLL PAYROLL \d+/i)) {
      normalized = 'Certipay Payroll';
    } else if (normalized.match(/^GCA PAY \d+ \d+/i)) {
      normalized = 'GCA Pay';
    } else if (normalized.match(/^Check Paid #\d+/i)) {
      normalized = 'Check Payment';
    } else if (normalized.match(/^Funds Transfer.*-\d+/i)) {
      normalized = 'Funds Transfer to Brokerage';
    } else if (normalized.match(/^Amazon Prime Video/i)) {
      normalized = 'Amazon Prime';
    } else if (normalized.match(/^Amazon Prime/i)) {
      normalized = 'Amazon Prime';
    } else if (normalized.match(/^Cursor Usage Mid/i)) {
      normalized = 'Cursor Usage';
    } else if (normalized.match(/\d{6}/)) {
      // Remove 6-digit date codes (YYMMDD format)
      normalized = normalized.replace(/\d{6}/g, '').trim();
      normalized = normalized.replace(/\s+/g, ' '); // Clean extra spaces
    } else if (normalized.match(/#\d+/)) {
      // Remove transaction IDs like #1234
      normalized = normalized.replace(/#\d+/g, '').trim();
      normalized = normalized.replace(/\s+/g, ' '); // Clean extra spaces
    }
    
    // Final cleanup: ensure proper capitalization and remove extra spaces
    normalized = normalized.replace(/\s+/g, ' ').trim();
    
    // Convert to title case for consistency
    normalized = normalized.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
    
    // If normalization resulted in empty string, use original
    if (normalized === '' || normalized === 'Unknown Merchant') {
      normalized = rawName;
    }
    
    return normalized;
  }

  // Fetch tagged merchants
  async function fetchTaggedMerchants() {
    try {
      const response = await fetch('/api/tagged-merchants');
      const data = await response.json();
      
      if (data.success && data.taggedMerchants) {
        const merchantNames = new Set<string>(
          data.taggedMerchants
            .filter((m: { is_active: boolean }) => m.is_active)
            .map((m: { merchant_name: string }) => m.merchant_name.toLowerCase())
        );
        setTaggedMerchants(merchantNames);
      }
    } catch (error) {
      console.error('Error fetching tagged merchants:', error);
    }
  }

  // Handle starring a merchant
  const handleStarMerchant = useCallback(async (merchantName: string) => {
    setStarringMerchant(merchantName);
    
    try {
      const response = await fetch('/api/tagged-merchants/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchant_name: merchantName })
      });

      const data = await response.json();
      
      if (data.success) {
        await fetchTaggedMerchants();
      } else {
        alert('Failed to analyze merchant: ' + data.error);
      }
    } catch (error) {
      console.error('Error starring merchant:', error);
      alert('Error starring merchant');
    } finally {
      setStarringMerchant(null);
    }
  }, []);

  // Handle unstarring a merchant
  const handleUnstarMerchant = useCallback(async (merchantName: string) => {
    if (!confirm(`Remove ${merchantName} from recurring bills?`)) return;
    
    setStarringMerchant(merchantName);
    
    try {
      const response = await fetch('/api/tagged-merchants');
      const data = await response.json();
      
      if (data.success) {
        const merchant = data.taggedMerchants.find((m: { merchant_name: string; id: number }) => 
          m.merchant_name.toLowerCase() === merchantName.toLowerCase()
        );
        
        if (merchant) {
          const deleteResponse = await fetch(`/api/tagged-merchants/${merchant.id}`, {
            method: 'DELETE'
          });
          
          const deleteData = await deleteResponse.json();
          
          if (deleteData.success) {
            await fetchTaggedMerchants();
          } else {
            alert('Failed to remove merchant: ' + deleteData.error);
          }
        }
      }
    } catch (error) {
      console.error('Error unstarring merchant:', error);
      alert('Error unstarring merchant');
    } finally {
      setStarringMerchant(null);
    }
  }, []);

  // Analytics are now fetched from cached merchant_analytics table for performance

  // Fetch transactions and cached merchant analytics
  async function fetchData() {
    try {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Fetch both transactions and cached merchant analytics in parallel
      const [transactionsResponse, analyticsResponse] = await Promise.all([
        fetch('/api/plaid/transactions', {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        }),
        fetch('/api/merchant-analytics', {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        })
      ]);
      
      const transactionsData = await transactionsResponse.json();
      const analyticsData = await analyticsResponse.json();
      
      if (transactionsResponse.ok && transactionsData.transactions && 
          analyticsResponse.ok && analyticsData.merchants) {
        
        console.log('Transactions fetched:', transactionsData.transactions.length);
        console.log('Cached analytics fetched:', analyticsData.merchants.length);
        
        // Create a lookup map for merchant analytics
        const merchantLookup = analyticsData.merchants.reduce((acc: Record<string, MerchantAnalyticsData>, merchant: MerchantAnalyticsData) => {
          acc[merchant.merchant_name] = merchant;
          return acc;
        }, {});
        
        // Calculate overall timeframe analytics from transaction dates
        const allDates = transactionsData.transactions.map((t: Transaction) => new Date(t.date));
        const earliestDate = allDates.length > 0 ? new Date(Math.min(...allDates.map((d: Date) => d.getTime()))) : new Date();
        const latestDate = allDates.length > 0 ? new Date(Math.max(...allDates.map((d: Date) => d.getTime()))) : new Date();
        const today = new Date();
        
        // Calculate time ranges
        const daysSinceFirst = Math.max(1, Math.ceil((today.getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24)));
        const daysOfData = Math.max(1, Math.ceil((latestDate.getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24)));
        const weeksOfData = Math.max(1, daysOfData / 7);
        const monthsOfData = Math.max(1, daysOfData / 30.44);
        
        // Calculate averages
        const totalTransactions = transactionsData.transactions.length;
        const avgTransactionsMonthly = totalTransactions / monthsOfData;
        const avgTransactionsWeekly = totalTransactions / weeksOfData;

        // Calculate transaction counts and amounts per merchant from actual visible transactions
        const merchantTransactionCounts = transactionsData.transactions.reduce((acc: Record<string, number>, transaction: Transaction) => {
          const merchantKey = transaction.merchant_name || transaction.name;
          acc[merchantKey] = (acc[merchantKey] || 0) + 1;
          return acc;
        }, {});



        // Enhance transactions with cached analytics and proper time calculations
        const enhancedTransactions = transactionsData.transactions.map((transaction: Transaction) => {
          const rawMerchantKey = transaction.merchant_name || transaction.name;
          const normalizedMerchantKey = normalizeTransactionMerchantName(rawMerchantKey);
          const merchantData = merchantLookup[normalizedMerchantKey] || {};
          
          // DEBUG: Log lookup failures for key merchants
          if (rawMerchantKey.includes('CAPTAINS') || rawMerchantKey.includes('BBQ')) {
            console.log(`🔍 CAPTAINS BBQ LOOKUP:`, {
              raw: rawMerchantKey,
              normalized: normalizedMerchantKey,
              foundInCache: !!merchantData.merchant_name,
              cachedSpending: merchantData.total_spending,
              transactionAmount: transaction.amount
            });
          }
          
          return {
            ...transaction,
            id: transaction.id || transaction.plaid_transaction_id || Math.random().toString(),
            // Use cached analytics for spending-specific metrics
            merchantTransactionCount: merchantData.total_transactions || 0,
            merchantTransactionsPerWeek: merchantData.avg_weekly_transactions || 0,
            merchantTransactionsPerMonth: merchantData.avg_monthly_transactions || 0,
            totalHistoricalSpending: merchantData.total_spending || 0,
            avgWeeklySpending: merchantData.avg_weekly_spending || 0,
            avgMonthlySpending: merchantData.avg_monthly_spending || 0,
            // FIX: Use actual count of transactions being displayed, not just spending transactions
            totalMerchantTransactions: merchantTransactionCounts[rawMerchantKey] || 1,
            // Calculated time-based analytics (same for all transactions)
            totalTransactionsAllTime: totalTransactions,
            avgTransactionsMonthly: avgTransactionsMonthly,
            avgTransactionsWeekly: avgTransactionsWeekly,
            daysSinceFirstTransaction: daysSinceFirst,
            daysOfHistoricalData: daysOfData,
            weeksOfHistoricalData: weeksOfData,
            monthsOfHistoricalData: monthsOfData,
          };
        });
        
        setTransactions(enhancedTransactions);
        
        // Fetch tagged merchants
        await fetchTaggedMerchants();
        
        // DEBUG: Check merchant lookup success rate
        const lookupSuccesses = enhancedTransactions.filter((t: TransactionWithAnalytics) => {
          const rawKey = t.merchant_name || t.name;
          const normalizedKey = normalizeTransactionMerchantName(rawKey);
          return merchantLookup[normalizedKey]?.merchant_name;
        }).length;
        
        console.log('=== MERCHANT LOOKUP ANALYSIS ===');
        console.log('Total transactions:', enhancedTransactions.length);
        console.log('Successful merchant lookups:', lookupSuccesses);
        console.log('Failed lookups:', enhancedTransactions.length - lookupSuccesses);
        console.log('Success rate:', ((lookupSuccesses / enhancedTransactions.length) * 100).toFixed(1) + '%');
        
        // Show examples of successful vs failed lookups
        const exampleSuccess = enhancedTransactions.find((t: TransactionWithAnalytics) => {
          const normalizedKey = normalizeTransactionMerchantName(t.merchant_name || t.name);
          return merchantLookup[normalizedKey]?.total_spending > 0;
        });
        if (exampleSuccess) {
          const rawKey = exampleSuccess.merchant_name || exampleSuccess.name;
          const normalizedKey = normalizeTransactionMerchantName(rawKey);
          console.log('✅ Example successful lookup:', {
            raw: rawKey,
            normalized: normalizedKey,
            cachedSpending: merchantLookup[normalizedKey]?.total_spending
          });
        }
        
        // DEBUG: Analyze transaction amounts to verify spending vs income categorization
        const positiveAmounts = enhancedTransactions.filter((t: TransactionWithAnalytics) => t.amount > 0);
        const negativeAmounts = enhancedTransactions.filter((t: TransactionWithAnalytics) => t.amount < 0);
        const zeroAmounts = enhancedTransactions.filter((t: TransactionWithAnalytics) => t.amount === 0);
        
        console.log('=== TRANSACTION AMOUNT ANALYSIS ===');
        console.log('Total transactions:', enhancedTransactions.length);
        console.log('Positive amounts (spending):', positiveAmounts.length);
        console.log('Negative amounts (income):', negativeAmounts.length);
        console.log('Zero amounts:', zeroAmounts.length);
        
        console.log('=== DATE RANGE ANALYSIS ===');
        console.log('Earliest transaction date:', earliestDate.toLocaleDateString());
        console.log('Latest transaction date:', latestDate.toLocaleDateString());
        console.log('Days of historical data:', daysOfData);
        console.log('Weeks of historical data:', weeksOfData.toFixed(1));
        console.log('Months of historical data:', monthsOfData.toFixed(1));
        console.log('Avg transactions per week:', avgTransactionsWeekly.toFixed(1));
        console.log('Avg transactions per month:', avgTransactionsMonthly.toFixed(1));
        
        if (positiveAmounts.length > 0) {
          console.log('Sample positive amounts (spending):');
          positiveAmounts.slice(0, 3).forEach((t: TransactionWithAnalytics) => 
            console.log(`  $${t.amount} - ${t.name} (${t.merchant_name || 'no merchant'})`)
          );
        }
        
        if (negativeAmounts.length > 0) {
          console.log('Sample negative amounts (income):');
          negativeAmounts.slice(0, 3).forEach((t: TransactionWithAnalytics) => 
            console.log(`  $${t.amount} - ${t.name} (${t.merchant_name || 'no merchant'})`)
          );
        }
        
        // Calculate REAL analytics from actual transaction data instead of using stale cached summary
        const realSpendingTransactions = positiveAmounts.length;
        const realIncomeTransactions = negativeAmounts.length;
        const realTotalSpending = positiveAmounts.reduce((sum: number, t: TransactionWithAnalytics) => sum + t.amount, 0);
        
        console.log('=== REAL VS CACHED ANALYTICS COMPARISON ===');
        console.log('Real spending transactions:', realSpendingTransactions);
        console.log('Cached spending transactions:', analyticsData.summary?.totalSpendingTransactions || 0);
        console.log('Real total spending:', realTotalSpending.toFixed(2));
        console.log('Cached total spending:', analyticsData.summary?.totalSpending || 0);
        console.log('Real income transactions:', realIncomeTransactions);
        console.log('Calculated income transactions (total - cached spending):', totalTransactions - (analyticsData.summary?.totalSpendingTransactions || 0));
        
        // Analytics calculated but not stored (was used for overall summary cards)
        
      } else {
        console.error('API Responses:', { transactions: transactionsData, analytics: analyticsData });
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Column definitions
  const columns = useMemo(() => [
    {
      id: 'star',
      header: '⭐ Recurring',
      cell: ({ row }: { row: { original: TransactionWithAnalytics } }) => {
        const transaction = row.original;
        const merchantName = transaction.merchant_name || transaction.name;
        const isTagged = taggedMerchants.has(merchantName.toLowerCase());
        const isStarring = starringMerchant === merchantName;
        
        return (
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
        );
      },
      enableSorting: false,
      size: 60,
    },
    {
      accessorKey: 'date',
      header: 'Date',
      cell: ({ getValue }: { getValue: () => string }) => {
        // Parse date as local time to avoid timezone offset issues
        const dateStr = getValue();
        const date = new Date(dateStr + 'T00:00:00');
        return date.toLocaleDateString();
      },
      sortDescFirst: true,
    },
    {
      accessorKey: 'name',
      header: 'Description',
      cell: ({ getValue }: { getValue: () => string }) => (
        <div className="font-medium max-w-[200px] truncate">
          {getValue()}
        </div>
      ),
    },
    {
      accessorKey: 'merchant_name',
      header: 'Merchant',
      cell: ({ getValue }: { getValue: () => string | undefined }) => getValue() || '-',
    },
    {
      accessorKey: 'amount',
      header: 'Amount',
      cell: ({ getValue }: { getValue: () => number }) => {
        const amount = getValue();
        return (
          <span className={`font-medium ${amount > 0 ? 'text-red-600' : 'text-green-600'}`}>
            ${Math.abs(amount).toFixed(2)}
          </span>
        );
      },
    },
    {
      accessorKey: 'category',
      header: 'Category',
      cell: ({ getValue }: { getValue: () => string[] }) => {
        const categories = getValue();
        return categories?.[0] || 'Other';
      },
    },
    {
      accessorKey: 'subcategory',
      header: 'Subcategory',
      cell: ({ getValue }: { getValue: () => string | undefined }) => {
        const subcategory = getValue();
        return subcategory ? (
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
            {subcategory}
          </span>
        ) : (
          <span className="text-gray-400">-</span>
        );
      },
    },
    {
      accessorKey: 'ai_merchant_name',
      header: 'AI Merchant',
      cell: ({ getValue }: { getValue: () => string | undefined }) => {
        const aiMerchant = getValue();
        return aiMerchant ? (
          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded font-medium">
            {aiMerchant}
          </span>
        ) : (
          <span className="text-gray-400 text-xs">Not tagged</span>
        );
      },
    },
    {
      accessorKey: 'ai_category_tag',
      header: 'AI Category',
      cell: ({ getValue }: { getValue: () => string | undefined }) => {
        const aiCategory = getValue();
        return aiCategory ? (
          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-medium">
            {aiCategory}
          </span>
        ) : (
          <span className="text-gray-400 text-xs">Not tagged</span>
        );
      },
    },
    {
      accessorKey: 'pending',
      header: 'Status',
      cell: ({ getValue }: { getValue: () => boolean }) => (
        <span className={`px-2 py-1 rounded text-xs ${getValue() ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
          {getValue() ? 'Pending' : 'Posted'}
        </span>
      ),
    },
    {
      accessorKey: 'totalMerchantTransactions',
      header: 'Merchant Transaction Count',
      cell: ({ getValue }: { getValue: () => number }) => (
        <span className="text-gray-600">
          {getValue().toLocaleString()}
        </span>
      ),
    },
  ], [taggedMerchants, starringMerchant, handleStarMerchant, handleUnstarMerchant]);

  const table = useReactTable({
    data: transactions,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: {
      pagination: {
        pageSize: 1000,
      },
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading transactions...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">💳 Transactions</h1>
            <p className="text-gray-600 mt-1">
              {transactions.length} total transactions
            </p>
          </div>
          <ManualRefreshButton 
            onRefresh={() => fetchData()}
          />
        </div>



      </div>

      <Card>
        <CardContent>
          {/* Search and Controls */}
          <div className="flex items-center justify-between space-x-2 mb-4">
            <div className="flex items-center space-x-2">
              <Input
                placeholder="Search transactions..."
                value={globalFilter ?? ''}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="max-w-sm"
              />
              <Button
                variant="outline"
                onClick={() => {
                  setGlobalFilter('');
                  setColumnFilters([]);
                  setSorting([]);
                }}
              >
                Clear Filters
              </Button>
            </div>

          </div>
          <div className="rounded-md border">
            <div className="overflow-x-auto">
              <table className="w-full caption-bottom text-sm">
                <thead className="[&_tr]:border-b">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id} className="border-b transition-colors hover:bg-muted/50">
                      {headerGroup.headers.map((header) => (
                        <th
                          key={header.id}
                          className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0"
                        >
                          {header.isPlaceholder ? null : (
                            <div
                              className={header.column.getCanSort() ? 'cursor-pointer select-none' : ''}
                              onClick={header.column.getToggleSortingHandler()}
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              {header.column.getIsSorted() === 'asc' ? ' ↑' : header.column.getIsSorted() === 'desc' ? ' ↓' : ''}
                            </div>
                          )}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody className="[&_tr:last-child]:border-0">
                  {table.getRowModel().rows?.length ? (
                    table.getRowModel().rows.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="p-4 align-middle [&:has([role=checkbox])]:pr-0">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                        {transactions.length === 0 ? 
                          "No transactions found. Connect your bank account to see data!" : 
                          "No transactions match your search criteria."
                        }
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between space-x-2 py-4">
            <div className="text-sm text-muted-foreground">
              Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{' '}
              {Math.min(
                (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                table.getFilteredRowModel().rows.length
              )}{' '}
              of {table.getFilteredRowModel().rows.length} entries
              {table.getFilteredRowModel().rows.length !== transactions.length && (
                <span className="ml-2 text-blue-600">(filtered from {transactions.length} total)</span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <div className="text-sm text-muted-foreground">
                Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                First
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Next
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
              >
                Last
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 