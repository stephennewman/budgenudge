'use client';

import { useState, useEffect } from 'react';
import { createSupabaseClient } from '@/utils/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ContentAreaLoader } from '@/components/ui/content-area-loader';

// A "frequent" item averages at least this many transactions per month over the
// baseline window. Below this, linear day-of-month pacing is misleading (e.g. a
// mortgage paid once/month), so we render it as a binary Paid/Due bar instead.
const FREQUENT_TX_PER_MONTH = 4;
// Maximum number of complete months to average over. We use FEWER than this when
// the user simply doesn't have that much history yet (see effectiveMonths below),
// so a recently-connected account isn't divided by months it has no data for.
const MAX_BASELINE_MONTHS = 6;

type GroupMode = 'merchant' | 'category';

interface PacingRow {
  key: string;
  name: string;
  budget: number; // avg monthly spend over baseline window
  avgTxPerMonth: number;
  avgTxAmount: number;
  currentSpend: number;
  currentTxCount: number;
  isFrequent: boolean;
}

interface RawTxn {
  amount: number;
  date: string;
  ai_category_tag: string | null;
  ai_merchant_name: string | null;
  merchant_name: string | null;
  name: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

const MERCHANT_ICONS: { [key: string]: string } = {
  Amazon: '📦', Target: '🎯', Walmart: '🛒', Costco: '🏪', Starbucks: '☕',
  Publix: '🛒', Kroger: '🛒', Shell: '⛽', Exxon: '⛽', Apple: '🍎',
  Netflix: '📺', Spotify: '🎵', Uber: '🚗', Lyft: '🚕',
};

function getMerchantIcon(merchant: string): string {
  return MERCHANT_ICONS[merchant] || '🏢';
}

export default function PacingPage() {
  const [mode, setMode] = useState<GroupMode>('merchant');
  const [rows, setRows] = useState<PacingRow[]>([]);
  const [baselineMonths, setBaselineMonths] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Day-of-month progress for the linear pace marker.
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const paceFraction = dayOfMonth / daysInMonth;

  const supabase = createSupabaseClient();

  const buildRows = (
    transactions: RawTxn[],
    groupMode: GroupMode,
  ): { rows: PacingRow[]; effectiveMonths: number } => {
    const today = new Date();
    const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    interface Agg {
      baselineSpend: number;
      baselineTxCount: number;
      currentSpend: number;
      currentTxCount: number;
    }
    const map = new Map<string, Agg>();

    // Track when this account's baseline data actually starts so we divide by the
    // real number of complete months it has, not a blind constant.
    let earliestBaselineDate: Date | null = null;

    transactions.forEach((t) => {
      const key =
        groupMode === 'merchant'
          ? t.ai_merchant_name || t.merchant_name || t.name || 'Unknown'
          : t.ai_category_tag || 'Uncategorized';

      const txDate = new Date(t.date + 'T12:00:00');

      if (!map.has(key)) {
        map.set(key, { baselineSpend: 0, baselineTxCount: 0, currentSpend: 0, currentTxCount: 0 });
      }
      const agg = map.get(key)!;

      if (txDate >= currentMonthStart) {
        agg.currentSpend += t.amount;
        agg.currentTxCount += 1;
      } else {
        // Within the baseline window (already pre-filtered by the query).
        agg.baselineSpend += t.amount;
        agg.baselineTxCount += 1;
        if (!earliestBaselineDate || txDate < earliestBaselineDate) {
          earliestBaselineDate = txDate;
        }
      }
    });

    // Effective months = complete calendar months from the account's first
    // baseline transaction through the last complete month, capped at the max
    // window. This prevents understating averages for recently-connected users.
    const lastCompleteMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    let effectiveMonths = 0;
    if (earliestBaselineDate) {
      const start = earliestBaselineDate as Date;
      const monthsSpan =
        (lastCompleteMonth.getFullYear() - start.getFullYear()) * 12 +
        (lastCompleteMonth.getMonth() - start.getMonth()) +
        1;
      effectiveMonths = Math.max(1, Math.min(MAX_BASELINE_MONTHS, monthsSpan));
    }

    if (effectiveMonths === 0) {
      return { rows: [], effectiveMonths: 0 };
    }

    const result: PacingRow[] = Array.from(map.entries()).map(([key, agg]) => {
      const budget = agg.baselineSpend / effectiveMonths;
      const avgTxPerMonth = agg.baselineTxCount / effectiveMonths;
      const avgTxAmount = agg.baselineTxCount > 0 ? agg.baselineSpend / agg.baselineTxCount : 0;

      return {
        key,
        name: key,
        budget,
        avgTxPerMonth,
        avgTxAmount,
        currentSpend: agg.currentSpend,
        currentTxCount: agg.currentTxCount,
        isFrequent: avgTxPerMonth >= FREQUENT_TX_PER_MONTH,
      };
    });

    // Only show items that have a real monthly budget to pace against, ranked
    // by average monthly spend (most to least).
    const rows = result
      .filter((r) => r.budget > 0)
      .sort((a, b) => b.budget - a.budget);

    return { rows, effectiveMonths };
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('Authentication required');

      const { data: items } = await supabase
        .from('items')
        .select('plaid_item_id')
        .eq('user_id', user.id);

      const itemIds = items?.map((item) => item.plaid_item_id) || [];
      if (itemIds.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      // Baseline window = first day of the month BASELINE_MONTHS months before the
      // current month. The current (partial) month is excluded from the average.
      const today = new Date();
      const windowStart = new Date(today.getFullYear(), today.getMonth() - MAX_BASELINE_MONTHS, 1);
      const windowStartStr = `${windowStart.getFullYear()}-${String(windowStart.getMonth() + 1).padStart(2, '0')}-01`;

      const { data: transactions, error: txError } = await supabase
        .from('transactions')
        .select('amount, date, ai_category_tag, ai_merchant_name, merchant_name, name')
        .in('plaid_item_id', itemIds)
        .gte('amount', 0)
        .gte('date', windowStartStr)
        .order('date', { ascending: false });

      if (txError) throw new Error(`Failed to fetch transactions: ${txError.message}`);

      const { rows: builtRows, effectiveMonths } = buildRows((transactions || []) as RawTxn[], mode);
      setRows(builtRows);
      setBaselineMonths(effectiveMonths);
    } catch (err) {
      console.error('Error fetching pacing data:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="relative min-h-[600px]">
        <ContentAreaLoader />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-w-md mx-auto">
            <p className="text-red-700">Error: {error}</p>
            <Button onClick={fetchData} className="mt-2">Try Again</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex flex-col">
          <h1 className="text-2xl font-medium">🎯 Pacing</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            This month&apos;s spend vs. your {baselineMonths}-month average
            {baselineMonths < MAX_BASELINE_MONTHS && baselineMonths > 0 ? ' (limited history)' : ''}
            {' '}— Day {dayOfMonth} of {daysInMonth}
          </p>
        </div>

        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setMode('merchant')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === 'merchant' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            🏪 Merchants
          </button>
          <button
            onClick={() => setMode('category')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === 'category' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            🗂️ Categories
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-gray-600">
              No spending history found yet. Pacing needs at least one complete prior month of transactions.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="space-y-5 py-6">
            {/* Legend */}
            <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-sm bg-blue-500" /> On pace
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-sm bg-red-500" /> Over pace
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-sm bg-emerald-500" /> Under pace
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-0.5 h-3 bg-gray-800" /> Pace target (today)
              </span>
            </div>

            {rows.map((row, index) => (
              <PacingBar
                key={row.key}
                row={row}
                rank={index + 1}
                mode={mode}
                paceFraction={paceFraction}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PacingBar({
  row,
  rank,
  mode,
  paceFraction,
}: {
  row: PacingRow;
  rank: number;
  mode: GroupMode;
  paceFraction: number;
}) {
  const { budget, currentSpend, isFrequent } = row;

  const fillPercent = budget > 0 ? Math.min((currentSpend / budget) * 100, 100) : 0;
  const overBudget = currentSpend > budget;

  // For frequent items the pace target slides with the day of month. For lumpy
  // items (e.g. a mortgage), proration is meaningless — the target is the full
  // monthly amount and we treat it as Paid vs Due.
  const paceTargetAmount = isFrequent ? budget * paceFraction : budget;
  const markerPercent = isFrequent ? paceFraction * 100 : 100;

  let fillColor: string;
  let statusLabel: string;
  let statusColor: string;

  if (isFrequent) {
    const ratio = paceTargetAmount > 0 ? currentSpend / paceTargetAmount : 0;
    if (overBudget || ratio > 1.1) {
      fillColor = 'bg-red-500';
      statusLabel = 'Over pace';
      statusColor = 'text-red-600';
    } else if (ratio < 0.9) {
      fillColor = 'bg-emerald-500';
      statusLabel = 'Under pace';
      statusColor = 'text-emerald-600';
    } else {
      fillColor = 'bg-blue-500';
      statusLabel = 'On pace';
      statusColor = 'text-blue-600';
    }
  } else {
    // Lumpy / bill-like: binary Paid vs Due.
    const paid = row.currentTxCount > 0;
    fillColor = paid ? 'bg-emerald-500' : 'bg-gray-300';
    statusLabel = paid ? 'Paid' : 'Due';
    statusColor = paid ? 'text-emerald-600' : 'text-gray-500';
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs text-gray-400 tabular-nums w-5 text-right">{rank}</span>
          {mode === 'merchant' && <span>{getMerchantIcon(row.name)}</span>}
          <span className="font-medium text-gray-900 truncate">{row.name}</span>
          {!isFrequent && (
            <span className="text-[10px] uppercase tracking-wide bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
              Bill
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-2 shrink-0 text-sm">
          <span className="font-semibold text-gray-900 tabular-nums">{formatCurrency(currentSpend)}</span>
          <span className="text-gray-400">/</span>
          <span className="text-gray-500 tabular-nums">{formatCurrency(budget)}</span>
          <span className={`text-xs font-medium ${statusColor} w-16 text-right`}>{statusLabel}</span>
        </div>
      </div>

      <div className="relative h-5 w-full rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`absolute left-0 top-0 h-full rounded-full ${fillColor} transition-all`}
          style={{ width: `${fillPercent}%` }}
        />
        {/* Pace target marker */}
        {markerPercent < 100 && (
          <div
            className="absolute top-0 h-full w-0.5 bg-gray-800"
            style={{ left: `${markerPercent}%` }}
            title={`Pace target: ${formatCurrency(paceTargetAmount)}`}
          />
        )}
      </div>

      <div className="flex justify-between text-xs text-gray-400">
        <span>
          {isFrequent
            ? `${row.currentTxCount} txns this month • avg ${formatCurrency(row.avgTxAmount)} × ~${row.avgTxPerMonth.toFixed(0)}/mo`
            : `Expected ~${formatCurrency(budget)}/mo • ${row.currentTxCount > 0 ? 'paid this month' : 'not yet paid'}`}
        </span>
        {isFrequent && (
          <span>Pace today: {formatCurrency(paceTargetAmount)}</span>
        )}
      </div>
    </div>
  );
}
