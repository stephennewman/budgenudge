'use client';

import { useState } from 'react';
import { createSupabaseClient } from '@/utils/supabase/client';

interface BalanceDiagnostic {
  account_id: string;
  account_name: string;
  account_type: string;
  institution: string;
  plaid_current: number | null;
  plaid_available: number | null;
  plaid_currency: string | null;
  stored_current: number | null;
  stored_available: number | null;
  stored_last_updated: string | null;
  stored_updated_at: string | null;
  current_balance_match: boolean;
  available_balance_match: boolean;
  hours_stale: number | null;
  staleness_level: string;
  current_discrepancy: number | null;
  available_discrepancy: number | null;
  missing_stored_data: boolean;
  missing_plaid_current: boolean;
  missing_plaid_available: boolean;
}

interface DiagnosticError {
  item_id: string;
  institution: string;
  error: string;
  error_details: string;
}

interface DiagnosticResult {
  summary: {
    total_accounts: number;
    current_balance_accuracy: string;
    available_balance_accuracy: string;
    accounts_stale_over_1hr: number;
    data_freshness_issues: boolean;
  };
  diagnostics: (BalanceDiagnostic | DiagnosticError)[];
  recommendations: string[];
}

export default function BalanceDiagnosticPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const supabase = createSupabaseClient();

  const runDiagnostic = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated. Please sign in first.');
      }

      // Call the diagnostic API
      const response = await fetch('/api/debug-balance-data', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      console.error('Diagnostic error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getStalenessColor = (level: string) => {
    switch (level) {
      case 'fresh': return 'text-green-600';
      case 'stale': return 'text-yellow-600';
      case 'very_stale': return 'text-red-600';
      case 'never_updated': return 'text-red-800';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">🔍 Balance Diagnostic Tool</h1>
        <p className="text-gray-600">
          Compare your stored balance data with real-time Plaid data to identify staleness and discrepancies.
        </p>
      </div>

      <div className="mb-6">
        <button
          onClick={runDiagnostic}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-6 py-3 rounded-lg font-medium transition-colors"
        >
          {loading ? '🔄 Running Diagnostic...' : '🔍 Run Balance Diagnostic'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <h3 className="text-red-800 font-medium mb-2">❌ Error</h3>
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {result && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">📊 Summary</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p><span className="font-medium">Total Accounts:</span> {result.summary.total_accounts}</p>
                <p><span className="font-medium">Current Balance Accuracy:</span> {result.summary.current_balance_accuracy}</p>
                <p><span className="font-medium">Available Balance Accuracy:</span> {result.summary.available_balance_accuracy}</p>
              </div>
              <div>
                <p><span className="font-medium">Stale Accounts (&gt;1hr):</span> {result.summary.accounts_stale_over_1hr}</p>
                <p>
                  <span className="font-medium">Data Freshness Issues:</span> 
                  <span className={result.summary.data_freshness_issues ? 'text-red-600 ml-2' : 'text-green-600 ml-2'}>
                    {result.summary.data_freshness_issues ? '🚨 Yes' : '✅ No'}
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Recommendations */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">💡 Recommendations</h2>
            <ul className="space-y-2">
              {result.recommendations.map((rec, index) => (
                <li key={index} className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Detailed Diagnostics */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">🔍 Detailed Account Analysis</h2>
            <div className="space-y-4">
              {result.diagnostics.map((diagnostic, index) => {
                if ('error' in diagnostic) {
                  return (
                    <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <h3 className="font-medium text-red-800">❌ {diagnostic.institution}</h3>
                      <p className="text-red-700">{diagnostic.error}: {diagnostic.error_details}</p>
                    </div>
                  );
                }

                return (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-medium text-lg">{diagnostic.account_name}</h3>
                      <span className={`px-2 py-1 rounded text-sm font-medium ${getStalenessColor(diagnostic.staleness_level)}`}>
                        {diagnostic.staleness_level}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="font-medium mb-1">💰 Current Balance</p>
                        <p>Plaid (Live): {formatCurrency(diagnostic.plaid_current)}</p>
                        <p>Stored: {formatCurrency(diagnostic.stored_current)}</p>
                        {diagnostic.current_discrepancy !== null && (
                          <p className={diagnostic.current_discrepancy === 0 ? 'text-green-600' : 'text-red-600'}>
                            Difference: {formatCurrency(diagnostic.current_discrepancy)}
                          </p>
                        )}
                      </div>
                      
                      <div>
                        <p className="font-medium mb-1">💳 Available Balance</p>
                        <p>Plaid (Live): {formatCurrency(diagnostic.plaid_available)}</p>
                        <p>Stored: {formatCurrency(diagnostic.stored_available)}</p>
                        {diagnostic.available_discrepancy !== null && (
                          <p className={diagnostic.available_discrepancy === 0 ? 'text-green-600' : 'text-red-600'}>
                            Difference: {formatCurrency(diagnostic.available_discrepancy)}
                          </p>
                        )}
                      </div>
                      
                      <div>
                        <p className="font-medium mb-1">⏰ Staleness</p>
                        <p>Hours Stale: {diagnostic.hours_stale || 'Unknown'}</p>
                        <p>Last Updated: {diagnostic.stored_last_updated ? 
                          new Date(diagnostic.stored_last_updated).toLocaleString() : 'Never'}</p>
                        <p>Account Type: {diagnostic.account_type}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Raw JSON (for debugging) */}
          <details className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <summary className="font-medium cursor-pointer">🔧 Raw JSON Data (for debugging)</summary>
            <pre className="mt-4 text-xs overflow-auto bg-gray-100 p-4 rounded">
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
