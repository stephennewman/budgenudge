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
import AITagEditor from '@/components/ai-tag-editor';
import { ContentAreaLoader } from '@/components/ui/content-area-loader';

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
  // Enhanced fields
  logo_url?: string;
}

// SIMPLIFIED: Basic transaction interface without heavy analytics
interface TransactionWithAnalytics extends Transaction {
  id: string | number;
}

// Function to get consistent color for merchant based on first letter
const getMerchantColor = (merchantName: string) => {
  const colors = [
    'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500', 'bg-pink-500',
    'bg-indigo-500', 'bg-orange-500', 'bg-teal-500', 'bg-cyan-500', 'bg-rose-500', 'bg-violet-500',
    'bg-emerald-500', 'bg-amber-500', 'bg-lime-500', 'bg-sky-500', 'bg-fuchsia-500', 'bg-slate-500',
    'bg-red-600', 'bg-blue-600', 'bg-green-600', 'bg-yellow-600', 'bg-purple-600', 'bg-pink-600',
    'bg-indigo-600', 'bg-orange-600'
  ];
  
  const firstLetter = merchantName.charAt(0).toUpperCase();
  const letterIndex = firstLetter.charCodeAt(0) - 65; // A=0, B=1, etc.
  const colorIndex = letterIndex % colors.length;
  return colors[colorIndex];
};

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<TransactionWithAnalytics[]>([]);
  const [accounts, setAccounts] = useState<Array<{ id: string; plaid_account_id: string; name: string; official_name?: string; type: string; subtype?: string; mask?: string; current_balance?: number; available_balance?: number; verification_status?: string; iso_currency_code?: string; balance_last_updated?: string }>>([]);
  // Removed merchantAnalytics state and overallAnalytics state - data is now used directly in fetchData
  const [isLoading, setIsLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [, setTaggedMerchants] = useState<Set<string>>(new Set());
  const [starringMerchant, setStarringMerchant] = useState<string | null>(null);
  const [transactionStarredStatus, setTransactionStarredStatus] = useState<Map<string, boolean>>(new Map());

  
  // AI Tag Editor state
  const [tagEditorOpen, setTagEditorOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<{
    merchant_pattern: string;
    ai_merchant_name: string;
    ai_category_tag: string;
  } | null>(null);
  
  // Visual feedback state
  const [highlightedTransactions, setHighlightedTransactions] = useState<Set<string | number>>(new Set());
  
  const supabase = createSupabaseClient();

  // Quick filter helpers for click-to-filter behavior
  const setCategoryFilter = useCallback((category: string) => {
    setColumnFilters([{ id: 'ai_category_tag', value: category }]);
  }, []);

  const setSubcategoryFilter = useCallback((subcategory: string) => {
    setColumnFilters([{ id: 'subcategory', value: subcategory }]);
  }, []);

  const setMerchantFilter = useCallback((merchant: string) => {
    setGlobalFilter(merchant);
  }, []);

  // Helper function to get account info for a transaction
  const getAccountInfo = (accountId: string) => {
    // Try multiple possible mappings between transaction account_id and account records
    let account = accounts.find(acc => acc.plaid_account_id === accountId);
    
    if (!account) {
      // Try matching by id field
      account = accounts.find(acc => acc.id === accountId);
    }
    
    if (!account) {
      // Try matching by id field (database ID)
      account = accounts.find(acc => acc.id?.toString() === accountId);
    }
    
    if (!account) {
      return { 
        name: 'Unknown Account', 
        displayName: `Unknown (${accountId?.slice(0, 8)}...)`,
        type: '?',
        subtype: '?',
        fullAccount: null
      };
    }
    
    // Create better display name using available data
    // Try to extract institution from account name if available
    const accountName = account.official_name || account.name;
    const accountType = account.subtype ? 
      account.subtype.charAt(0).toUpperCase() + account.subtype.slice(1) :
      (account.type || 'Account');
    const maskPart = account.mask ? ` • ••••${account.mask}` : '';
    
    // For now, use the account name until we can safely get institution names
    const displayName = `${accountName} • ${accountType}${maskPart}`;
    
    return {
      name: account.name,
      official_name: account.official_name,
      displayName,
      type: account.type || 'unknown',
      subtype: account.subtype || 'unknown',
      mask: account.mask,
      current_balance: account.current_balance,
      available_balance: account.available_balance,
      verification_status: account.verification_status,
      iso_currency_code: account.iso_currency_code,
      balance_last_updated: account.balance_last_updated,
      fullAccount: account
    };
  };

  // Handle opening the tag editor
  const handleEditTags = (transaction: Transaction) => {
    const merchantPattern = transaction.merchant_name || transaction.name;
    setEditingTransaction({
      merchant_pattern: merchantPattern,
      ai_merchant_name: transaction.ai_merchant_name || '',
      ai_category_tag: transaction.ai_category_tag || ''
    });
    setTagEditorOpen(true);
  };

  // Handle saving tag overrides
  const handleSaveTagOverride = async (data: {
    merchant_pattern: string;
    ai_merchant_name: string;
    ai_category_tag: string;
    apply_to_existing: boolean;
  }) => {
    try {
      const response = await fetch('/api/manual-tag-override', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Tag override applied:', result.message);
        console.log(`📊 Updated ${result.updated_transactions} transactions`);
        
        // Update local state instead of full reload
        setTransactions(prevTransactions => {
          const updatedTransactions = prevTransactions.map(tx => {
            const merchantPattern = tx.merchant_name || tx.name;
            if (merchantPattern === data.merchant_pattern) {
              return {
                ...tx,
                ai_merchant_name: data.ai_merchant_name,
                ai_category_tag: data.ai_category_tag
              };
            }
            return tx;
          });
          
          // Find transactions that were updated and highlight them
          const updatedIds = new Set<string | number>();
          updatedTransactions.forEach(tx => {
            const merchantPattern = tx.merchant_name || tx.name;
            if (merchantPattern === data.merchant_pattern) {
              updatedIds.add(tx.id);
            }
          });
          
          // Set highlighting for updated transactions
          setHighlightedTransactions(updatedIds);
          
          // Remove highlighting after 3 seconds
          setTimeout(() => {
            setHighlightedTransactions(new Set());
          }, 3000);
          
          return updatedTransactions;
        });
        
      } else {
        const error = await response.json();
        console.error('❌ Failed to apply tag override:', error.error);
      }
    } catch (error) {
      console.error('❌ Tag override error:', error);
    }
  };

  // Fetch starred status for transactions
  async function fetchTransactionStarredStatus(transactionIds: string[]) {
    if (transactionIds.length === 0) return;
    
    console.log('🌟 Fetching starred status for transactions:', transactionIds.length);
    
    try {
      const response = await fetch('/api/transaction-starred-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction_ids: transactionIds })
      });
      
      const data = await response.json();
      console.log('🌟 Starred status API response:', data);
      
      if (data.success && data.starred_status) {
        const statusMap = new Map<string, boolean>();
        Object.entries(data.starred_status).forEach(([txId, isStarred]) => {
          statusMap.set(txId, isStarred as boolean);
        });
        console.log('🌟 Setting starred status map:', statusMap);
        setTransactionStarredStatus(statusMap);
      } else {
        console.error('🌟 Failed to get starred status:', data);
      }
    } catch (error) {
      console.error('Error fetching transaction starred status:', error);
    }
  }

  // Fetch tagged merchants (still needed for starring new merchants)
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
      // Find a recent transaction for this merchant to estimate amount
      const merchantTransactions = transactions.filter(tx => 
        (tx.merchant_name && tx.merchant_name.toLowerCase() === merchantName.toLowerCase()) ||
        (tx.name && tx.name.toLowerCase() === merchantName.toLowerCase())
      );
      
      // Use most recent transaction amount as default, or fallback to $50
      const estimatedAmount = merchantTransactions.length > 0 
        ? Math.abs(merchantTransactions[0].amount)
        : 50;

      const response = await fetch('/api/tagged-merchants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          merchant_name: merchantName,
          expected_amount: estimatedAmount,
          prediction_frequency: 'monthly', // Default to monthly
          confidence_score: 75,
          auto_detected: false
        })
      });

      const data = await response.json();
      
      if (data.success) {
        await fetchTaggedMerchants();
        // Refresh starred status for current transactions
        const transactionIds = transactions.map(tx => tx.plaid_transaction_id).filter((id): id is string => Boolean(id));
        fetchTransactionStarredStatus(transactionIds);
      } else {
        alert('Failed to star merchant: ' + data.error);
      }
    } catch (error) {
      console.error('Error starring merchant:', error);
      alert('Error starring merchant');
    } finally {
      setStarringMerchant(null);
    }
  }, [transactions]);

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
            // Refresh starred status for current transactions
            const transactionIds = transactions.map(tx => tx.plaid_transaction_id).filter((id): id is string => Boolean(id));
            fetchTransactionStarredStatus(transactionIds);
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



  // OPTIMIZED: Simplified data fetching for faster loading
  async function fetchData() {
    try {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // SIMPLIFIED: Just fetch transactions - remove heavy analytics processing
      const transactionsResponse = await fetch('/api/plaid/transactions', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      
      const transactionsData = await transactionsResponse.json();
      
      if (transactionsResponse.ok && transactionsData.transactions) {
        console.log('Transactions fetched:', transactionsData.transactions.length);
        console.log('Accounts fetched:', transactionsData.accounts?.length || 0);
        
        // Store accounts data for account column mapping
        if (transactionsData.accounts) {
          setAccounts(transactionsData.accounts);
        }
        
        // SIMPLIFIED: Minimal processing for fast display
        const enhancedTransactions = transactionsData.transactions.map((transaction: Transaction) => ({
          ...transaction,
          id: transaction.id || transaction.plaid_transaction_id || Math.random().toString(),
        }));
        
        setTransactions(enhancedTransactions);
        
        // Fetch starred status for loaded transactions
        const transactionIds = enhancedTransactions.map((tx: { plaid_transaction_id?: string }) => tx.plaid_transaction_id).filter((id: string | undefined): id is string => Boolean(id));
        fetchTransactionStarredStatus(transactionIds);
        
        // Fetch tagged merchants in parallel (still needed for starring new merchants)
        fetchTaggedMerchants();
        
      } else {
        console.error('Failed to fetch transactions:', transactionsData);
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
      header: 'Track Bill',
      cell: ({ row }: { row: { original: TransactionWithAnalytics } }) => {
        const transaction = row.original;
        const merchantName = transaction.merchant_name || transaction.name;
        const transactionId = transaction.plaid_transaction_id;
        const isTagged = transactionId ? (transactionStarredStatus.get(transactionId) || false) : false;
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
      enableSorting: true,
      sortingFn: (rowA: { original: TransactionWithAnalytics }, rowB: { original: TransactionWithAnalytics }) => {
        const aId = rowA.original.plaid_transaction_id;
        const bId = rowB.original.plaid_transaction_id;
        const aStar = aId ? (transactionStarredStatus.get(aId) || false) : false;
        const bStar = bId ? (transactionStarredStatus.get(bId) || false) : false;
        return Number(bStar) - Number(aStar);
      },
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
      accessorKey: 'ai_merchant_name',
      header: 'Merchant',
      cell: ({ getValue, row }: { getValue: () => string | undefined; row: { original: Transaction } }) => {
        const aiMerchant = getValue();
        const transaction = row.original;
        const merchantName = aiMerchant || transaction.merchant_name || transaction.name;
        const firstLetter = merchantName.charAt(0).toUpperCase();
        const colorClass = getMerchantColor(merchantName);
        
        return (
          <div className="flex items-center gap-2">
            {/* Logo or colored placeholder */}
            <div className="flex-shrink-0">
              {transaction.logo_url ? (
                <div className="relative">
                  <img 
                    src={transaction.logo_url} 
                    alt="Logo" 
                    className="w-8 h-8 rounded-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      const placeholder = (e.target as HTMLImageElement).nextElementSibling as HTMLDivElement;
                      if (placeholder) {
                        placeholder.style.display = 'flex';
                      }
                    }}
                  />
                  <div 
                    className={`w-8 h-8 rounded-full ${colorClass} flex items-center justify-center text-white text-sm font-bold hidden`}
                  >
                    {firstLetter}
                  </div>
                </div>
              ) : (
                <div 
                  className={`w-8 h-8 rounded-full ${colorClass} flex items-center justify-center text-white text-sm font-bold`}
                >
                  {firstLetter}
                </div>
              )}
            </div>
            
            {/* Merchant name with hover pencil and click-to-filter */}
            <div className="flex items-center gap-2 group">
              <button
                onClick={() => setMerchantFilter(merchantName)}
                className="text-sm font-medium text-left hover:underline"
                title="Click to filter by this merchant"
              >
                {merchantName}
              </button>
              <button
                onClick={() => handleEditTags(transaction)}
                className="opacity-0 group-hover:opacity-100 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded hover:bg-purple-200 transition-opacity"
                title="Edit AI tags"
              >
                ✎
              </button>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'amount',
      header: 'Amount',
      cell: ({ getValue }: { getValue: () => number }) => {
        const amount = getValue();
        return (
          <span className={`font-medium text-left ${amount > 0 ? 'text-red-600' : 'text-green-600'}`}>
            ${Math.abs(amount).toFixed(2)}
          </span>
        );
      },
    },
    {
      accessorKey: 'name',
      header: 'Description',
      cell: ({ getValue }: { getValue: () => string }) => (
        <div className="font-medium max-w-[200px] truncate text-left">
          {getValue()}
        </div>
      ),
    },
    {
      accessorKey: 'ai_category_tag',
      header: 'Category',
      cell: ({ getValue, row }: { getValue: () => string | undefined; row: { original: Transaction } }) => {
        const aiCategory = getValue();
        const transaction = row.original;
        return (
          <div className="flex items-center gap-2 group">
            {aiCategory ? (
              <button
                onClick={() => setCategoryFilter(aiCategory)}
                className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-medium hover:bg-green-200 transition-colors text-left"
                title="Click to filter by this category"
              >
                {aiCategory}
              </button>
            ) : (
              <span className="text-gray-400 text-xs">Not tagged</span>
            )}
            <button
              onClick={() => handleEditTags(transaction)}
              className="opacity-0 group-hover:opacity-100 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded hover:bg-purple-200 transition-opacity"
              title="Edit AI tags"
            >
              ✎
            </button>
          </div>
        );
      },
    },
    {
      accessorKey: 'subcategory',
      header: 'Subcategory',
      cell: ({ getValue }: { getValue: () => string | undefined }) => {
        const subcategory = getValue();
        return subcategory ? (
          <button
            onClick={() => setSubcategoryFilter(subcategory)}
            className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded text-left hover:bg-blue-200"
            title="Click to filter by this subcategory"
          >
            {subcategory}
          </button>
        ) : (
          <span className="text-gray-400 text-left">-</span>
        );
      },
    },
    {
      accessorKey: 'pending',
      header: 'Status',
      cell: ({ getValue }: { getValue: () => boolean }) => (
        <span className={`px-2 py-1 rounded text-xs text-left ${getValue() ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
          {getValue() ? 'Pending' : 'Posted'}
        </span>
      ),
    },
    {
      accessorKey: 'account_id',
      header: 'Account',
      cell: ({ getValue }: { getValue: () => string }) => {
        const accountId = getValue();
        
        if (!accountId) {
          return (
            <div className="flex items-center gap-2">
              <div className="text-sm text-gray-400 text-left">No account ID</div>
            </div>
          );
        }
        
        const accountInfo = getAccountInfo(accountId);
        
        return (
          <div className="flex items-center gap-2">
            <div className="flex-shrink-0">
              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="text-xs font-medium text-blue-700 text-left">
                  {accountInfo.type?.charAt(0).toUpperCase() || '?'}
                </span>
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium truncate text-left">
                {accountInfo.name}
              </div>
              <div className="text-xs text-gray-500 text-left">
                {accountInfo.subtype ? accountInfo.subtype.charAt(0).toUpperCase() + accountInfo.subtype.slice(1) : accountInfo.type}
              </div>
            </div>
          </div>
        );
      },
      size: 150,
      enableSorting: true,
    },
  ], [transactionStarredStatus, starringMerchant, handleStarMerchant, handleUnstarMerchant]);

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
        pageSize: 50, // OPTIMIZED: Reduced from 1000 to 50 for faster loading
      },
    },
  });

  if (isLoading) {
    return (
      <div className="relative min-h-[600px]">
        <ContentAreaLoader />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <h1 className="text-2xl font-medium text-left">💳 Transactions</h1>
            <div className="flex items-center gap-6 mt-2">
              <p className="text-muted-foreground text-left">
                {transactions.length} total transactions
              </p>
              <a 
                href="/protected" 
                className="text-sm text-blue-600 hover:text-blue-700 hover:underline text-left"
              >
                View account balances →
              </a>
            </div>
          </div>
          {/* Removed refresh buttons as requested */}
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
                        className={`border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted ${
                          highlightedTransactions.has(row.original.id) 
                            ? 'bg-green-50 border-green-200 shadow-md ring-2 ring-green-300 ring-opacity-50' 
                            : ''
                        }`}
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
                      <td colSpan={columns.length} className="h-24 text-left text-muted-foreground">
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
            <div className="text-sm text-muted-foreground text-left">
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
              <div className="text-sm text-muted-foreground text-left">
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

      {/* AI Tag Editor Modal */}
      {editingTransaction && (
        <AITagEditor
          isOpen={tagEditorOpen}
          onClose={() => {
            setTagEditorOpen(false);
            setEditingTransaction(null);
          }}
          onSave={handleSaveTagOverride}
          initialData={editingTransaction}
        />
      )}
    </div>
  );
} 