'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface Assignment {
  transaction_id: string;
  split_merchant_id: number;
  confidence: number;
  reason: string;
  amount_match: number;
  split_account: string;
  transaction?: {
    date: string;
    amount: number;
    name: string;
  };
}

interface SplitMerchantManagerProps {
  merchantName: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function SplitMerchantManager({ merchantName, isOpen, onClose }: SplitMerchantManagerProps) {
  const [loading, setLoading] = useState(false);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [stats, setStats] = useState({
    split_merchants: 0,
    unassigned_transactions: 0,
    potential_assignments: 0,
    high_confidence_assignments: 0
  });

  useEffect(() => {
    if (isOpen && merchantName) {
      analyzeAssignments();
    }
  }, [isOpen, merchantName]);

  const analyzeAssignments = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/auto-assign-split-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchant_name: merchantName,
          dry_run: true // Preview mode
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setAssignments(data.assignments || []);
        setStats({
          split_merchants: data.split_merchants,
          unassigned_transactions: data.unassigned_transactions,
          potential_assignments: data.potential_assignments,
          high_confidence_assignments: data.high_confidence_assignments
        });
      }
    } catch (error) {
      console.error('Error analyzing assignments:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyHighConfidenceAssignments = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/auto-assign-split-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchant_name: merchantName,
          dry_run: false // Actually apply
        })
      });

      const data = await response.json();
      
      if (data.success) {
        alert(`Successfully assigned ${data.high_confidence_assignments} transactions automatically!`);
        analyzeAssignments(); // Refresh the analysis
      } else {
        alert('Failed to apply assignments: ' + data.error);
      }
    } catch (error) {
      console.error('Error applying assignments:', error);
      alert('Error applying assignments');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">
            Manage {merchantName} Split Assignments
          </h2>
          <Button variant="outline" onClick={onClose}>✕</Button>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="text-gray-500">Analyzing split assignments...</div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Stats Overview */}
            <Card className="p-4">
              <h3 className="font-medium mb-3">📊 Assignment Overview</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{stats.split_merchants}</div>
                  <div className="text-sm text-gray-500">Split Accounts</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{stats.unassigned_transactions}</div>
                  <div className="text-sm text-gray-500">Unassigned</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{stats.high_confidence_assignments}</div>
                  <div className="text-sm text-gray-500">Auto-Assignable</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-600">{stats.potential_assignments}</div>
                  <div className="text-sm text-gray-500">Total Matches</div>
                </div>
              </div>
            </Card>

            {/* Quick Actions */}
            {stats.high_confidence_assignments > 0 && (
              <Card className="p-4 bg-green-50 border-green-200">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-medium text-green-800">🎯 Ready for Auto-Assignment</h3>
                    <p className="text-sm text-green-600">
                      {stats.high_confidence_assignments} transactions can be automatically assigned with high confidence.
                    </p>
                  </div>
                  <Button 
                    onClick={applyHighConfidenceAssignments}
                    className="bg-green-600 hover:bg-green-700"
                    disabled={loading}
                  >
                    Auto-Assign {stats.high_confidence_assignments}
                  </Button>
                </div>
              </Card>
            )}

            {/* Assignment Suggestions */}
            {assignments.length > 0 && (
              <div>
                <h3 className="font-medium mb-3">🤖 Assignment Suggestions</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {assignments.map((assignment, index) => (
                    <Card 
                      key={index} 
                      className={`p-3 ${
                        assignment.confidence >= 80 
                          ? 'border-green-200 bg-green-50' 
                          : assignment.confidence >= 60 
                          ? 'border-yellow-200 bg-yellow-50'
                          : 'border-gray-200'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="font-medium text-sm">
                            → {assignment.split_account}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {assignment.reason} • {assignment.amount_match}% amount match
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className={`text-sm font-medium px-2 py-1 rounded ${
                            assignment.confidence >= 80 
                              ? 'bg-green-100 text-green-700'
                              : assignment.confidence >= 60 
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {assignment.confidence}%
                          </div>
                          {assignment.confidence < 80 && (
                            <Button size="sm" variant="outline" className="text-xs">
                              Manual Review
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* No Assignments Message */}
            {assignments.length === 0 && !loading && (
              <Card className="p-8 text-center">
                <div className="text-gray-500">
                  {stats.unassigned_transactions === 0 
                    ? '✅ All transactions are properly assigned to split accounts!'
                    : '❓ No clear assignment patterns found. You may need to manually review unassigned transactions.'
                  }
                </div>
              </Card>
            )}

            <div className="flex justify-between items-center pt-4 border-t">
              <div className="text-sm text-gray-500">
                Future transactions will be auto-assigned using these patterns
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={onClose}>Close</Button>
                <Button onClick={analyzeAssignments} disabled={loading}>
                  Refresh Analysis
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 