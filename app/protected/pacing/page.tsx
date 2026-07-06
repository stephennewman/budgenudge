'use client';

import { useState, useEffect, useMemo } from 'react';
import { createSupabaseClient } from '@/utils/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ContentAreaLoader } from '@/components/ui/content-area-loader';

// Trailing window used to learn the user's "usual" daily spend per item.
const BASELINE_DAYS = 365;
// Below this much history, day-prorated pacing is too noisy to show.
const MIN_BASELINE_DAYS = 28;
// A vendor must appear at least this many times in the baseline to qualify —
// drops one-off junk descriptions (e.g. "Passportservices Payment 260406").
const MIN_VENDOR_BASELINE_TX = 3;
// Within ±this fraction of the expected pace we call it "on pace".
const NEUTRAL_BAND = 0.08;
// Don't show a % when the expected amount for a window is below this — tiny
// bases produce meaningless percentages (especially early in the week).
const PCT_FLOOR = 12;
// How many rows to show per dimension.
const MAX_ROWS = 15;

type GroupMode = 'merchant' | 'category' | 'bills';

interface BillTag {
  id: string;
  name: string;
}

interface RawTxn {
  amount: number;
  date: string;
  ai_category_tag: string | null;
  ai_merchant_name: string | null;
  merchant_name: string | null;
  name: string;
}

interface WindowPace {
  actual: number;
  expected: number;
  pct: number | null; // null when expected is below PCT_FLOOR
}

