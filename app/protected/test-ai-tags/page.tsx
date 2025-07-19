'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function TestAITagsPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const testSampleTransactions = [
    {
      merchant_name: "PUBLIX SUPER MARKET #1234",
      name: "PUBLIX SUPER MARKET #1234 PURCHASE 07/19",
      amount: 45.67,
      category: ["Food and Drink", "Groceries"],
      subcategory: "Groceries"
    },
    {
      merchant_name: "APPLE.COM/BILL",
      name: "APPLE.COM/BILL ITUNES PURCHASE",
      amount: 9.99,
      category: ["Service", "Digital Services"],
      subcategory: "Subscription"
    },
    {
      merchant_name: "TRINITY COMMONS COF Trinity",
      name: "TRINITY COMMONS COF Trinity FL",
      amount: 12.50,
      category: ["Food and Drink", "Restaurants"],
      subcategory: "Coffee Shops"
    }
  ];

  const runAITaggingTest = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      console.log('🧪 Testing AI tagging with sample transactions');

      // Test each sample transaction
      const results = [];
      
      for (const transaction of testSampleTransactions) {
        const response = await fetch('/api/test-single-ai-tag', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(transaction)
        });

        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || `HTTP ${response.status}`);
        }

        results.push(data);
      }

      setResult({
        success: true,
        message: 'AI tagging tests completed successfully',
        results: results,
        timestamp: new Date().toISOString()
      });

    } catch (err) {
      console.error('AI tagging test failed:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const tagRealTransactions = async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('🏷️ Tagging real transactions');

      const response = await fetch('/api/tag-sample-transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      setResult({
        success: true,
        message: 'Real transactions tagged successfully',
        tagged: data.tagged,
        total_found: data.total_found,
        results: data.results,
        timestamp: new Date().toISOString()
      });

    } catch (err) {
      console.error('Real transaction tagging failed:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const checkComprehensiveStats = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/tag-stats', {
        method: 'GET',
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      setResult({
        success: true,
        message: 'Comprehensive AI tagging stats',
        stats: data.stats,
        untagged_sample: data.untagged_sample,
        recommendations: data.recommendations,
        timestamp: new Date().toISOString()
      });

    } catch (err) {
      console.error('Stats check failed:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const tagAllTransactions = async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('🏷️ Starting bulk AI tagging of all transactions');

      const response = await fetch('/api/tag-all-transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          max_transactions: 1000 // Increased limit
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      setResult({
        success: true,
        message: 'Bulk AI tagging completed',
        stats: data.stats,
        results: data.results,
        errors: data.errors,
        estimated_cost: data.estimated_cost,
        timestamp: new Date().toISOString()
      });

    } catch (err) {
      console.error('Bulk AI tagging failed:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const tagAllRemainingTransactions = async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('🏷️ Starting mega-batch AI tagging of ALL remaining transactions');

      const response = await fetch('/api/tag-all-transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          max_transactions: 5000 // Much higher limit for remaining transactions
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      setResult({
        success: true,
        message: 'Mega-batch AI tagging completed',
        stats: data.stats,
        results: data.results,
        errors: data.errors,
        estimated_cost: data.estimated_cost,
        timestamp: new Date().toISOString()
      });

    } catch (err) {
      console.error('Mega-batch AI tagging failed:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">🤖 AI Tagging System Test</h1>
        <p className="text-muted-foreground">
          Test the OpenAI-powered merchant normalization and category tagging system
        </p>
      </div>

      <div className="grid gap-6 max-w-4xl mx-auto">
        
        {/* Test Controls */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">🧪 Test Controls</h2>
          <div className="flex gap-4">
            <Button 
              onClick={runAITaggingTest}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? '⏳ Testing...' : '🚀 Test AI Tagging'}
            </Button>
            <Button 
              onClick={checkComprehensiveStats}
              disabled={isLoading}
              variant="outline"
            >
              {isLoading ? '⏳ Loading...' : '📊 Check Stats'}
            </Button>
            <Button 
              onClick={tagRealTransactions}
              disabled={isLoading}
              variant="outline"
            >
              {isLoading ? '⏳ Tagging...' : '🏷️ Tag Real Transactions'}
            </Button>
            <Button 
              onClick={tagAllTransactions}
              disabled={isLoading}
              className="bg-green-600 hover:bg-green-700"
              title="Tag up to 1000 untagged transactions using AI"
            >
              {isLoading ? '⏳ Bulk Tagging...' : '🚀 Bulk Tag All (up to 1000)'}
            </Button>
            <Button 
              onClick={tagAllRemainingTransactions}
              disabled={isLoading}
              className="bg-purple-600 hover:bg-purple-700"
              title="Tag ALL remaining untagged transactions using AI"
            >
              {isLoading ? '⏳ Mega-Batch Tagging...' : '🚀 Mega-Batch Tag All'}
            </Button>
          </div>
        </Card>

        {/* Sample Data */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">📋 Sample Test Data</h2>
          <div className="space-y-3">
            {testSampleTransactions.map((tx, index) => (
              <div key={index} className="bg-gray-50 p-3 rounded border">
                <div className="font-medium">{tx.merchant_name}</div>
                <div className="text-sm text-gray-600">{tx.name}</div>
                <div className="text-sm">
                  <span className="font-medium">${tx.amount}</span>
                  {" — "}
                  <span className="text-blue-600">{tx.category?.[0]}</span>
                  {tx.subcategory && (
                    <>
                      {" → "}
                      <span className="text-purple-600">{tx.subcategory}</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Results */}
        {error && (
          <Card className="p-6 border-red-200 bg-red-50">
            <h2 className="text-xl font-semibold mb-2 text-red-800">❌ Error</h2>
            <div className="text-red-700 font-mono text-sm">{error}</div>
          </Card>
        )}

        {result && (
          <Card className="p-6 border-green-200 bg-green-50">
            <h2 className="text-xl font-semibold mb-4 text-green-800">✅ Results</h2>
            <pre className="bg-white p-4 rounded border overflow-auto text-sm">
              {JSON.stringify(result, null, 2)}
            </pre>
          </Card>
        )}

        {/* Instructions */}
        <Card className="p-6 bg-blue-50 border-blue-200">
          <h2 className="text-xl font-semibold mb-4 text-blue-800">📝 How It Works</h2>
          <div className="space-y-2 text-blue-700">
            <p><strong>AI Merchant Names:</strong> &quot;PUBLIX SUPER MARKET #1234&quot; → &quot;Publix&quot;</p>
            <p><strong>AI Categories:</strong> Logical grouping like &quot;Groceries&quot;, &quot;Restaurant&quot;, &quot;Subscription&quot;</p>
            <p><strong>Smart Caching:</strong> Same merchants get cached to reduce API costs</p>
            <p><strong>Fallback Logic:</strong> If OpenAI fails, intelligent fallbacks are used</p>
          </div>
        </Card>

        {/* Bulk Processing Info */}
        <Card className="p-6 bg-green-50 border-green-200">
          <h2 className="text-xl font-semibold mb-4 text-green-800">🚀 Bulk Processing</h2>
          <div className="space-y-2 text-green-700">
            <p><strong>Efficient:</strong> Groups transactions by merchant to minimize API calls</p>
            <p><strong>Cost-Effective:</strong> Uses caching - typically ~$0.01 per unique merchant</p>
            <p><strong>Multiple Options:</strong> Bulk (1000 max) or Mega-Batch (all remaining)</p>
            <p><strong>Rate Limited:</strong> Includes delays to respect OpenAI rate limits</p>
            <p><strong>Progress Tracking:</strong> Shows detailed stats and results</p>
            <p><strong>Comprehensive Stats:</strong> Check current tagging status before processing</p>
          </div>
        </Card>

      </div>
    </div>
  );
} 