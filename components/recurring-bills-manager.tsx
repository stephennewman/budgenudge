'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { BouncingMoneyLoader } from '@/components/ui/bouncing-money-loader';
import SplitAccountsModal from '@/components/split-accounts-modal';


interface TaggedMerchant {
  id: number;
  merchant_name: string;
  ai_merchant_name?: string;
  expected_amount: number;
  prediction_frequency: string;
  confidence_score: number;
  is_active: boolean;
  auto_detected: boolean;
  next_predicted_date: string;
  account_identifier?: string;
  created_at: string;
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

export default function RecurringBillsManager() {
  const [taggedMerchants, setTaggedMerchants] = useState<TaggedMerchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    expected_amount: '',
    prediction_frequency: '',
    next_predicted_date: '',
    account_identifier: '',
    is_active: true
  });

  // New merchant form
  const [newMerchant, setNewMerchant] = useState({
    merchant_name: '',
    expected_amount: '',
    prediction_frequency: 'monthly'
  });
  const [showAddForm, setShowAddForm] = useState(false);

  // Historical transactions state
  const [merchantTransactions, setMerchantTransactions] = useState<{[key: number]: Transaction[]}>({});
  const [loadingTransactions, setLoadingTransactions] = useState<{[key: number]: boolean}>({});

  // Split modal state
  const [splitModalOpen, setSplitModalOpen] = useState(false);
  const [splitMerchant, setSplitMerchant] = useState<TaggedMerchant | null>(null);

  useEffect(() => {
    fetchTaggedMerchants();
  }, []);

  useEffect(() => {
    // When active merchants are loaded, fetch transactions for each
    if (taggedMerchants.length > 0) {
      const activeMerchants = taggedMerchants.filter(m => m.is_active);
      activeMerchants.forEach((merchant) => {
        if (!merchantTransactions[merchant.id] && !loadingTransactions[merchant.id]) {
          fetchMerchantTransactions(merchant.id, merchant.merchant_name);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taggedMerchants]);

  const fetchTaggedMerchants = async () => {
    try {
      const response = await fetch('/api/tagged-merchants');
      const data = await response.json();
      
      if (data.success) {
        setTaggedMerchants(data.taggedMerchants);
      }
    } catch (error) {
      console.error('Error fetching tagged merchants:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMerchantTransactions = async (merchantId: number, merchantName: string) => {
    if (merchantTransactions[merchantId]) {
      return;
    }
    setLoadingTransactions(prev => ({ ...prev, [merchantId]: true }));
    try {
      // Use server-side API endpoint to fetch transactions
      // Include merchantId for split accounts to get specific grouped transactions
      const response = await fetch(`/api/merchant-transactions?merchant=${encodeURIComponent(merchantName)}&merchantId=${merchantId}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch transactions');
      }
      
      setMerchantTransactions(prev => ({ ...prev, [merchantId]: data.transactions || [] }));
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
        fetchTaggedMerchants(); // Refresh the list
      } else {
        alert('Failed to update merchant: ' + data.error);
      }
    } catch (error) {
      console.error('Error updating merchant:', error);
      alert('Error updating merchant');
    }
  };

  const handleDelete = async (merchantId: number, merchantName: string) => {
    if (!confirm(`Remove ${merchantName} from recurring bills?`)) return;

    try {
      const response = await fetch(`/api/tagged-merchants/${merchantId}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      
      if (data.success) {
        fetchTaggedMerchants(); // Refresh the list
      } else {
        alert('Failed to delete merchant: ' + data.error);
      }
    } catch (error) {
      console.error('Error deleting merchant:', error);
      alert('Error deleting merchant');
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
      
      if (data.success) {
        fetchTaggedMerchants(); // Refresh the list
      } else {
        alert('Failed to toggle merchant: ' + data.error);
      }
    } catch (error) {
      console.error('Error toggling merchant:', error);
      alert('Error toggling merchant');
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
        fetchTaggedMerchants(); // Refresh the list
      } else {
        alert('Failed to add merchant: ' + data.error);
      }
    } catch (error) {
      console.error('Error adding merchant:', error);
      alert('Error adding merchant');
    }
  };

  const formatNextDate = (dateString: string) => {
    // Parse as local noon to avoid timezone issues (same as SMS)
    const date = new Date(dateString + 'T12:00:00');
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
  };

  const getConfidenceColor = (score: number): string => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getDisplayName = (merchant: TaggedMerchant): string => {
    const baseName = merchant.ai_merchant_name || merchant.merchant_name;
    
    if (!merchant.account_identifier) {
      return baseName; // "T-Mobile" (original, unsplit)
    }
    
    // Check if numeric or custom name
    if (/^\d+$/.test(merchant.account_identifier)) {
      return `${baseName} ${merchant.account_identifier}`; // "T-Mobile 1"
    } else {
      return `${baseName} (${merchant.account_identifier})`; // "T-Mobile (Wife)"
    }
  };

  const handleSplitAccounts = (merchant: TaggedMerchant) => {
    setSplitMerchant(merchant);
    setSplitModalOpen(true);
  };

  const handleConfirmSplit = async (groups: { id: string; transactions: Transaction[]; averageAmount: number; frequency: string; confidence: number; }[]) => {
    if (!splitMerchant) return;

    try {
      const response = await fetch('/api/tagged-merchants/split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchant_id: splitMerchant.id,
          groups: groups
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setSplitModalOpen(false);
        setSplitMerchant(null);
        fetchTaggedMerchants(); // Refresh the list
      } else {
        alert('Failed to split merchant: ' + data.error);
      }
    } catch (error) {
      console.error('Error splitting merchant:', error);
      alert('Error splitting merchant');
    }
  };



  if (loading) {
    return <BouncingMoneyLoader />;
  }

  // Filter and sort active merchants by upcoming date (soonest first, future dates only)
  const now = new Date();
  now.setHours(0, 0, 0, 0); // Set to start of today
  const activeMerchants = taggedMerchants
    .filter(m => m.is_active && new Date(m.next_predicted_date + 'T12:00:00').setHours(0,0,0,0) >= now.getTime())
    .sort((a, b) => new Date(a.next_predicted_date + 'T12:00:00').getTime() - new Date(b.next_predicted_date + 'T12:00:00').getTime());
  
  const inactiveMerchants = taggedMerchants.filter(m => !m.is_active);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex flex-col">
          <h1 className="text-2xl font-medium">⭐ Bills</h1>
          <p className="text-muted-foreground mt-2">
            {activeMerchants.length} active predictions
          </p>
        </div>
        <Button 
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-green-600 hover:bg-green-700"
        >
          ➕ Add Custom Bill
        </Button>
      </div>

      {/* Add New Merchant Form */}
      {showAddForm && (
        <Card className="p-4 border-green-200 bg-green-50">
          <h3 className="font-semibold mb-3">➕ Add Custom Recurring Transaction</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Input
              placeholder="Merchant name"
              value={newMerchant.merchant_name}
              onChange={(e) => setNewMerchant({...newMerchant, merchant_name: e.target.value})}
            />
            <Input
              type="number"
              step="0.01"
              placeholder="Amount"
              value={newMerchant.expected_amount}
              onChange={(e) => setNewMerchant({...newMerchant, expected_amount: e.target.value})}
            />
            <select 
              className="px-3 py-2 border rounded-md"
              value={newMerchant.prediction_frequency}
              onChange={(e) => setNewMerchant({...newMerchant, prediction_frequency: e.target.value})}
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="bi-monthly">Bi-monthly</option>
              <option value="quarterly">Quarterly</option>
            </select>
            <div className="flex gap-2">
              <Button onClick={handleAddMerchant} size="sm">Add</Button>
              <Button variant="outline" onClick={() => setShowAddForm(false)} size="sm">Cancel</Button>
            </div>
          </div>
        </Card>
      )}

      {/* Active Merchants */}
      <Card className="p-6">
        {activeMerchants.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No active recurring bills found. Add some above to start tracking predictions!
          </p>
        ) : (
          <div className="space-y-3">
            {activeMerchants.map((merchant) => (
              <div key={merchant.id} className="bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between p-3">
                  {editingId === merchant.id ? (
                    // Edit mode
                    <div className="flex items-center gap-3 flex-1">
                      <span className="font-medium min-w-0 flex-1">{merchant.merchant_name}</span>
                      <Input
                        type="number"
                        step="0.01"
                        value={editForm.expected_amount}
                        onChange={(e) => setEditForm({...editForm, expected_amount: e.target.value})}
                        className="w-24"
                      />
                      <Input
                        type="date"
                        value={editForm.next_predicted_date}
                        onChange={(e) => setEditForm({...editForm, next_predicted_date: e.target.value})}
                        className="w-36"
                      />
                      <Input
                        type="text"
                        placeholder="Account name"
                        value={editForm.account_identifier}
                        onChange={(e) => setEditForm({...editForm, account_identifier: e.target.value})}
                        className="w-32"
                      />
                      <select 
                        value={editForm.prediction_frequency}
                        onChange={(e) => setEditForm({...editForm, prediction_frequency: e.target.value})}
                        className="px-2 py-1 border rounded text-sm"
                      >
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="bi-monthly">Bi-monthly</option>
                        <option value="quarterly">Quarterly</option>
                      </select>
                      <div className="flex gap-1">
                        <Button size="sm" onClick={() => handleSaveEdit(merchant.id)}>Save</Button>
                        <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    // View mode
                    <>
                      <div className="flex items-center gap-4 flex-1">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{getDisplayName(merchant)}</span>
                          </div>
                          <div className="text-sm text-gray-600 mb-1">
                            ${merchant.expected_amount.toFixed(2)} • {merchant.prediction_frequency}
                          </div>
                          <div className="text-sm text-gray-600">
                            Next: {formatNextDate(merchant.next_predicted_date)} • 
                            <span className={getConfidenceColor(merchant.confidence_score)}> {merchant.confidence_score}% confidence</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(merchant)}>Edit</Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleSplitAccounts(merchant)}
                          className={merchant.account_identifier ? "text-green-600 hover:text-green-700" : "text-blue-600 hover:text-blue-700"}
                        >
                          {merchant.account_identifier ? "✏️ Edit Split" : "🔀 Split"}
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleDelete(merchant.id, merchant.merchant_name)}
                          className="text-red-600 hover:text-red-700"
                        >
                          Remove
                        </Button>
                      </div>
                    </>
                  )}
                </div>
                
                {/* Historical Transactions */}
                {loadingTransactions[merchant.id] ? (
                  <div className="px-3 pb-3">
                    <div className="bg-white border rounded-md p-3">
                      <div className="text-sm text-gray-500">Loading transactions...</div>
                    </div>
                  </div>
                ) : merchantTransactions[merchant.id] && merchantTransactions[merchant.id].length > 0 ? (
                  <div className="px-3 pb-3">
                    <div className="bg-white border rounded-md p-3">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="text-sm font-medium text-gray-700">📋 Recent Transactions</h4>
                        {merchant.account_identifier && (
                          <div className="text-xs text-gray-500">
                            🎯 = Tracked for this split
                          </div>
                        )}
                      </div>
                      <ul className="space-y-1">
                        {merchantTransactions[merchant.id].map((transaction) => (
                          <li key={transaction.id} className={`text-sm p-2 rounded flex items-center justify-between ${
                            merchant.account_identifier && transaction.is_tracked_for_this_split 
                              ? 'bg-blue-50 border-l-3 border-l-blue-400' 
                              : merchant.account_identifier
                              ? 'bg-gray-50 opacity-75'
                              : ''
                          }`}>
                            <div className="flex items-center gap-2">
                              {merchant.account_identifier && transaction.is_tracked_for_this_split && (
                                <span className="text-blue-600">🎯</span>
                              )}
                              <span className="text-gray-500">{transaction.date}</span>
                              {transaction.ai_category_tag && (
                                <span className="text-xs bg-green-100 text-green-700 px-1 py-0.5 rounded">{transaction.ai_category_tag}</span>
                              )}
                            </div>
                            <span className="font-medium text-red-600">${Math.abs(transaction.amount).toFixed(2)}</span>
                          </li>
                        ))}
                      </ul>
                      {merchant.account_identifier && (
                        <div className="mt-3 pt-2 border-t text-xs text-gray-500">
                          This split account tracks {merchantTransactions[merchant.id].filter(t => t.is_tracked_for_this_split).length} of {merchantTransactions[merchant.id].length} recent transactions for predictions.
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="px-3 pb-3">
                    <div className="bg-white border rounded-md p-3">
                      <div className="text-sm text-gray-500">No recent transactions found for this merchant.</div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Inactive Merchants */}
      {inactiveMerchants.length > 0 && (
        <Card className="p-6">
          <div className="space-y-2">
            {inactiveMerchants.map((merchant) => (
              <div key={merchant.id} className="flex items-center justify-between p-3 bg-gray-100 rounded-lg opacity-60">
                <div className="flex items-center gap-4 flex-1">
                  <span className="font-medium">{merchant.merchant_name}</span>
                  <span className="text-gray-600">${merchant.expected_amount.toFixed(2)} {merchant.prediction_frequency}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleToggleActive(merchant.id, merchant.is_active)}
                  >
                    Enable
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleDelete(merchant.id, merchant.merchant_name)}
                    className="text-red-600 hover:text-red-700"
                  >
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