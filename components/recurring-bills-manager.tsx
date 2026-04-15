'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ContentAreaLoader } from '@/components/ui/content-area-loader';
import SplitAccountsModal from '@/components/split-accounts-modal';
import { Check, Clock, AlertTriangle, ChevronRight } from 'lucide-react';

interface BillTimelineEntry {
  id: number;
  merchant_name: string;
  expected_amount: number;
  actual_amount?: number;
  predicted_date: string;
  actual_date?: string;
  status: 'paid' | 'upcoming' | 'overdue';
  confidence_score: number;
  prediction_frequency: string;
  days_off?: number;
  interval_days?: number;
}

interface TaggedMerchant {
  id: number;
  merchant_name: string;
  ai_merchant_name?: string;
  ai_category_tag?: string;
  expected_amount: number;
  prediction_frequency: string;
  confidence_score: number;
  is_active: boolean;
  auto_detected: boolean;
  next_predicted_date: string;
  account_identifier?: string;
  created_at: string;
  status?: string;
  last_paid_date?: string;
}

interface Transaction {
  id: string;
  date: string;
  amount: number;
  name: string;
  merchant_name?: string;
  category?: string[];
  subcategory?: string;
  ai_merchant_name?: string;
  ai_category_tag?: string;
  is_tracked_for_this_split?: boolean;
}

interface TimelineData {
  paid: BillTimelineEntry[];
  upcoming: BillTimelineEntry[];
  overdue: BillTimelineEntry[];
  totalPaid: number;
  totalUpcoming: number;
  totalOverdue: number;
}

