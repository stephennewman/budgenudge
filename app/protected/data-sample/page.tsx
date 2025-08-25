'use client';

import { useState, useEffect } from 'react';

interface DataSample {
  user: {
    id: string;
    email: string;
  };
  accounts: {
    count: number;
    total_balance: number;
    types: Array<{ type: string; subtype: string }>;
    sample: Array<{
      name: string;
      institution_name: string;
      available_balance: number | null;
      current_balance: number | null;
    }>;
  };
  transactions: {
    recent_count: number;
    monthly_spending: number;
    unique_categories: number;
    unique_merchants: number;
    sample: Array<{
      name: string;
      amount: number;
      category: string | null;
      merchant_name: string | null;
    }>;
  };
  recurring_bills: {
    count: number;
    total_monthly: number;
    sample: Array<{
      name: string;
      amount: number;
      frequency: string;
    }>;
  };
  income_sources: {
    count: number;
    total_monthly: number;
    sample: Array<{
      name: string;
      amount: number;
      frequency: string;
    }>;
  };
  spending_analysis: {
    top_categories: Array<{ category: string; amount: number }>;
    top_merchants: Array<{ merchant: string; amount: number }>;
  };
  suggested_variables: Array<{
    id: string;
    name: string;
    description: string;
    example: string;
  }>;
}

export default function DataSamplePage() {
  const [dataSample, setDataSample] = useState<DataSample | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDataSample();
  }, []);

  const fetchDataSample = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/sms-variables');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setDataSample(data);
    } catch (err) {
      console.error('Error fetching data sample:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Sampling your financial data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-red-800 mb-2">Error Loading Data</h2>
            <p className="text-red-600">{error}</p>
            <button
              onClick={fetchDataSample}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!dataSample) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center">
            <p className="text-gray-600">No data available</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">📊 SMS Builder Data Sample</h1>
          <p className="text-gray-600">
            Real financial data available for SMS Builder variables
          </p>
        </div>

        {/* Current Variables Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">🔄 Current SMS Builder Variables</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-medium text-blue-900">Today&apos;s Date</h3>
              <p className="text-blue-700 text-sm">Dynamic date formatting</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="font-medium text-green-900">Account Count</h3>
              <p className="text-green-700 text-sm">{dataSample.accounts.count} accounts connected</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <h3 className="font-medium text-purple-900">Total Balance</h3>
              <p className="text-purple-700 text-sm">${dataSample.accounts.total_balance.toLocaleString()}</p>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <h3 className="font-medium text-orange-900">Last Transaction</h3>
              <p className="text-orange-700 text-sm">Most recent transaction date</p>
            </div>
          </div>
        </div>

        {/* Suggested New Variables */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">🚀 Suggested New Variables</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dataSample.suggested_variables.map((variable) => (
              <div key={variable.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h3 className="font-medium text-gray-900 mb-2">{variable.name}</h3>
                <p className="text-gray-600 text-sm mb-3">{variable.description}</p>
                <div className="bg-white p-3 rounded border border-gray-200">
                  <p className="text-xs text-gray-500 mb-1">Example:</p>
                  <p className="text-sm font-mono text-gray-800">{variable.example}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Data Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Accounts Summary */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">🏦 Accounts Summary</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Accounts:</span>
                <span className="font-semibold">{dataSample.accounts.count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Balance:</span>
                <span className="font-semibold">${dataSample.accounts.total_balance.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Account Types:</span>
                <span className="font-semibold">{dataSample.accounts.types.length}</span>
              </div>
            </div>
            {dataSample.accounts.sample.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium text-gray-900 mb-2">Sample Accounts:</h4>
                <div className="space-y-2">
                  {dataSample.accounts.sample.map((account, index) => (
                    <div key={index} className="text-sm text-gray-600">
                      {account.name} - {account.institution_name} (${(account.available_balance || account.current_balance || 0).toLocaleString()})
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Spending Summary */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">💳 Spending Summary</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Monthly Spending:</span>
                <span className="font-semibold">${dataSample.transactions.monthly_spending.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Unique Categories:</span>
                <span className="font-semibold">{dataSample.transactions.unique_categories}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Unique Merchants:</span>
                <span className="font-semibold">{dataSample.transactions.unique_merchants}</span>
              </div>
            </div>
            {dataSample.spending_analysis.top_categories.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium text-gray-900 mb-2">Top Spending Categories:</h4>
                <div className="space-y-1">
                  {dataSample.spending_analysis.top_categories.slice(0, 3).map((cat, index) => (
                    <div key={index} className="text-sm text-gray-600">
                      {cat.category}: ${cat.amount.toLocaleString()}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Recurring Bills & Income */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">📅 Recurring Bills</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Bills:</span>
                <span className="font-semibold">{dataSample.recurring_bills.count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Monthly Total:</span>
                <span className="font-semibold">${dataSample.recurring_bills.total_monthly.toLocaleString()}</span>
              </div>
            </div>
            {dataSample.recurring_bills.sample.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium text-gray-900 mb-2">Sample Bills:</h4>
                <div className="space-y-2">
                  {dataSample.recurring_bills.sample.map((bill, index) => (
                    <div key={index} className="text-sm text-gray-600">
                      {bill.name}: ${bill.amount.toLocaleString()} ({bill.frequency})
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">💰 Income Sources</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Sources:</span>
                <span className="font-semibold">{dataSample.income_sources.count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Monthly Total:</span>
                <span className="font-semibold">${dataSample.income_sources.total_monthly.toLocaleString()}</span>
              </div>
            </div>
            {dataSample.income_sources.sample.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium text-gray-900 mb-2">Sample Sources:</h4>
                <div className="space-y-2">
                  {dataSample.income_sources.sample.map((income, index) => (
                    <div key={index} className="text-sm text-gray-600">
                      {income.name}: ${income.amount.toLocaleString()} ({income.frequency})
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 text-center">
          <button
            onClick={fetchDataSample}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 mr-4"
          >
            🔄 Refresh Data
          </button>
          <a
            href="/protected/simple-builder"
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 inline-block"
          >
            🚀 Go to SMS Builder
          </a>
        </div>
      </div>
    </div>
  );
}
