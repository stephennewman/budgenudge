'use client';

import { useState, useEffect, useCallback } from 'react';
import { createSupabaseClient } from '@/utils/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ContentAreaLoader } from '@/components/ui/content-area-loader';

interface IncomeSource {
  id?: string;
  source_name: string;
  frequency: 'weekly' | 'bi-weekly' | 'bi-monthly' | 'monthly' | 'irregular';
  expected_amount: number;
  confidence_score: number;
  next_predicted_date?: string;
  last_pay_date?: string;
  account_id: string;
  pattern?: string;
  dates?: string[];
  amounts?: number[];
  intervals?: number[];
  transaction_count?: number;
}

interface IncomeTransaction {
  id: string;
  date: string;
  amount: number;
  name: string;
  merchant_name?: string;
  account_id: string;
}

// PayCycleSubscription interface temporarily unused - subscription feature disabled
// interface PayCycleSubscription {
//   frequency: 'weekly' | 'bi-weekly' | 'monthly';
//   amount: number;
//   yearly_total: number;
//   description: string;
//   savings_vs_monthly: number;
// }

export default function IncomePage() {
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [incomeData, setIncomeData] = useState<IncomeSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);
  
  // Transaction history and editing state
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const [sourceTransactions, setSourceTransactions] = useState<{[key: string]: IncomeTransaction[]}>({});
  const [loadingTransactions, setLoadingTransactions] = useState<{[key: string]: boolean}>({});
  // Removed unused state variables transactionCounts and loadingCounts
  const [editingSource, setEditingSource] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    source_name: '',
    expected_amount: '',
    frequency: '',
    next_predicted_date: '',
    is_active: true
  });
  const [excludedSources, setExcludedSources] = useState<Set<string>>(new Set());
  const [selectedForMerge, setSelectedForMerge] = useState<Set<string>>(new Set());
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  
  const supabase = createSupabaseClient();

  const loadIncomeData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      setUser(user);
      
      // Check if we have existing income analysis
      const { data: existingAnalysis } = await supabase
        .from('user_income_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (existingAnalysis?.profile_data?.income_sources) {
        console.log('Loading existing income data:', existingAnalysis.profile_data.income_sources);
        // Map existing data to ensure consistent format
        const mappedExisting = existingAnalysis.profile_data.income_sources.map((source: { id?: string; source_name?: string; frequency?: string; pattern_type?: string; expected_amount?: number; amount?: number; confidence_score?: number; next_predicted_date?: string; last_pay_date?: string; account_id?: string; pattern?: string; dates?: string[]; amounts?: number[]; intervals?: number[] }) => {
          const mapped = {
            id: source.id || `source_${source.source_name?.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
            source_name: source.source_name || 'Unknown Source',
            frequency: source.frequency || source.pattern_type || 'irregular',
            expected_amount: source.expected_amount || source.amount || 0,
            confidence_score: source.confidence_score || 0,
            next_predicted_date: source.next_predicted_date || null,
            last_pay_date: source.last_pay_date || null,
            account_id: source.account_id || '',
            pattern: source.pattern || null,
            dates: source.dates || [],
            amounts: source.amounts || [],
            intervals: source.intervals || [],
            transaction_count: source.amounts?.length || source.dates?.length || 0
          };
          console.log(`📋 Loading source "${mapped.source_name}":`, {
            id: mapped.id,
            next_predicted_date: mapped.next_predicted_date,
            last_pay_date: mapped.last_pay_date,
            expected_amount: mapped.expected_amount,
            frequency: mapped.frequency,
            amounts: mapped.amounts
          });
          return mapped;
        });
        
        // Check if existing data is valid (merged sources may have different confidence patterns)
        const hasValidData = mappedExisting.some((source: IncomeSource) => 
          source.expected_amount > 0 && (source.confidence_score > 0 || source.source_name.includes('merged') || source.source_name.includes('Combined'))
        );
        
        if (hasValidData) {
          setIncomeData(mappedExisting);
          // generateSubscriptionOptions and preloadTransactionCounts will be called separately
        } else {
          console.log('Existing data is invalid, running fresh analysis...');
          // runIncomeAnalysis will be called separately
        }
      } else {
        // Run income detection analysis - will be triggered separately
      }
    } catch (error) {
      console.error('Error loading income data:', error);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadIncomeData();
    
    // Check for success/cancel URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success') === 'true') {
      setShowSuccess(true);
      // Clear URL parameters
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (urlParams.get('cancelled') === 'true') {
      setShowCancelled(true);
      // Clear URL parameters
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [loadIncomeData]);

  // Function to preserve manual edits when refreshing analysis
  // Function to fetch transaction count - temporarily disabled
  // const fetchTransactionCount = useCallback(async (sourceId: string, source: IncomeSource) => {
  //   if (!user) return;
  //   
  //   setLoadingCounts(prev => ({ ...prev, [sourceId]: true }));
  //   
  //   try {
  //     const { data: { session } } = await supabase.auth.getSession();
  //     if (!session?.access_token) return;

  //     const response = await fetch('/api/income-source-transactions', {
  //       method: 'POST',
  //       headers: { 
  //         'Content-Type': 'application/json',
  //         'Authorization': `Bearer ${session.access_token}`
  //       },
  //       body: JSON.stringify({
  //         userId: user.id,
  //         pattern: source.pattern || source.source_name,
  //         dates: source.dates || [],
  //         amounts: source.amounts || []
  //       })
  //     });

  //     const result = await response.json();
  //     console.log(`🔢 Count fetch result for ${sourceId}:`, result);
  //     if (result.success && result.transactions) {
  //       console.log(`✅ Setting count for ${sourceId}: ${result.transactions.length}`);
  //       setTransactionCounts(prev => ({
  //         ...prev,
  //         [sourceId]: result.transactions.length
  //       }));
  //     }
  //   } catch (error) {
  //     console.error('Error fetching transaction count:', error);
  //   } finally {
  //     setLoadingCounts(prev => ({ ...prev, [sourceId]: false }));
  //   }
  // }, [user, supabase]);

  // Function to pre-load transaction counts - temporarily disabled
  // const preloadTransactionCounts = useCallback((sources: IncomeSource[]) => {
  //   console.log('🔄 Preloading transaction counts for sources:', sources.length);
  //   sources.forEach((source, index) => {
  //     const sourceId = source.id || `source_${index}`;
  //     const hasInlineData = source.dates && source.amounts && source.dates.length > 0;
  //     
  //     console.log(`🔍 Checking source "${source.source_name}":`, {
  //       sourceId,
  //       hasInlineData,
  //       transaction_count: source.transaction_count,
  //       will_fetch: !hasInlineData && source.transaction_count === 0
  //     });
  //     
  //     // Only fetch count for sources without inline transaction data
  //     if (!hasInlineData && source.transaction_count === 0) {
  //       console.log(`📡 Fetching count for: ${source.source_name}`);
  //       fetchTransactionCount(sourceId, source);
  //     }
  //   });
  // }, [fetchTransactionCount]);

  // Manual edits preservation - temporarily simplified
  // const preserveManualEdits = useCallback((newPatterns: IncomeSource[], existingData: IncomeSource[]) => {
  //   const result: IncomeSource[] = [];
  //   
  //   // Create a map of existing data for easy lookup
  //   const existingMap = new Map<string, IncomeSource>();
  //   existingData.forEach(source => {
  //     if (source.id) {
  //       existingMap.set(source.id, source);
  //     }
  //   });
  //   
  //   // For each new pattern, check if we have an existing version with edits
  //   newPatterns.forEach(newPattern => {
  //     const matchingExisting = Array.from(existingMap.values()).find(existing => {
  //       // Match by source name (normalized) or pattern
  //       const newNameNorm = newPattern.source_name.toLowerCase().trim();
  //       const existingNameNorm = existing.source_name.toLowerCase().trim();
  //       return newNameNorm === existingNameNorm || 
  //              newPattern.pattern === existing.pattern;
  //     });
  //     
  //     if (matchingExisting) {
  //       // Preserve existing data but update transaction-related fields from fresh analysis
  //       result.push({
  //         ...matchingExisting, // Keep manual edits
  //         dates: newPattern.dates, // Update with fresh transaction data
  //         amounts: newPattern.amounts, // Update with fresh transaction data
  //         transaction_count: newPattern.dates?.length || newPattern.amounts?.length || 0,
  //         intervals: newPattern.intervals,
  //         last_pay_date: newPattern.last_pay_date, // Update latest transaction date
  //       });
  //       existingMap.delete(matchingExisting.id!); // Remove from map so we don't duplicate
  //     } else {
  //       // New pattern, add as-is
  //       result.push(newPattern);
  //     }
  //   });
  //   
  //   // Add any existing sources that didn't match new patterns (e.g., merged sources)
  //   existingMap.forEach(remaining => {
  //     result.push(remaining);
  //   });
  //   
  //   return result;
  // }, []);

  const runIncomeAnalysis = useCallback(async (userId: string) => {
    setAnalyzing(true);
    
    try {
      const response = await fetch('/api/income-detection/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, lookback_months: 6 })
      });

      const result = await response.json();
      console.log('Income detection result:', result); // Debug logging
      
      if (result.success && result.result?.patterns_detected?.length > 0) {
        // Map the API response to our UI format
        const mappedPatterns = result.result.patterns_detected.map((pattern: { source_name?: string; pattern?: string; frequency?: string; expected_amount?: number; confidence_score?: number; next_predicted_date?: string; account_id?: string; dates?: string[]; amounts?: number[]; intervals?: number[] }) => ({
          id: `pattern_${(pattern.source_name || pattern.pattern || 'unknown').toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
          source_name: pattern.source_name || pattern.pattern || 'Unknown Source',
          frequency: pattern.frequency || 'irregular',
          expected_amount: pattern.expected_amount || 0,
          confidence_score: pattern.confidence_score || 0,
          next_predicted_date: pattern.next_predicted_date || null,
          last_pay_date: pattern.dates?.[pattern.dates.length - 1] || null,
          account_id: pattern.account_id || '',
          pattern: pattern.pattern,
          dates: pattern.dates || [],
          amounts: pattern.amounts || [],
          intervals: pattern.intervals || []
        }));
        
        // Preserve manual edits: merge new patterns with existing edited sources  
        const preservedData = mappedPatterns; // Simplified for now
        setIncomeData(preservedData);
        // generateSubscriptionOptions and preloadTransactionCounts will be called separately
      } else {
        console.log('No income patterns detected or API error:', result);
      }
    } catch (error) {
      console.error('Error analyzing income:', error);
    } finally {
      setAnalyzing(false);
    }
  }, []);

  const generateSubscriptionOptions = useCallback((sources: IncomeSource[]) => {
    // Subscription generation temporarily disabled - Stripe not configured yet
    console.log('Subscription options would be generated for:', sources.length, 'sources');
    // This will be re-enabled when Stripe is configured
    // For now, this is a no-op function
  }, []);

  const formatCurrency = (amount: number) => {
    // Handle NaN, null, undefined, or invalid numbers
    if (!amount || isNaN(amount) || amount === 0) {
      return '$0.00';
    }
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(Math.abs(amount)); // Use absolute value for display
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Function to calculate upcoming income dates
  const calculateUpcomingIncomes = (sources: IncomeSource[], monthsAhead = 3) => {
    const upcomingIncomes: { date: Date; source: IncomeSource; amount: number }[] = [];
    const today = new Date();
    const endDate = new Date(today);
    endDate.setMonth(endDate.getMonth() + monthsAhead);

    sources.forEach(source => {
      // Skip irregular frequency sources
      if (source.frequency === 'irregular') return;

      // Get the most recent date to calculate from
      let lastDate = source.last_pay_date;
      if (!lastDate && source.dates && source.dates.length > 0) {
        // Use most recent transaction date if last_pay_date is missing
        lastDate = source.dates[source.dates.length - 1];
      }
      
      // If still no date, estimate based on frequency with realistic scheduling
      if (!lastDate) {
        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        const currentDate = today.getDate();
        
        switch (source.frequency) {
          case 'weekly':
            // Assume last Friday
            const lastFriday = new Date(today);
            lastFriday.setDate(today.getDate() - ((today.getDay() + 2) % 7));
            lastDate = lastFriday.toISOString().split('T')[0];
            break;
          case 'bi-weekly':
            // Assume every other Friday
            const friday = new Date(today);
            friday.setDate(today.getDate() - ((today.getDay() + 2) % 7));
            lastDate = friday.toISOString().split('T')[0];
            break;
          case 'bi-monthly':
            // Assume 15th and last day of month - find the most recent one
            let lastPayDate;
            if (currentDate >= 15) {
              // If today is after 15th, assume last payment was on 15th of this month
              lastPayDate = new Date(currentYear, currentMonth, 15);
            } else {
              // If today is before 15th, assume last payment was last day of previous month
              lastPayDate = new Date(currentYear, currentMonth, 0); // 0 gives last day of previous month
            }
            lastDate = lastPayDate.toISOString().split('T')[0];
            break;
          case 'monthly':
            // Assume 1st of current month, or last month if we're early in the month
            const monthlyDate = currentDate >= 15 ? 
              new Date(currentYear, currentMonth, 1) : 
              new Date(currentYear, currentMonth - 1, 1);
            lastDate = monthlyDate.toISOString().split('T')[0];
            break;
        }
      }
      
      console.log(`🔍 Calendar check for "${source.source_name}":`, {
        frequency: source.frequency,
        last_pay_date: source.last_pay_date,
        calculated_last_date: lastDate,
        will_include: !!lastDate
      });

      if (!lastDate) return; // Skip if we can't determine a start date

      // Prioritize manual override first, then fall back to calculated date
      let nextDate;
      let isManualOverride = false;
      if (source.next_predicted_date && new Date(source.next_predicted_date) >= today) {
        // Use manual override if it's in the future
        nextDate = new Date(source.next_predicted_date);
        isManualOverride = true;
        console.log(`📅 Using manual override for "${source.source_name}": ${source.next_predicted_date}`);
      } else {
        // Calculate from last payment if no valid override
        nextDate = new Date(lastDate);
        
        // For bi-weekly, ensure we land on the same day of week as the last payment
        if (source.frequency === 'bi-weekly') {
          const lastPaymentDate = new Date(lastDate);
          const dayOfWeek = lastPaymentDate.getDay(); // 0=Sunday, 5=Friday
          
          // Calculate how many days to add to get to today or future
          while (nextDate <= today) {
            nextDate.setDate(nextDate.getDate() + 14);
          }
          
          // Only adjust day of week if there's no manual override
          if (!isManualOverride) {
            // Ensure we're on the same day of week as original payments
            const currentDayOfWeek = nextDate.getDay();
            if (currentDayOfWeek !== dayOfWeek) {
              const daysToAdd = (dayOfWeek - currentDayOfWeek + 7) % 7;
              nextDate.setDate(nextDate.getDate() + daysToAdd);
            }
          }
        } else {
          // For other frequencies, just move forward to future
          while (nextDate <= today) {
            switch (source.frequency) {
              case 'weekly': nextDate.setDate(nextDate.getDate() + 7); break;
              case 'monthly': nextDate.setMonth(nextDate.getMonth() + 1); break;
              default: nextDate.setDate(nextDate.getDate() + 14); break;
            }
          }
        }
        console.log(`🔄 Calculated next date for "${source.source_name}": ${nextDate.toISOString().split('T')[0]}`);
      }

      // Calculate next payment dates based on frequency
      if (source.frequency === 'bi-monthly') {
        // Special handling for bi-monthly (15th and last day of month)
        // Start from nextDate (which could be manual override or calculated)
        let currentPayDate = new Date(nextDate);
        
        // If we're using a manual override, start from there; otherwise determine pattern
        if (!source.next_predicted_date || new Date(source.next_predicted_date) < today) {
          // No manual override or it's in the past - determine pattern from last payment
          const lastPayDate = new Date(lastDate);
          const lastDay = lastPayDate.getDate();
          
          if (lastDay <= 16) {
            // Last payment was around 15th, next payment is end of this month
            currentPayDate = new Date(lastPayDate.getFullYear(), lastPayDate.getMonth() + 1, 0);
          } else {
            // Last payment was end of month, next payment is 15th of next month
            currentPayDate = new Date(lastPayDate.getFullYear(), lastPayDate.getMonth() + 1, 15);
          }
          
          // Move forward if still in the past
          while (currentPayDate <= today) {
            const currentDay = currentPayDate.getDate();
            if (currentDay <= 16) {
              currentPayDate = new Date(currentPayDate.getFullYear(), currentPayDate.getMonth() + 1, 0);
            } else {
              currentPayDate = new Date(currentPayDate.getFullYear(), currentPayDate.getMonth() + 1, 15);
            }
          }
        }
        
        // Now generate future payments from currentPayDate
        nextDate = new Date(currentPayDate);
        
        // Generate subsequent bi-monthly payments
        while (nextDate <= endDate) {
          if (nextDate >= today) {
            upcomingIncomes.push({
              date: new Date(nextDate),
              source: source,
              amount: source.expected_amount
            });
          }
          
          // Alternate between 15th and end of month
          const currentDay = nextDate.getDate();
          if (currentDay <= 16) {
            // Current is 15th, next is end of month
            nextDate = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0);
          } else {
            // Current is end of month, next is 15th of next month  
            nextDate = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 15);
          }
        }
      } else {
        // Handle other frequencies (weekly, bi-weekly, monthly)
        if (source.frequency === 'bi-weekly') {
          // For bi-weekly, add exactly 14 days regardless of day of week
          // (especially important when using manual overrides)
          while (nextDate <= endDate) {
            if (nextDate >= today) {
              upcomingIncomes.push({
                date: new Date(nextDate),
                source: source,
                amount: source.expected_amount
              });
            }
            // Add exactly 14 days - no day-of-week adjustment needed for manual overrides
            nextDate.setDate(nextDate.getDate() + 14);
          }
        } else {
          // Calculate interval days for weekly and monthly
          let intervalDays = 30; // default monthly
          switch (source.frequency) {
            case 'weekly':
              intervalDays = 7;
              break;
            case 'monthly':
              intervalDays = 30;
              break;
          }

          // Generate upcoming dates
          while (nextDate <= endDate) {
            if (nextDate >= today) {
              upcomingIncomes.push({
                date: new Date(nextDate),
                source: source,
                amount: source.expected_amount
              });
            }
            nextDate.setDate(nextDate.getDate() + intervalDays);
          }
        }
      } // end else block
    });

    return upcomingIncomes.sort((a, b) => a.date.getTime() - b.date.getTime());
  };

  const getFrequencyColor = (frequency: string) => {
    switch (frequency) {
      case 'weekly': return 'bg-green-100 text-green-800';
      case 'bi-weekly': return 'bg-blue-100 text-blue-800';
      case 'bi-monthly': return 'bg-purple-100 text-purple-800';
      case 'monthly': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Subscription functionality temporarily disabled - will be re-enabled when Stripe is configured
  // const handleSubscriptionSelect = async (option: PayCycleSubscription) => { ... };

  const debugIncomeAnalysis = async () => {
    if (!user) return;
    
    try {
      const response = await fetch('/api/debug-income-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      
      const result = await response.json();
      console.log('🔍 Income Analysis Debug:', result);
      alert('Debug results logged to console. Check developer tools.');
    } catch (error) {
      console.error('Debug error:', error);
    }
  };

  const toggleSourceExpansion = async (sourceId: string, source: IncomeSource) => {
    const newExpanded = new Set(expandedSources);
    
    if (expandedSources.has(sourceId)) {
      newExpanded.delete(sourceId);
    } else {
      newExpanded.add(sourceId);
      // Fetch transactions if we don't have inline data and haven't fetched yet
      const hasInlineData = source.dates && source.amounts && source.dates.length > 0;
      if (!hasInlineData && !sourceTransactions[sourceId] && !loadingTransactions[sourceId]) {
        await fetchSourceTransactions(sourceId, source);
      }
    }
    
    setExpandedSources(newExpanded);
  };

  const fetchSourceTransactions = async (sourceId: string, source: IncomeSource) => {
    if (!user) return;
    
    setLoadingTransactions(prev => ({ ...prev, [sourceId]: true }));
    
    try {
      // Create a query to find transactions matching this income source pattern
      console.log(`🔄 Fetching transactions for source: ${source.source_name} (ID: ${sourceId})`);
      console.log(`📡 Calling API for pattern: "${source.pattern || source.source_name}"`);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No authentication token available');
      }

      const response = await fetch('/api/income-source-transactions', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          userId: user.id,
          pattern: source.pattern || source.source_name,
          dates: source.dates || [],
          amounts: source.amounts || []
        })
      });

      const result = await response.json();
      console.log(`✅ API response for ${source.source_name}:`, result);
      
      if (result.success) {
        setSourceTransactions(prev => ({ ...prev, [sourceId]: result.transactions || [] }));
        console.log(`💾 Stored ${result.transactions?.length || 0} transactions for ${sourceId}`);
        
        // Update the transaction count in the income data
        if (result.transactions?.length > 0) {
          setIncomeData(prev => prev.map(source => 
            source.id === sourceId 
              ? { ...source, transaction_count: result.transactions.length }
              : source
          ));
        }
      }
    } catch (error) {
      console.error('Error fetching source transactions:', error);
      setSourceTransactions(prev => ({ ...prev, [sourceId]: [] }));
    } finally {
      setLoadingTransactions(prev => ({ ...prev, [sourceId]: false }));
    }
  };

  const handleEditSource = (source: IncomeSource) => {
    setEditingSource(source.id || '');
    setEditForm({
      source_name: source.source_name,
      expected_amount: source.expected_amount.toString(),
      frequency: source.frequency,
      next_predicted_date: source.next_predicted_date || '',
      is_active: true
    });
  };

  const handleSaveEdit = async () => {
    if (!editingSource || !user) return;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No authentication token available');
      }



      console.log('💾 Saving edit for source:', editingSource, 'with data:', editForm);
      
      const response = await fetch('/api/update-income-source', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          sourceId: editingSource,
          updatedSource: editForm
        })
      });

      const result = await response.json();
      console.log('💾 API response:', result);

      if (result.success) {
        console.log('✅ Update successful, updating local state...');
        // Update local state with the new data
        setIncomeData(prev => prev.map(source => {
          const sourceId = source.id || `source_${prev.indexOf(source)}`;
          if (sourceId === editingSource) {
            const updatedSource: IncomeSource = {
              ...source,
              source_name: editForm.source_name,
              expected_amount: parseFloat(editForm.expected_amount),
              frequency: editForm.frequency as 'weekly' | 'bi-weekly' | 'bi-monthly' | 'monthly' | 'irregular',
              next_predicted_date: editForm.next_predicted_date || undefined
            };
            console.log('🔄 Updated source locally:', updatedSource);
            return updatedSource;
          }
          return source;
        }));

        setEditingSource(null);
        
        // Force a reload to make sure we have the latest data
        console.log('🔄 Reloading data to confirm changes...');
        setTimeout(() => {
          loadIncomeData();
        }, 1000);
      } else {
        throw new Error(result.error || 'Failed to update income source');
      }
    } catch (error) {
      console.error('Error saving income source edit:', error);
      alert('Failed to save changes. Please try again.');
    }
  };

  const handleCancelEdit = () => {
    setEditingSource(null);
    setEditForm({
      source_name: '',
      expected_amount: '',
      frequency: '',
      next_predicted_date: '',
      is_active: true
    });
  };

  const handleExcludeSource = (sourceId: string) => {
    const newExcluded = new Set(excludedSources);
    if (excludedSources.has(sourceId)) {
      newExcluded.delete(sourceId);
    } else {
      newExcluded.add(sourceId);
    }
    setExcludedSources(newExcluded);
    
    // Regenerate subscription options with updated exclusions
    setTimeout(() => {
      generateSubscriptionOptions(incomeData);
    }, 100);
  };

  const handleSelectForMerge = (sourceId: string) => {
    const newSelected = new Set(selectedForMerge);
    if (selectedForMerge.has(sourceId)) {
      newSelected.delete(sourceId);
    } else {
      newSelected.add(sourceId);
    }
    setSelectedForMerge(newSelected);
  };

  const initiateMerge = () => {
    if (selectedForMerge.size >= 2) {
      setShowMergeDialog(true);
    }
  };

  const executeMerge = async (newSourceName: string) => {
    if (selectedForMerge.size < 2) return;

    const selectedSources = incomeData.filter((source, index) => {
      const sourceId = source.id || `source_${index}`;
      return selectedForMerge.has(sourceId);
    });

    console.log('Selected sources for merge:', selectedSources.map(s => ({
      name: s.source_name,
      amounts: s.amounts?.length || 0,
      dates: s.dates?.length || 0,
      intervals: s.intervals?.length || 0,
      frequency: s.frequency,
      confidence: s.confidence_score
    })));

    // Create merged source by combining data
    const mergedSource: IncomeSource = {
      id: `merged_${Date.now()}`,
      source_name: newSourceName,
      frequency: 'irregular', // Will recalculate below
      expected_amount: 0, // Will calculate below
      confidence_score: 0, // Will calculate below
      next_predicted_date: undefined, // Will calculate below
      last_pay_date: undefined, // Will calculate below
      account_id: selectedSources[0].account_id,
      pattern: selectedSources.map(s => s.pattern).join(' + '),
      dates: [],
      amounts: [],
      intervals: []
    };

    // Combine all amounts and dates
    let allAmounts: number[] = [];
    let allDates: string[] = [];
    let allIntervals: number[] = [];

    selectedSources.forEach(source => {
      if (source.amounts) allAmounts = [...allAmounts, ...source.amounts];
      if (source.dates) allDates = [...allDates, ...source.dates];
      if (source.intervals) allIntervals = [...allIntervals, ...source.intervals];
    });

    // Sort dates and calculate merged metrics
    allDates.sort();
    allAmounts = allAmounts.filter(amt => amt > 0);

    mergedSource.dates = allDates;
    mergedSource.amounts = allAmounts;
    mergedSource.intervals = allIntervals;

    // Calculate expected amount - use detailed amounts if available, otherwise sum expected amounts
    if (allAmounts.length > 0) {
      mergedSource.expected_amount = allAmounts.reduce((sum, amt) => sum + amt, 0) / allAmounts.length;
    } else {
      // Fallback: sum the expected amounts from sources
      mergedSource.expected_amount = selectedSources.reduce((sum, s) => sum + (s.expected_amount || 0), 0);
    }
    
    // Calculate confidence as average of source confidences weighted by expected amount
    const totalExpectedAmount = selectedSources.reduce((sum, s) => sum + (s.expected_amount || 0), 0);
    if (totalExpectedAmount > 0) {
      mergedSource.confidence_score = Math.round(
        selectedSources.reduce((sum, s) => {
          const weight = (s.expected_amount || 0) / totalExpectedAmount;
          return sum + (s.confidence_score || 0) * weight;
        }, 0)
      );
    } else {
      // Simple average if no amounts
      mergedSource.confidence_score = Math.round(
        selectedSources.reduce((sum, s) => sum + (s.confidence_score || 0), 0) / selectedSources.length
      );
    }

    mergedSource.last_pay_date = allDates[allDates.length - 1] || selectedSources.find(s => s.last_pay_date)?.last_pay_date || undefined;

    // Calculate next predicted date based on frequency and last pay date
    if (mergedSource.last_pay_date && mergedSource.frequency !== 'irregular') {
      const lastDate = new Date(mergedSource.last_pay_date);
      const nextDate = new Date(lastDate);
      
      switch (mergedSource.frequency) {
        case 'weekly':
          nextDate.setDate(nextDate.getDate() + 7);
          break;
        case 'bi-weekly':
          nextDate.setDate(nextDate.getDate() + 14);
          break;
        case 'bi-monthly':
          // For bi-monthly, alternate between 15th and end of month
          const day = lastDate.getDate();
          if (day <= 16) {
            // Last was around 15th, next is end of month
            nextDate.setMonth(nextDate.getMonth() + 1, 0); // Set to last day of next month
          } else {
            // Last was end of month, next is 15th of next month
            nextDate.setMonth(nextDate.getMonth() + 1, 15);
          }
          break;
        case 'monthly':
          nextDate.setMonth(nextDate.getMonth() + 1);
          break;
      }
      
      mergedSource.next_predicted_date = nextDate.toISOString().split('T')[0];
    }

    // Preserve transaction count from original sources
    const totalTransactionCount = selectedSources.reduce((sum, s) => sum + (s.dates?.length || s.transaction_count || 0), 0);
    mergedSource.transaction_count = totalTransactionCount;

    // Determine best frequency from sources (prefer non-irregular)
    const frequencies = selectedSources.map(s => s.frequency).filter(f => f && f !== 'irregular');
    if (frequencies.length > 0) {
      // Use the most common non-irregular frequency
      const frequencyCount = frequencies.reduce((acc, freq) => {
        acc[freq] = (acc[freq] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      mergedSource.frequency = Object.entries(frequencyCount).sort(([,a], [,b]) => b - a)[0][0] as 'weekly' | 'bi-weekly' | 'bi-monthly' | 'monthly' | 'irregular';
    } else if (allIntervals.length > 0) {
      // Recalculate frequency based on combined intervals
      const avgInterval = allIntervals.reduce((sum, interval) => sum + interval, 0) / allIntervals.length;
      
      if (avgInterval >= 6 && avgInterval <= 8) {
        mergedSource.frequency = 'weekly';
      } else if (avgInterval >= 13 && avgInterval <= 15) {
        mergedSource.frequency = 'bi-weekly';
      } else if (avgInterval >= 28 && avgInterval <= 32) {
        mergedSource.frequency = 'monthly';
      } else if (avgInterval >= 56 && avgInterval <= 64) {
        mergedSource.frequency = 'bi-monthly';
      } else {
        mergedSource.frequency = 'irregular';
      }
    } else {
      mergedSource.frequency = 'irregular';
    }

    // Get IDs of sources being removed
    const removedSourceIds = Array.from(selectedForMerge);

    try {
      // Get the user's session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No authentication token available');
      }

      // Save to database
      const response = await fetch('/api/merge-income-sources', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          mergedSource,
          removedSourceIds
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to save merge: ${errorData.error || response.statusText}${errorData.details ? ` - ${errorData.details}` : ''}`);
      }

      const result = await response.json();
      console.log('Merge saved successfully:', result);

      // Update UI
      const newIncomeData = incomeData.filter((source, index) => {
        const sourceId = source.id || `source_${index}`;
        return !selectedForMerge.has(sourceId);
      });
      newIncomeData.push(mergedSource);

      setIncomeData(newIncomeData);
      setSelectedForMerge(new Set());
      setShowMergeDialog(false);
      generateSubscriptionOptions(newIncomeData);

    } catch (error) {
      console.error('Error saving merge:', error);
      
      // Show more detailed error if available
      if (error instanceof Error) {
        alert(`Failed to save merged income sources: ${error.message}`);
      } else {
        alert('Failed to save merged income sources. Please try again.');
      }
    }
  };

  // Detect potential duplicate income sources
  const detectDuplicateSources = (sources: IncomeSource[]) => {
    const duplicates: string[] = [];
    
    for (let i = 0; i < sources.length; i++) {
      for (let j = i + 1; j < sources.length; j++) {
        const source1 = sources[i];
        const source2 = sources[j];
        
        // Check if amounts are similar (within 25% range)
        const amountDiff = Math.abs(source1.expected_amount - source2.expected_amount);
        const avgAmount = (source1.expected_amount + source2.expected_amount) / 2;
        const isAmountSimilar = avgAmount > 0 && (amountDiff / avgAmount) < 0.25;
        
        // Check if one might be manual deposit version of the other
        const isManualDeposit = (name: string) => 
          name.toLowerCase().includes('mobile') || 
          name.toLowerCase().includes('banking') ||
          name.toLowerCase().includes('deposit');
        
        const isDifferentDelivery = isManualDeposit(source1.source_name) !== isManualDeposit(source2.source_name);
        
        if (isAmountSimilar && isDifferentDelivery) {
          duplicates.push(`${source1.source_name} and ${source2.source_name} might be the same income source`);
        }
      }
    }
    
    return duplicates;
  };

  if (loading) {
    return (
      <div className="relative min-h-[600px]">
        <ContentAreaLoader />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Success Message */}
      {showSuccess && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="text-green-400 mr-3">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h3 className="text-green-800 font-medium">Pay-Cycle Subscription Created!</h3>
              <p className="text-green-700 text-sm">Your billing is now aligned with your paycheck schedule.</p>
            </div>
          </div>
        </div>
      )}

      {/* Cancelled Message */}
      {showCancelled && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="text-yellow-400 mr-3">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h3 className="text-yellow-800 font-medium">Subscription Setup Cancelled</h3>
              <p className="text-yellow-700 text-sm">You can try again anytime. We&apos;ll keep your income analysis ready.</p>
            </div>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex flex-col">
          <h1 className="text-2xl font-medium">💰 Income</h1>
          <p className="text-muted-foreground mt-2">
            {incomeData.length} income sources detected
          </p>
        </div>
        <Button
          onClick={() => {
            if (user) {
              runIncomeAnalysis(user.id);
            }
          }}
          disabled={analyzing}
          variant="outline"
        >
          {analyzing ? 'Analyzing...' : 'Refresh Data'}
        </Button>
      </div>

      {/* Duplicate Warning */}
      {incomeData.length > 1 && (() => {
        const duplicates = detectDuplicateSources(incomeData);
        return duplicates.length > 0 ? (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start">
              <div className="text-yellow-400 mr-3 mt-0.5">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="text-yellow-800 font-medium">Potential Duplicate Income Sources</h3>
                <div className="text-yellow-700 text-sm mt-1">
                  {duplicates.map((duplicate, index) => (
                    <div key={index}>• {duplicate}</div>
                  ))}
                </div>
                              <p className="text-yellow-700 text-sm mt-2">
                Consider excluding one source or editing the names to clarify if they&apos;re the same income.
              </p>
              </div>
            </div>
          </div>
        ) : null;
      })()}

      {/* Income Sources Analysis */}
      <Card className="p-6 mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold flex items-center">
            {analyzing && <span className="ml-2 text-sm text-blue-600">Analyzing...</span>}
          </h2>
          
          {/* Merge Controls */}
          {selectedForMerge.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">
                {selectedForMerge.size} sources selected
              </span>
              {selectedForMerge.size >= 2 && (
                <Button 
                  onClick={initiateMerge}
                  className="bg-blue-600 hover:bg-blue-700 text-sm py-1 px-3"
                >
                  Merge Sources
                </Button>
              )}
              <Button 
                onClick={() => setSelectedForMerge(new Set())}
                variant="outline"
                className="text-sm py-1 px-3"
              >
                Clear
              </Button>
            </div>
          )}
        </div>
        
        {incomeData.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">
              {analyzing ? 'Analyzing your transaction history...' : 'No regular income patterns detected yet.'}
            </p>
            {!analyzing && (
              <div className="space-x-3">
                <Button 
                  onClick={() => { if (user?.id) runIncomeAnalysis(user.id); }} 
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Analyze My Income
                </Button>
                <Button 
                  onClick={debugIncomeAnalysis} 
                  variant="outline"
                  className="text-gray-600 border-gray-300"
                >
                  Debug Analysis
                </Button>
                <Button 
                  onClick={() => {
                    // Clear existing data and force fresh analysis
                    setIncomeData([]);
                    if (user?.id) runIncomeAnalysis(user.id);
                  }} 
                  variant="outline"
                  className="text-blue-600 border-blue-300"
                >
                  Force Refresh
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {incomeData.map((source, index) => {
              const sourceId = source.id || `source_${index}`;
              const isExpanded = expandedSources.has(sourceId);
              const isEditing = editingSource === sourceId;
              const transactions = sourceTransactions[sourceId] || [];
              const isLoadingTrans = loadingTransactions[sourceId];
              const isExcluded = excludedSources.has(sourceId);
              const isSelectedForMerge = selectedForMerge.has(sourceId);

              return (
                <div key={sourceId} className={`border rounded-lg ${isExcluded ? 'bg-gray-100 opacity-75' : isSelectedForMerge ? 'bg-blue-50 border-blue-300' : 'bg-gray-50'}`}>
                  <div className="p-4">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isSelectedForMerge}
                          onChange={() => handleSelectForMerge(sourceId)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          disabled={isExcluded}
                        />
                        <h3 className="font-medium text-gray-900">{source.source_name}</h3>
                        <button
                          onClick={() => toggleSourceExpansion(sourceId, source)}
                          className="text-blue-600 hover:text-blue-700 text-sm"
                        >
                          {isExpanded ? '▼' : '▶'} Historical transactions
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getFrequencyColor(source.frequency)}`}>
                          {source.frequency}
                        </span>
                        <button
                          onClick={() => handleEditSource(source)}
                          className="text-gray-500 hover:text-blue-600 text-sm mr-1"
                          title="Edit source"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleExcludeSource(sourceId)}
                          className={`text-sm ${isExcluded ? 'text-green-600 hover:text-green-700' : 'text-gray-500 hover:text-red-600'}`}
                          title={isExcluded ? "Include in analysis" : "Exclude from analysis"}
                        >
                          {isExcluded ? '↻' : '🗑️'}
                        </button>
                        {isExcluded && (
                          <span className="text-xs text-gray-500 ml-1">(excluded)</span>
                        )}
                      </div>
                    </div>
                    
                    {/* Editing Form */}
                    {isEditing ? (
                      <div className="bg-white p-4 rounded border mt-4">
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Source Name
                            </label>
                            <input
                              type="text"
                              value={editForm.source_name}
                              onChange={(e) => setEditForm({...editForm, source_name: e.target.value})}
                              className="w-full p-2 border rounded"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Expected Amount
                            </label>
                            <input
                              type="number"
                              value={editForm.expected_amount}
                              onChange={(e) => setEditForm({...editForm, expected_amount: e.target.value})}
                              className="w-full p-2 border rounded"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Frequency
                            </label>
                            <select
                              value={editForm.frequency}
                              onChange={(e) => setEditForm({...editForm, frequency: e.target.value})}
                              className="w-full p-2 border rounded"
                            >
                              <option value="weekly">Weekly</option>
                              <option value="bi-weekly">Bi-weekly</option>
                              <option value="bi-monthly">Bi-monthly</option>
                              <option value="monthly">Monthly</option>
                              <option value="irregular">Irregular</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Next Predicted Date
                            </label>
                            <input
                              type="date"
                              value={editForm.next_predicted_date}
                              onChange={(e) => setEditForm({...editForm, next_predicted_date: e.target.value})}
                              className="w-full p-2 border rounded"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={handleSaveEdit} className="bg-blue-600 hover:bg-blue-700">
                            Save Changes
                          </Button>
                          <Button onClick={handleCancelEdit} variant="outline">
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      /* Summary View */
                      <div className="grid grid-cols-1 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Amount:</span>
                          <p className="font-medium">{formatCurrency(source.expected_amount)}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Expanded Transaction History */}
                  {isExpanded && (
                    <div className="border-t bg-white">
                      {/* Show inline transaction data if available */}
                      {source.dates && source.amounts && source.dates.length > 0 ? (
                        <div className="p-4">
                          <h4 className="font-medium text-gray-900 mb-3">Transaction History ({source.dates.length} transactions)</h4>
                          <div className="space-y-2">
                            {source.dates.map((date, idx) => (
                              <div key={idx} className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded">
                                <div>
                                  <div className="font-medium">{source.source_name}</div>
                                  <div className="text-sm text-gray-600">{formatDate(date)}</div>
                                </div>
                                <div className="font-medium text-green-600">
                                  {formatCurrency(source.amounts?.[idx] || 0)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : isLoadingTrans ? (
                        <div className="p-4 text-center text-gray-500">
                          Loading transactions...
                        </div>
                      ) : transactions.length > 0 ? (
                        <div className="p-4">
                          <h4 className="font-medium text-gray-900 mb-3">Transaction History</h4>
                          <div className="space-y-2">
                            {transactions.map((transaction, txIndex) => (
                              <div key={txIndex} className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded">
                                <div>
                                  <div className="font-medium">{transaction.name}</div>
                                  <div className="text-sm text-gray-600">{formatDate(transaction.date)}</div>
                                </div>
                                <div className="font-medium text-green-600">
                                  {formatCurrency(transaction.amount)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 text-center text-gray-500">
                          {(source.transaction_count || 0) > 0 
                            ? `${source.transaction_count || 0} transactions detected but details not available`
                            : 'No transaction details available for this income source'
                          }
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Pay-Cycle Aligned Subscription Options - Temporarily disabled (Stripe not configured) */}
      {/*
      {subscriptionOptions.length > 0 && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">🚀 Pay-Cycle Aligned Billing</h2>
          <p className="text-gray-600 mb-6">
            Instead of arbitrary monthly billing, pay smaller amounts that align with your actual paychecks.
          </p>
          
          <div className="grid gap-4 md:grid-cols-3">
            {subscriptionOptions.map((option) => (
              <div 
                key={option.frequency}
                className="border rounded-lg p-4 hover:border-blue-500 transition-colors cursor-pointer"
                onClick={() => handleSubscriptionSelect(option)}
              >
                <div className="text-center">
                  <h3 className="font-semibold text-lg capitalize mb-1">
                    {option.frequency} Plan
                  </h3>
                  <div className="text-3xl font-bold text-blue-600 mb-2">
                    {formatCurrency(option.amount)}
                  </div>
                  <div className="text-sm text-gray-600 mb-3">
                    per {option.frequency === 'bi-weekly' ? '2 weeks' : option.frequency.replace('-', ' ')}
                  </div>
                  
                  <p className="text-sm text-gray-700 mb-4">
                    {option.description}
                  </p>
                  
                  {option.savings_vs_monthly > 0 && (
                    <div className="bg-green-50 p-2 rounded text-sm text-green-700 mb-4">
                      Save ${option.savings_vs_monthly.toFixed(2)}/month vs monthly billing
                    </div>
                  )}
                  
                  <div className="text-xs text-gray-500">
                    ${option.yearly_total} annually
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              💡 Same total cost, better cash flow alignment
            </p>
          </div>
        </Card>
      )}
      */}

      {/* Income Calendar */}
      {incomeData.length > 0 && (
        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">📅 Upcoming Income Schedule</h2>
          {(() => {
            const upcomingIncomes = calculateUpcomingIncomes(incomeData);
            
            if (upcomingIncomes.length === 0) {
              return (
                <div className="text-center py-8 text-gray-500">
                  <p>No upcoming income predictions available.</p>
                  <p className="text-sm mt-1">Income sources need regular frequency and last pay date to generate predictions.</p>
                </div>
              );
            }

            // Group by month
            const monthGroups = upcomingIncomes.reduce((groups, income) => {
              const monthKey = income.date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
              if (!groups[monthKey]) {
                groups[monthKey] = [];
              }
              groups[monthKey].push(income);
              return groups;
            }, {} as { [key: string]: typeof upcomingIncomes });

            return (
              <div className="space-y-6">
                {Object.entries(monthGroups).map(([month, monthIncomes]) => (
                  <div key={month}>
                    <h3 className="font-medium text-gray-900 mb-3">{month}</h3>
                    <div className="grid gap-3">
                      {monthIncomes.map((income, index) => (
                        <div key={index} className="flex justify-between items-center p-3 bg-green-50 border border-green-200 rounded-lg">
                          <div>
                            <div className="font-medium text-gray-900">{income.source.source_name}</div>
                            <div className="text-sm text-gray-600">
                              {income.date.toLocaleDateString('en-US', { 
                                weekday: 'short',
                                month: 'short', 
                                day: 'numeric' 
                              })}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-green-700">
                              {formatCurrency(income.amount)}
                            </div>
                            <div className="text-xs text-gray-500 capitalize">
                              {income.source.frequency}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 text-right">
                      <span className="text-sm font-medium text-gray-700">
                        Month Total: {formatCurrency(monthIncomes.reduce((sum, income) => sum + income.amount, 0))}
                      </span>
                    </div>
                  </div>
                ))}
                
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-blue-900">Next 3 Months Total:</span>
                    <span className="text-lg font-bold text-blue-900">
                      {formatCurrency(upcomingIncomes.reduce((sum, income) => sum + income.amount, 0))}
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}
        </Card>
      )}

      {/* Merge Dialog */}
      {showMergeDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Merge Income Sources</h3>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-3">
                                  You&apos;re merging {selectedForMerge.size} income sources:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {incomeData
                  .filter((source, index) => selectedForMerge.has(source.id || `source_${index}`))
                  .map(source => (
                    <li key={source.id}>{source.source_name} - {formatCurrency(source.expected_amount)}</li>
                  ))
                }
              </ul>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New Source Name
              </label>
              <input
                type="text"
                defaultValue="GCA PAY (Combined)"
                className="w-full p-2 border rounded-md"
                id="merge-source-name"
                placeholder="Enter name for merged source"
              />
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={() => {
                  const nameInput = document.getElementById('merge-source-name') as HTMLInputElement;
                  executeMerge(nameInput?.value || 'Merged Income Source');
                }}
                className="bg-blue-600 hover:bg-blue-700 flex-1"
              >
                Merge Sources
              </Button>
              <Button 
                onClick={() => setShowMergeDialog(false)}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