export default function RecurringBillsManager() {
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);
  const [monthLabel, setMonthLabel] = useState('');
  const [timeline, setTimeline] = useState<TimelineData>({ paid: [], upcoming: [], overdue: [], totalPaid: 0, totalUpcoming: 0, totalOverdue: 0 });
  const [allMerchants, setAllMerchants] = useState<TaggedMerchant[]>([]);
  const [inactiveMerchants, setInactiveMerchants] = useState<TaggedMerchant[]>([]);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    merchant_name: '',
    expected_amount: '',
    prediction_frequency: '',
    next_predicted_date: '',
    account_identifier: '',
    is_active: true
  });

  const [newMerchant, setNewMerchant] = useState({
    merchant_name: '',
    expected_amount: '',
    prediction_frequency: 'monthly'
  });
  const [showAddForm, setShowAddForm] = useState(false);

  // Historical transactions state
  const [merchantTransactions, setMerchantTransactions] = useState<{[key: number]: Transaction[]}>({});
  const [loadingTransactions, setLoadingTransactions] = useState<{[key: number]: boolean}>({});
  const [expandedRecentByMerchant, setExpandedRecentByMerchant] = useState<Record<number, boolean>>({});

  // Split modal state
  const [splitModalOpen, setSplitModalOpen] = useState(false);
  const [splitMerchant, setSplitMerchant] = useState<TaggedMerchant | null>(null);

  useEffect(() => {
    fetchMonthlySummary();
  }, []);

  const fetchMonthlySummary = async () => {
    try {
      const response = await fetch('/api/expenses/monthly-summary');
      const data = await response.json();

      if (data.success) {
        setMonthLabel(data.monthLabel);
        setTimeline(data.timeline);
        setAllMerchants(data.allMerchants || []);
        setInactiveMerchants(data.inactiveMerchants || []);

        // If no merchants at all, try initialization
        if ((!data.allMerchants || data.allMerchants.length === 0)) {
          await runInitialization();
        }
      }
    } catch (error) {
      console.error('Error fetching monthly summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const runInitialization = async () => {
    setInitializing(true);
    try {
      const initResponse = await fetch('/api/expenses/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const initResult = await initResponse.json();
      if (initResult.success) {
        // Re-fetch to get newly detected bills
        const refreshResponse = await fetch('/api/expenses/monthly-summary');
        const refreshData = await refreshResponse.json();
        if (refreshData.success) {
          setMonthLabel(refreshData.monthLabel);
          setTimeline(refreshData.timeline);
          setAllMerchants(refreshData.allMerchants || []);
          setInactiveMerchants(refreshData.inactiveMerchants || []);
        }
      }
    } catch (initError) {
      console.error('Initialization error:', initError);
    } finally {
      setInitializing(false);
    }
  };

  const fetchMerchantTransactions = async (merchantId: number, merchantName: string) => {
    if (merchantTransactions[merchantId]) return;
    setLoadingTransactions(prev => ({ ...prev, [merchantId]: true }));
    try {
      const response = await fetch(`/api/merchant-transactions?merchant=${encodeURIComponent(merchantName)}&merchantId=${merchantId}`);
      const data = await response.json();
      if (response.ok) {
        setMerchantTransactions(prev => ({ ...prev, [merchantId]: data.transactions || [] }));
      }
    } catch (error) {
      console.error('Error fetching merchant transactions:', error);
      setMerchantTransactions(prev => ({ ...prev, [merchantId]: [] }));
    } finally {
      setLoadingTransactions(prev => ({ ...prev, [merchantId]: false }));
    }
  };

  const handleEdit = (merchant: TaggedMerchant) => {
    setEditingId(merchant.id);
    setEditForm({
      merchant_name: merchant.merchant_name,
      expected_amount: merchant.expected_amount.toString(),
      prediction_frequency: merchant.prediction_frequency,
      next_predicted_date: merchant.next_predicted_date,
      account_identifier: merchant.account_identifier || '',
      is_active: merchant.is_active
    });
  };

  const handleSaveEdit = async (merchantId: number) => {
    try {
      const response = await fetch(`/api/tagged-merchants/${merchantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });
      const data = await response.json();
      if (data.success) {
        setEditingId(null);
        fetchMonthlySummary();
      } else {
        alert('Failed to update: ' + data.error);
      }
    } catch (error) {
      console.error('Error updating merchant:', error);
      alert('Error updating merchant');
    }
  };

  const handleDelete = async (merchantId: number, merchantName: string) => {
    if (!confirm(`Remove ${merchantName} from recurring bills?`)) return;
    try {
      const response = await fetch(`/api/tagged-merchants/${merchantId}`, { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        fetchMonthlySummary();
      } else {
        alert('Failed to delete: ' + data.error);
      }
    } catch (error) {
      console.error('Error deleting merchant:', error);
    }
  };

  const handleToggleActive = async (merchantId: number, currentActive: boolean) => {
    try {
      const response = await fetch(`/api/tagged-merchants/${merchantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentActive })
      });
      const data = await response.json();
      if (data.success) fetchMonthlySummary();
    } catch (error) {
      console.error('Error toggling merchant:', error);
    }
  };

  const handleAddMerchant = async () => {
    if (!newMerchant.merchant_name || !newMerchant.expected_amount) {
      alert('Please fill in merchant name and amount');
      return;
    }
    try {
      const response = await fetch('/api/tagged-merchants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMerchant)
      });
      const data = await response.json();
      if (data.success) {
        setNewMerchant({ merchant_name: '', expected_amount: '', prediction_frequency: 'monthly' });
        setShowAddForm(false);
        fetchMonthlySummary();
      } else {
        alert('Failed to add: ' + data.error);
      }
    } catch (error) {
      console.error('Error adding merchant:', error);
    }
  };

  const getDisplayName = (entryId: number, merchantName: string): string => {
    const match = allMerchants.find(m => m.id === entryId);
    if (match?.ai_merchant_name && !isLikelyTechnicalString(match.ai_merchant_name)) {
      return match.ai_merchant_name;
    }
    if (isLikelyTechnicalString(merchantName)) return 'Unnamed Bill';
    return merchantName;
  };

  const isLikelyTechnicalString = (str: string): boolean => {
    return /^[A-Z0-9]{10,}$/i.test(str) ||
           /^[a-z0-9_-]{15,}$/i.test(str) ||
           str.includes('plaid') ||
           str.includes('item_') ||
           str.length > 30 ||
           /^[A-Z0-9]{3,}\d{5,}/.test(str);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getDayOrdinal = (dateStr: string) => {
    const day = new Date(dateStr + 'T12:00:00').getDate();
    const suffixes = ['th', 'st', 'nd', 'rd'];
    const v = day % 100;
    return day + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
  };

  const getConfidenceBadge = (score: number) => {
    if (score >= 85) return { color: 'bg-green-100 text-green-700', label: `${score}%` };
    if (score >= 60) return { color: 'bg-yellow-100 text-yellow-700', label: `${score}%` };
    return { color: 'bg-red-100 text-red-700', label: `${score}%` };
  };

  const handleSplitAccounts = (merchantId: number) => {
    const merchant = allMerchants.find(m => m.id === merchantId);
    if (merchant) {
      setSplitMerchant(merchant);
      setSplitModalOpen(true);
    }
  };

  const handleConfirmSplit = async (groups: { id: string; transactions: Transaction[]; averageAmount: number; frequency: string; confidence: number; }[]) => {
    if (!splitMerchant) return;
    try {
      const response = await fetch('/api/tagged-merchants/split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchant_id: splitMerchant.id, groups })
      });
      const data = await response.json();
      if (data.success) {
        setSplitModalOpen(false);
        setSplitMerchant(null);
        fetchMonthlySummary();
      } else {
        alert('Failed to split: ' + data.error);
      }
    } catch (error) {
      console.error('Error splitting merchant:', error);
    }
  };

  if (loading || initializing) {
    return (
      <div className="relative min-h-[400px]">
        <ContentAreaLoader />
        {initializing && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80">
            <div className="text-center max-w-md p-6">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                AI is analyzing your expenses...
              </h3>
              <p className="text-sm text-gray-600">
                Detecting recurring bills from your transaction history. This usually takes 10-20 seconds.
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  const allTimelineEntries = [
    ...timeline.paid,
    ...timeline.upcoming,
  ].sort((a, b) => {
    const dateA = a.actual_date || a.predicted_date;
    const dateB = b.actual_date || b.predicted_date;
    return dateA.localeCompare(dateB);
  });

  const totalMonth = timeline.totalPaid + timeline.totalUpcoming;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex flex-col">
          <h1 className="text-2xl font-medium">Expenses</h1>
          <p className="text-muted-foreground mt-1">
            {monthLabel} &middot; {timeline.paid.length} paid &middot; {timeline.upcoming.length} upcoming
          </p>
        </div>
        <Button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-green-600 hover:bg-green-700"
        >
          + Expense
        </Button>
      </div>

      {/* Month Total Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 text-center">
          <div className="text-sm text-muted-foreground">Paid</div>
          <div className="text-2xl font-bold text-green-600">${timeline.totalPaid.toFixed(2)}</div>
          <div className="text-xs text-muted-foreground">{timeline.paid.length} bills</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-sm text-muted-foreground">Upcoming</div>
          <div className="text-2xl font-bold text-amber-600">${timeline.totalUpcoming.toFixed(2)}</div>
          <div className="text-xs text-muted-foreground">{timeline.upcoming.length} bills</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-sm text-muted-foreground">Month Total</div>
          <div className="text-2xl font-bold">${totalMonth.toFixed(2)}</div>
          <div className="text-xs text-muted-foreground">{allTimelineEntries.length} bills</div>
        </Card>
      </div>

      {/* Add New Merchant Form */}
      {showAddForm && (
        <Card className="p-4 border-green-200 bg-green-50">
          <h3 className="font-semibold mb-3">Add Recurring Expense</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Input
              placeholder="Merchant name"
              value={newMerchant.merchant_name}
              onChange={(e) => setNewMerchant({...newMerchant, merchant_name: e.target.value})}
            />
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={newMerchant.expected_amount}
                onChange={(e) => setNewMerchant({...newMerchant, expected_amount: e.target.value})}
                className="pl-6"
              />
            </div>
            <select
              className="px-3 py-2 border rounded-md"
              value={newMerchant.prediction_frequency}
              onChange={(e) => setNewMerchant({...newMerchant, prediction_frequency: e.target.value})}
            >
              <option value="weekly">Weekly</option>
              <option value="bi-weekly">Bi-weekly</option>
              <option value="monthly">Monthly</option>
              <option value="bi-monthly">Bi-monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="semi-annual">Semi-annual</option>
              <option value="annual">Annual</option>
            </select>
            <div className="flex gap-2">
              <Button onClick={handleAddMerchant} size="sm">Add</Button>
              <Button variant="outline" onClick={() => setShowAddForm(false)} size="sm">Cancel</Button>
            </div>
          </div>
        </Card>
      )}

      {/* Monthly Timeline */}
      <Card className="p-6">
        {allTimelineEntries.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No recurring bills found. Add some above or connect a bank account to start tracking.
          </p>
        ) : (
          <div className="space-y-1">
            {allTimelineEntries.map((entry) => {
              const displayName = getDisplayName(entry.id, entry.merchant_name);
              const isPaid = entry.status === 'paid';
              const displayDate = entry.actual_date || entry.predicted_date;
              const confidenceBadge = getConfidenceBadge(entry.confidence_score);
              const merchant = allMerchants.find(m => m.id === entry.id);

              return (
                <div key={`${entry.id}-${entry.status}`} className="bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between p-3">
                    {editingId === entry.id ? (
                      <div className="flex-1 space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                            <Input
                              type="text"
                              value={editForm.merchant_name}
                              onChange={(e) => setEditForm({...editForm, merchant_name: e.target.value})}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Amount</label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                              <Input
                                type="number"
                                step="0.01"
                                value={editForm.expected_amount}
                                onChange={(e) => setEditForm({...editForm, expected_amount: e.target.value})}
                                className="pl-6"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Next Date</label>
                            <Input
                              type="date"
                              value={editForm.next_predicted_date}
                              onChange={(e) => setEditForm({...editForm, next_predicted_date: e.target.value})}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Frequency</label>
                            <select
                              value={editForm.prediction_frequency}
                              onChange={(e) => setEditForm({...editForm, prediction_frequency: e.target.value})}
                              className="w-full px-3 py-2 border rounded-md text-sm"
                            >
                              <option value="weekly">Weekly</option>
                              <option value="bi-weekly">Bi-weekly</option>
                              <option value="monthly">Monthly</option>
                              <option value="bi-monthly">Bi-monthly</option>
                              <option value="quarterly">Quarterly</option>
                              <option value="semi-annual">Semi-annual</option>
                              <option value="annual">Annual</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Subgroup Name (optional)</label>
                            <Input
                              type="text"
                              placeholder="API, Credit Card, etc."
                              value={editForm.account_identifier}
                              onChange={(e) => setEditForm({...editForm, account_identifier: e.target.value})}
                            />
                          </div>
                          <div className="flex gap-2 pt-5">
                            <Button size="sm" onClick={() => handleSaveEdit(entry.id)}>Save</Button>
                            <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>Cancel</Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {/* Status icon */}
                          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                            isPaid ? 'bg-green-100' : 'bg-amber-100'
                          }`}>
                            {isPaid ? (
                              <Check className="w-4 h-4 text-green-600" />
                            ) : (
                              <Clock className="w-4 h-4 text-amber-600" />
                            )}
                          </div>

                          {/* Date column */}
                          <div className="w-16 flex-shrink-0 text-sm font-medium text-gray-600">
                            {getDayOrdinal(displayDate)}
                          </div>

                          {/* Merchant + details */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">{displayName}</span>
                              {merchant?.ai_category_tag && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{merchant.ai_category_tag}</span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500">
                              {isPaid ? (
                                <>
                                  Paid {formatDate(entry.actual_date!)}
                                  {entry.days_off === 0 ? ' · on time' : ` · ${entry.days_off}d off`}
                                </>
                              ) : (
                                <>
                                  Expected {formatDate(entry.predicted_date)} · {entry.prediction_frequency}
                                  {entry.interval_days && !['weekly','bi-weekly','monthly','bi-monthly','quarterly'].includes(entry.prediction_frequency)
                                    ? ` (${entry.interval_days}d cycle)` : ''}
                                </>
                              )}
                            </div>
                          </div>

                          {/* Amount */}
                          <div className="text-right flex-shrink-0">
                            <div className={`font-semibold ${isPaid ? 'text-green-700' : 'text-gray-900'}`}>
                              ${(entry.actual_amount || entry.expected_amount).toFixed(2)}
                            </div>
                            {!isPaid && (
                              <span className={`text-xs px-1.5 py-0.5 rounded ${confidenceBadge.color}`}>
                                {confidenceBadge.label}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                          <Button variant="ghost" size="sm" onClick={() => {
                            if (merchant) handleEdit(merchant);
                          }}>Edit</Button>
                          <Button variant="ghost" size="sm" onClick={() => handleSplitAccounts(entry.id)}>Split</Button>
                          <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDelete(entry.id, entry.merchant_name)}>
                            Remove
                          </Button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Expandable recent transactions */}
                  {!editingId && (() => {
                    // Load transactions on first expand
                    if (!merchantTransactions[entry.id] && !loadingTransactions[entry.id] && expandedRecentByMerchant[entry.id]) {
                      fetchMerchantTransactions(entry.id, entry.merchant_name);
                    }

                    return loadingTransactions[entry.id] ? (
                      <div className="px-3 pb-3">
                        <div className="bg-white border rounded-md p-3 text-sm text-gray-500">Loading transactions...</div>
                      </div>
                    ) : (
                      <div className="px-3 pb-2">
                        <button
                          type="button"
                          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                          onClick={() => {
                            setExpandedRecentByMerchant(prev => ({ ...prev, [entry.id]: !prev[entry.id] }));
                            if (!merchantTransactions[entry.id] && !loadingTransactions[entry.id]) {
                              fetchMerchantTransactions(entry.id, entry.merchant_name);
                            }
                          }}
                        >
                          <ChevronRight className={`h-3 w-3 transition-transform ${expandedRecentByMerchant[entry.id] ? 'rotate-90' : ''}`} />
                          Recent Transactions
                        </button>
                        {expandedRecentByMerchant[entry.id] && merchantTransactions[entry.id] && (
                          <ul className="mt-1 space-y-0.5">
                            {merchantTransactions[entry.id].map((tx) => (
                              <li key={tx.id} className="text-xs py-1 px-2 rounded bg-white">
                                <span className="text-gray-500">{tx.date}</span>
                                <span className="ml-2 font-medium">${Math.abs(tx.amount).toFixed(2)}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Inactive Merchants */}
      {inactiveMerchants.length > 0 && (
        <Card className="p-6">
          <h3 className="text-sm font-semibold text-gray-500 mb-3">Inactive ({inactiveMerchants.length})</h3>
          <div className="space-y-2">
            {inactiveMerchants.map((merchant) => (
              <div key={merchant.id} className="flex items-center justify-between p-3 bg-gray-100 rounded-lg opacity-60">
                <div className="flex items-center gap-4 flex-1">
                  <AlertTriangle className="w-4 h-4 text-gray-400" />
                  <span className="font-medium">{merchant.merchant_name}</span>
                  <span className="text-gray-600">${merchant.expected_amount.toFixed(2)} {merchant.prediction_frequency}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleToggleActive(merchant.id, merchant.is_active)}>
                    Enable
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDelete(merchant.id, merchant.merchant_name)} className="text-red-600 hover:text-red-700">
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Split Accounts Modal */}
      {splitMerchant && (
        <SplitAccountsModal
          merchant={splitMerchant}
          isOpen={splitModalOpen}
          onClose={() => {
            setSplitModalOpen(false);
            setSplitMerchant(null);
          }}
          onConfirm={handleConfirmSplit}
        />
      )}
    </div>
  );
}