interface PacingRow {
  key: string;
  name: string;
  baselineMonthly: number; // dailyAvg * 30, for ranking
  baselineTxCount: number;
  week: WindowPace;
  twoWeek: WindowPace;
  month: WindowPace;
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

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export default function PacingPage() {
  const [mode, setMode] = useState<GroupMode>('category');
  const [transactions, setTransactions] = useState<RawTxn[]>([]);
  const [billTags, setBillTags] = useState<BillTag[]>([]);
  const [savingBill, setSavingBill] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createSupabaseClient();

  // ---- Time anchors (browser local; the user views this in their own tz) ----
  const now = new Date();
  const today = startOfDay(now);
  const dow = today.getDay(); // 0 = Sunday
  const weekStart = startOfDay(new Date(today.getTime() - dow * 86400000));
  const daysElapsedWeek = dow + 1;
  const twoWeekStart = startOfDay(new Date(today.getTime() - 13 * 86400000));
  const monthStart = startOfDay(new Date(today.getFullYear(), today.getMonth(), 1));
  const daysElapsedMonth = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('Authentication required');

      const { data: items } = await supabase
        .from('items')
        .select('plaid_item_id')
        .eq('user_id', user.id)
        .is('deleted_at', null);

      const itemIds = items?.map((item) => item.plaid_item_id) || [];
      if (itemIds.length === 0) {
        setTransactions([]);
        setLoading(false);
        return;
      }

      // Tagged recurring bills — shown as their own group so category/vendor
      // pacing reflects controllable spend.
      const { data: tagged } = await supabase
        .from('tagged_merchants')
        .select('id, merchant_name')
        .eq('user_id', user.id)
        .eq('is_active', true);
      setBillTags(
        (tagged || [])
          .filter((t) => (t.merchant_name || '').trim())
          .map((t) => ({ id: String(t.id), name: t.merchant_name!.trim() })),
      );

      const windowStart = startOfDay(new Date(today.getTime() - BASELINE_DAYS * 86400000));
      const windowStartStr = `${windowStart.getFullYear()}-${String(windowStart.getMonth() + 1).padStart(2, '0')}-${String(windowStart.getDate()).padStart(2, '0')}`;

      const { data: txns, error: txError } = await supabase
        .from('transactions')
        .select('amount, date, ai_category_tag, ai_merchant_name, merchant_name, name')
        .in('plaid_item_id', itemIds)
        .gt('amount', 0)
        .gte('date', windowStartStr)
        .order('date', { ascending: false });

      if (txError) throw new Error(`Failed to fetch transactions: ${txError.message}`);

      setTransactions((txns || []) as RawTxn[]);
    } catch (err) {
      console.error('Error fetching pacing data:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Lowercased tag name -> tag, so rows can be matched back to the tag record.
  const billLookup = useMemo(() => {
    const m = new Map<string, BillTag>();
    for (const t of billTags) m.set(t.name.toLowerCase(), t);
    return m;
  }, [billTags]);

  const { rows, effectiveBaselineDays } = useMemo<{ rows: PacingRow[]; effectiveBaselineDays: number }>(() => {
    if (transactions.length === 0) return { rows: [], effectiveBaselineDays: 0 };

    // Baseline ends before this month starts so month-to-date spending can't
    // inflate its own expected pace.
    const baselineEnd = startOfDay(new Date(monthStart.getTime() - 86400000));

    interface Agg {
      name: string;
      baselineSpend: number;
      baselineTxCount: number;
      // Distinct YYYY-MM months with baseline activity (bills average over
      // months present, not the whole year).
      baselineMonths: Set<string>;
      week: number;
      twoWeek: number;
      month: number;
    }
    const map = new Map<string, Agg>();
    let earliestBaseline: Date | null = null;

    for (const t of transactions) {
      const rawMerchant = (t.merchant_name || t.name || '').trim();
      if (!rawMerchant) continue;

      // A transaction is a bill if either its raw or AI merchant name is tagged.
      const matchedBill =
        billLookup.get(rawMerchant.toLowerCase()) ||
        (t.ai_merchant_name ? billLookup.get(t.ai_merchant_name.toLowerCase()) : undefined);
      if (mode === 'bills' ? !matchedBill : !!matchedBill) continue;

      const key =
        mode === 'bills'
          ? matchedBill!.name
          : mode === 'merchant'
            ? (t.ai_merchant_name || t.merchant_name || t.name || 'Unknown')
            : (t.ai_category_tag || 'Uncategorized');
      if (mode === 'category' && !t.ai_category_tag) continue;

      const txDate = new Date(t.date + 'T12:00:00');
      const amt = Math.max(0, Number(t.amount) || 0);

      if (!map.has(key)) {
        map.set(key, { name: key, baselineSpend: 0, baselineTxCount: 0, baselineMonths: new Set(), week: 0, twoWeek: 0, month: 0 });
      }
      const agg = map.get(key)!;

      if (txDate <= baselineEnd) {
        agg.baselineSpend += amt;
        agg.baselineTxCount += 1;
        agg.baselineMonths.add(t.date.slice(0, 7));
        if (!earliestBaseline || txDate < earliestBaseline) earliestBaseline = txDate;
      }
      if (txDate >= weekStart) agg.week += amt;
      if (txDate >= twoWeekStart) agg.twoWeek += amt;
      if (txDate >= monthStart) agg.month += amt;
    }

    const baselineDays = earliestBaseline
      ? Math.max(1, Math.min(BASELINE_DAYS, Math.round((baselineEnd.getTime() - (earliestBaseline as Date).getTime()) / 86400000) + 1))
      : 0;
    if (baselineDays < MIN_BASELINE_DAYS) return { rows: [], effectiveBaselineDays: baselineDays };

    const makePace = (actual: number, expected: number): WindowPace => ({
      actual,
      expected,
      pct: expected >= PCT_FLOOR ? Math.round((actual / expected - 1) * 100) : null,
    });

    const result: PacingRow[] = [];
    for (const agg of map.values()) {
      if (mode === 'merchant' && agg.baselineTxCount < MIN_VENDOR_BASELINE_TX) continue;
      const dailyAvg = agg.baselineSpend / baselineDays;
      if (dailyAvg <= 0) continue;
      // Average calendar month (365/12 days); the month pacing goal is the
      // % of the month elapsed × usual monthly spend. Bills average over the
      // months they actually occurred so mid-year starts aren't diluted.
      const baselineMonthly =
        mode === 'bills'
          ? agg.baselineSpend / Math.max(1, agg.baselineMonths.size)
          : dailyAvg * (365 / 12);
      result.push({
        key: agg.name,
        name: agg.name,
        baselineMonthly,
        baselineTxCount: agg.baselineTxCount,
        week: makePace(agg.week, dailyAvg * daysElapsedWeek),
        twoWeek: makePace(agg.twoWeek, dailyAvg * 14),
        month: makePace(agg.month, baselineMonthly * (daysElapsedMonth / daysInMonth)),
      });
    }

    return {
      rows: result.sort((a, b) => b.baselineMonthly - a.baselineMonthly).slice(0, MAX_ROWS),
      effectiveBaselineDays: baselineDays,
    };
  }, [transactions, billLookup, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tag a vendor as a recurring bill. The expected amount is the learned
  // monthly average; frequency defaults to monthly (editable elsewhere).
  const markAsBill = async (row: PacingRow) => {
    setSavingBill(row.key);
    try {
      const res = await fetch('/api/tagged-merchants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchant_name: row.name,
          expected_amount: Math.max(1, Math.round(row.baselineMonthly)),
          prediction_frequency: 'monthly',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to tag as bill');
      setBillTags((prev) => [...prev, { id: String(json.taggedMerchant.id), name: row.name }]);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to tag as bill');
    } finally {
      setSavingBill(null);
    }
  };

  // Deactivate the bill tag — the vendor moves back into normal pacing.
  const removeBill = async (row: PacingRow) => {
    const tag = billLookup.get(row.name.toLowerCase());
    if (!tag) return;
    setSavingBill(row.key);
    try {
      const res = await fetch(`/api/tagged-merchants/${tag.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: false }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to remove bill');
      setBillTags((prev) => prev.filter((t) => t.id !== tag.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove bill');
    } finally {
      setSavingBill(null);
    }
  };

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
            Spend vs. your usual pace — over the last{' '}
            {effectiveBaselineDays >= BASELINE_DAYS ? '12 months' : `${effectiveBaselineDays} days`}.
            {' '}{mode === 'bills' ? 'Tagged recurring bills only.' : 'Recurring bills excluded.'}
          </p>
        </div>

        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setMode('category')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === 'category' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            🗂️ Categories
          </button>
          <button
            onClick={() => setMode('merchant')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === 'merchant' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            🏪 Vendors
          </button>
          <button
            onClick={() => setMode('bills')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === 'bills' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            💸 Bills
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-gray-600">
              {mode === 'bills'
                ? 'No tagged bills yet. Switch to Vendors and use "+ Bill" to tag a vendor as a recurring bill.'
                : 'Not enough history yet. Pacing needs about 4 weeks of transactions before it can compare you to your usual.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="space-y-4 py-6">
            {/* Legend */}
            <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
              <span className="flex items-center gap-1">
                <span className="text-red-600 font-semibold">▲</span> Over usual
              </span>
              <span className="flex items-center gap-1">
                <span className="text-emerald-600 font-semibold">▼</span> Under usual
              </span>
              <span className="flex items-center gap-1">
                <span className="text-gray-500 font-semibold">≈</span> On pace
              </span>
              <span className="text-gray-400">
                Each cell: this-period spend vs. your usual for the same stretch.
              </span>
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-[1fr_repeat(3,minmax(70px,90px))] sm:grid-cols-[1fr_repeat(3,110px)] gap-2 items-end pb-1 border-b text-xs font-medium text-gray-500">
              <div>{mode === 'merchant' ? 'Vendor' : mode === 'bills' ? 'Bill' : 'Category'}</div>
              <div className="text-right">This week<span className="hidden sm:inline text-gray-400 font-normal"> (day {daysElapsedWeek})</span></div>
              <div className="text-right">Last 2 wks</div>
              <div className="text-right">This month<span className="hidden sm:inline text-gray-400 font-normal"> (day {daysElapsedMonth})</span></div>
            </div>

            {rows.map((row) => (
              <PacingRowView
                key={row.key}
                row={row}
                mode={mode}
                saving={savingBill === row.key}
                onMarkAsBill={mode === 'merchant' ? markAsBill : undefined}
                onRemoveBill={mode === 'bills' ? removeBill : undefined}
              />
            ))}

            <p className="text-xs text-gray-400 pt-2">
              Note: the weekly column is naturally jumpy early in the week — a single purchase can swing it. The 2-week and month columns are the steadier read.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PaceCell({ pace }: { pace: WindowPace }) {
  const { actual, expected, pct } = pace;

  let arrow = '≈';
  let color = 'text-gray-500';
  if (pct !== null) {
    const frac = pct / 100;
    if (frac > NEUTRAL_BAND) {
      arrow = '▲';
      color = 'text-red-600';
    } else if (frac < -NEUTRAL_BAND) {
      arrow = '▼';
      color = 'text-emerald-600';
    }
  }

  return (
    <div className="text-right" title={`Spent ${formatCurrency(actual)} · usual ~${formatCurrency(expected)}`}>
      <div className={`text-sm font-semibold tabular-nums ${color}`}>
        {pct === null ? (
          <span className="text-gray-400">—</span>
        ) : (
          <>
            {arrow} {pct > 0 ? '+' : ''}{pct}%
          </>
        )}
      </div>
      <div className="text-xs text-gray-500 tabular-nums">{formatCurrency(actual)}</div>
    </div>
  );
}

function PacingRowView({
  row,
  mode,
  saving,
  onMarkAsBill,
  onRemoveBill,
}: {
  row: PacingRow;
  mode: GroupMode;
  saving: boolean;
  onMarkAsBill?: (row: PacingRow) => void;
  onRemoveBill?: (row: PacingRow) => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_repeat(3,minmax(70px,90px))] sm:grid-cols-[1fr_repeat(3,110px)] gap-2 items-center">
      <div className="flex items-center gap-2 min-w-0">
        {mode === 'merchant' && <span className="shrink-0">{getMerchantIcon(row.name)}</span>}
        <div className="min-w-0">
          <div className="font-medium text-gray-900 truncate" title={row.name}>{row.name}</div>
          <div className="text-xs text-gray-400">usual ~{formatCurrency(row.baselineMonthly)}/mo</div>
        </div>
        {onMarkAsBill && (
          <button
            onClick={() => onMarkAsBill(row)}
            disabled={saving}
            title="Tag as a recurring bill"
            className="shrink-0 rounded border border-gray-200 px-1.5 py-0.5 text-[11px] text-gray-500 hover:border-blue-300 hover:text-blue-600 disabled:opacity-50"
          >
            {saving ? '…' : '+ Bill'}
          </button>
        )}
        {onRemoveBill && (
          <button
            onClick={() => onRemoveBill(row)}
            disabled={saving}
            title="Remove bill tag — vendor returns to normal pacing"
            className="shrink-0 rounded border border-gray-200 px-1.5 py-0.5 text-[11px] text-gray-500 hover:border-red-300 hover:text-red-600 disabled:opacity-50"
          >
            {saving ? '…' : '× Not a bill'}
          </button>
        )}
      </div>
      <PaceCell pace={row.week} />
      <PaceCell pace={row.twoWeek} />
      <PaceCell pace={row.month} />
    </div>
  );
}
