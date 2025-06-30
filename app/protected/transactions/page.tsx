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
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<TransactionWithAnalytics[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  
  const supabase = createSupabaseClient();

  // Calculate analytics for each transaction
  const calculateAnalytics = (transactions: Transaction[]): TransactionWithAnalytics[] => {
    if (!transactions || transactions.length === 0) {
      return [];
    }
    
    const totalTransactions = transactions.length;
    
    // Calculate date range
    const dates = transactions.map(t => new Date(t.date)).sort();
    const firstDate = dates[0];
    const lastDate = dates[dates.length - 1];
    const daysBetween = Math.max(1, Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)));
    
    // Calculate historical data spans
    const weeksOfHistoricalData = Math.max(1, daysBetween / 7);
    const monthsOfHistoricalData = Math.max(1, daysBetween / 30.44); // Average days per month
    
    const avgTransactionsMonthly = totalTransactions / monthsOfHistoricalData;
    const avgTransactionsWeekly = totalTransactions / weeksOfHistoricalData;

    // Group by merchant for advanced analytics
    const merchantData = transactions.reduce((acc, t) => {
      const merchant = t.merchant_name || t.name;
      if (!acc[merchant]) {
        acc[merchant] = [];
      }
      acc[merchant].push(new Date(t.date));
      return acc;
    }, {} as Record<string, Date[]>);

    // Calculate merchant frequency analytics based on total dataset timespan
    const totalWeeksOfData = weeksOfHistoricalData;
    
    const merchantAnalytics = Object.entries(merchantData).reduce((acc, [merchant, dates]) => {
      const transactionCount = dates.length;
      const transactionsPerWeek = transactionCount / totalWeeksOfData;
      const transactionsPerMonth = (transactionsPerWeek * 52) / 12;

      acc[merchant] = {
        count: transactionCount,
        transactionsPerWeek: transactionsPerWeek,
        transactionsPerMonth: transactionsPerMonth,
      };
      return acc;
    }, {} as Record<string, { count: number; transactionsPerWeek: number; transactionsPerMonth: number }>);

    return transactions.map(transaction => {
      const merchant = transaction.merchant_name || transaction.name;
      const analytics = merchantAnalytics[merchant];
      
      return {
        ...transaction,
        id: transaction.id || transaction.plaid_transaction_id || Math.random().toString(),
        totalTransactionsAllTime: totalTransactions,
        avgTransactionsMonthly: Math.round(avgTransactionsMonthly * 100) / 100,
        avgTransactionsWeekly: Math.round(avgTransactionsWeekly * 100) / 100,
        daysSinceFirstTransaction: daysBetween,
        daysOfHistoricalData: daysBetween,
        weeksOfHistoricalData: Math.round(weeksOfHistoricalData * 10) / 10,
        monthsOfHistoricalData: Math.round(monthsOfHistoricalData * 10) / 10,
        merchantTransactionCount: analytics?.count || 0,
        merchantTransactionsPerWeek: analytics?.transactionsPerWeek || 0,
        merchantTransactionsPerMonth: analytics?.transactionsPerMonth || 0,
      };
    });
  };

  // Fetch transactions from API
  async function fetchTransactions() {
    try {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/plaid/transactions', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
      const data = await response.json();
      
      if (response.ok && data.transactions) {
        console.log('Raw transaction data:', data.transactions[0]); // Debug log
        const analyticsData = calculateAnalytics(data.transactions);
        setTransactions(analyticsData);
      } else {
        console.error('API Response:', data);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchTransactions();
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
            <h1 className="text-2xl font-bold">Transaction Analytics</h1>
            <p className="text-muted-foreground">
              Complete transaction data with intelligent analytics
            </p>
          </div>
          <div className="text-sm text-muted-foreground">
            {transactions.length} total transactions loaded
          </div>
        </div>

        {/* Macro Stats Summary */}
        {transactions.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg border">
              <div className="text-sm text-blue-600 font-medium">Total Transactions</div>
              <div className="text-2xl font-bold text-blue-900">
                {transactions[0]?.totalTransactionsAllTime.toLocaleString() || 0}
              </div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg border">
              <div className="text-sm text-green-600 font-medium">Average per Month</div>
              <div className="text-2xl font-bold text-green-900">
                {transactions[0]?.avgTransactionsMonthly.toFixed(1) || '0.0'}
              </div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg border">
              <div className="text-sm text-purple-600 font-medium">Average per Week</div>
              <div className="text-2xl font-bold text-purple-900">
                {transactions[0]?.avgTransactionsWeekly.toFixed(1) || '0.0'}
              </div>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg border">
              <div className="text-sm text-orange-600 font-medium">Days of Data</div>
              <div className="text-2xl font-bold text-orange-900">
                {transactions[0]?.daysOfHistoricalData || 0}
              </div>
            </div>
            <div className="bg-teal-50 p-4 rounded-lg border">
              <div className="text-sm text-teal-600 font-medium">Weeks of Data</div>
              <div className="text-2xl font-bold text-teal-900">
                {transactions[0]?.weeksOfHistoricalData.toFixed(1) || '0.0'}
              </div>
            </div>
            <div className="bg-indigo-50 p-4 rounded-lg border">
              <div className="text-sm text-indigo-600 font-medium">Months of Data</div>
              <div className="text-2xl font-bold text-indigo-900">
                {transactions[0]?.monthsOfHistoricalData.toFixed(1) || '0.0'}
              </div>
            </div>
          </div>
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