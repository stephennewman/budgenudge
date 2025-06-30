'use client';

import { useState, useEffect, useMemo } from 'react';
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

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

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
  totalSpendingTransactions: number;
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<TransactionWithAnalytics[]>([]);
  // Removed merchantAnalytics state - data is now used directly in fetchData
  const [overallAnalytics, setOverallAnalytics] = useState({
    totalSpendingTransactions: 0,
    totalHistoricalSpending: 0,
    avgWeeklySpending: 0,
    avgMonthlySpending: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  
  const supabase = createSupabaseClient();

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
        
        // Enhance transactions with cached analytics
        const enhancedTransactions = transactionsData.transactions.map((transaction: Transaction) => {
          const merchantKey = transaction.merchant_name || transaction.name;
          const merchantData = merchantLookup[merchantKey] || {};
          
          return {
            ...transaction,
            id: transaction.id || transaction.plaid_transaction_id || Math.random().toString(),
            // Use cached analytics instead of calculating
            merchantTransactionCount: merchantData.total_transactions || 0,
            merchantTransactionsPerWeek: merchantData.avg_weekly_transactions || 0,
            merchantTransactionsPerMonth: merchantData.avg_monthly_transactions || 0,
            totalHistoricalSpending: merchantData.total_spending || 0,
            avgWeeklySpending: merchantData.avg_weekly_spending || 0,
            avgMonthlySpending: merchantData.avg_monthly_spending || 0,
            totalSpendingTransactions: merchantData.spending_transactions || 0,
            // Keep these for backward compatibility (calculated from overall data)
            totalTransactionsAllTime: transactionsData.transactions.length,
            avgTransactionsMonthly: 0, // Could calculate from overall if needed
            avgTransactionsWeekly: 0,  // Could calculate from overall if needed
            daysSinceFirstTransaction: 0,
            daysOfHistoricalData: 0,
            weeksOfHistoricalData: 0,
            monthsOfHistoricalData: 0,
          };
        });
        
        setTransactions(enhancedTransactions);
        
        // Use summary from cached analytics
        setOverallAnalytics({
          totalSpendingTransactions: analyticsData.summary?.totalSpendingTransactions || 0,
          totalHistoricalSpending: analyticsData.summary?.totalSpending || 0,
          avgWeeklySpending: analyticsData.summary?.avgWeeklySpending || 0,
          avgMonthlySpending: analyticsData.summary?.avgMonthlySpending || 0,
        });
        
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
      accessorKey: 'date',
      header: 'Date',
      cell: ({ getValue }: { getValue: () => string }) => new Date(getValue()).toLocaleDateString(),
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
      accessorKey: 'pending',
      header: 'Status',
      cell: ({ getValue }: { getValue: () => boolean }) => (
        <span className={`px-2 py-1 rounded text-xs ${getValue() ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
          {getValue() ? 'Pending' : 'Posted'}
        </span>
      ),
    },
    {
      accessorKey: 'merchantTransactionCount',
      header: 'Merchant Total',
      cell: ({ getValue }: { getValue: () => number }) => getValue(),
    },
    {
      accessorKey: 'merchantTransactionsPerWeek',
      header: 'Per Week',
      cell: ({ getValue }: { getValue: () => number }) => Math.round(getValue()),
    },
    {
      accessorKey: 'merchantTransactionsPerMonth',
      header: 'Per Month',
      cell: ({ getValue }: { getValue: () => number }) => Math.round(getValue()),
    },
    // NEW: Merchant-Specific Spending Analytics Columns
    {
      accessorKey: 'totalHistoricalSpending',
      header: 'Merchant Total Spending',
      cell: ({ getValue }: { getValue: () => number }) => (
        <span className="font-medium text-red-600">
          ${getValue().toLocaleString()}
        </span>
      ),
    },
    {
      accessorKey: 'avgWeeklySpending',
      header: 'Merchant Weekly Avg',
      cell: ({ getValue }: { getValue: () => number }) => (
        <span className="font-medium text-orange-600">
          ${getValue().toLocaleString()}
        </span>
      ),
    },
    {
      accessorKey: 'avgMonthlySpending',
      header: 'Merchant Monthly Avg', 
      cell: ({ getValue }: { getValue: () => number }) => (
        <span className="font-medium text-blue-600">
          ${getValue().toLocaleString()}
        </span>
      ),
    },
    {
      accessorKey: 'totalSpendingTransactions',
      header: 'Merchant Spending Count',
      cell: ({ getValue }: { getValue: () => number }) => (
        <span className="text-gray-600">
          {getValue().toLocaleString()}
        </span>
      ),
    },
    {
      accessorKey: 'plaid_transaction_id',
      header: 'Transaction ID',
      cell: ({ getValue }: { getValue: () => string | undefined }) => {
        const value = getValue();
        return value ? (
          <code className="text-xs bg-gray-100 px-1 rounded max-w-[100px] truncate block">
            {value}
          </code>
        ) : '-';
      },
    },
  ], []);

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
            <h1 className="text-2xl font-bold">Transaction & Spending Analytics</h1>
            <p className="text-muted-foreground">
              Transaction data with cached merchant analytics for fast performance
            </p>
          </div>
          <div className="text-sm text-muted-foreground">
            {transactions.length} total transactions loaded
          </div>
        </div>

        {/* Macro Stats Summary */}
        {transactions.length > 0 && (
          <>
            {/* Spending Analytics Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-red-50 p-4 rounded-lg border">
                <div className="text-sm text-red-600 font-medium">Total Historical Spending</div>
                <div className="text-2xl font-bold text-red-900">
                  ${Math.round((overallAnalytics.totalHistoricalSpending || 0) * 100) / 100}
                </div>
                <div className="text-xs text-red-500 mt-1">
                  {overallAnalytics.totalSpendingTransactions || 0} spending transactions
                </div>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg border">
                <div className="text-sm text-orange-600 font-medium">Avg Weekly Spending</div>
                <div className="text-2xl font-bold text-orange-900">
                  ${Math.round((overallAnalytics.avgWeeklySpending || 0) * 100) / 100}
                </div>
                <div className="text-xs text-orange-500 mt-1">
                  Based on {Math.round(transactions[0]?.weeksOfHistoricalData || 0)} weeks of data
                </div>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg border">
                <div className="text-sm text-blue-600 font-medium">Avg Monthly Spending</div>
                <div className="text-2xl font-bold text-blue-900">
                  ${Math.round((overallAnalytics.avgMonthlySpending || 0) * 100) / 100}
                </div>
                <div className="text-xs text-blue-500 mt-1">
                  Based on {Math.round(transactions[0]?.monthsOfHistoricalData || 0)} months of data
                </div>
              </div>
              <div className="bg-slate-50 p-4 rounded-lg border">
                <div className="text-sm text-slate-600 font-medium">Data Timeframe</div>
                <div className="text-2xl font-bold text-slate-900">
                  {transactions[0]?.daysOfHistoricalData || 0} days
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {Math.round(transactions[0]?.monthsOfHistoricalData || 0)} months • {Math.round(transactions[0]?.weeksOfHistoricalData || 0)} weeks
                </div>
              </div>
            </div>

            {/* Transaction Count Analytics Row */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="bg-green-50 p-4 rounded-lg border">
                <div className="text-sm text-green-600 font-medium">Total Transactions</div>
                <div className="text-2xl font-bold text-green-900">
                  {transactions[0]?.totalTransactionsAllTime.toLocaleString() || 0}
                </div>
              </div>
              <div className="bg-emerald-50 p-4 rounded-lg border">
                <div className="text-sm text-emerald-600 font-medium">Average per Month</div>
                <div className="text-2xl font-bold text-emerald-900">
                  {Math.round(transactions[0]?.avgTransactionsMonthly || 0)}
                </div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg border">
                <div className="text-sm text-purple-600 font-medium">Average per Week</div>
                <div className="text-2xl font-bold text-purple-900">
                  {Math.round(transactions[0]?.avgTransactionsWeekly || 0)}
                </div>
              </div>
              <div className="bg-teal-50 p-4 rounded-lg border">
                <div className="text-sm text-teal-600 font-medium">Spending Ratio</div>
                <div className="text-2xl font-bold text-teal-900">
                  {Math.round(((overallAnalytics.totalSpendingTransactions || 0) / (transactions[0]?.totalTransactionsAllTime || 1)) * 100)}%
                </div>
              </div>
              <div className="bg-indigo-50 p-4 rounded-lg border">
                <div className="text-sm text-indigo-600 font-medium">Income Transactions</div>
                <div className="text-2xl font-bold text-indigo-900">
                  {(transactions[0]?.totalTransactionsAllTime || 0) - (overallAnalytics.totalSpendingTransactions || 0)}
                </div>
              </div>
              <div className="bg-violet-50 p-4 rounded-lg border">
                <div className="text-sm text-violet-600 font-medium">Avg per Day</div>
                <div className="text-2xl font-bold text-violet-900">
                  {Math.round(((transactions[0]?.totalTransactionsAllTime || 0) / (transactions[0]?.daysOfHistoricalData || 1)) * 10) / 10}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Global Search */}
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

      <Card>
        <CardHeader>
          <CardTitle>Transactions Table</CardTitle>
        </CardHeader>
        <CardContent>
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