'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ContentAreaLoader } from '@/components/ui/content-area-loader';
import { createSupabaseClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

interface SpendingAnalysis {
  categories: Array<{
    name: string;
    total: number;
    percentage: number;
    count: number;
    icon: string;
  }>;
  merchants: Array<{
    name: string;
    total: number;
    count: number;
    category: string;
  }>;
  totalSpending: number;
  timeframe: string;
}

type AnalysisState = 'ready' | 'processing' | 'complete' | 'error';

export default function PlaidSuccessPage() {
  const [analysisState, setAnalysisState] = useState<AnalysisState>('ready');
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [analysis, setAnalysis] = useState<SpendingAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const router = useRouter();
  const supabase = createSupabaseClient();

  // Check if user is authenticated
  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/sign-in');
      }
    }
    checkAuth();
  }, [supabase, router]);

  const generateAnalysis = async () => {
    setAnalysisState('processing');
    setProgress(0);
    setProgressMessage('Starting analysis...');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No session found');
      }

      // Step 1: Trigger AI tagging
      setProgressMessage('🤖 AI is analyzing your transactions...');
      setProgress(20);

      const tagResponse = await fetch('/api/tag-all-transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ max_transactions: 500 })
      });

      if (!tagResponse.ok) {
        throw new Error('Failed to process transactions');
      }

      const tagResult = await tagResponse.json();
      console.log('AI Tagging complete:', tagResult);

      // Step 2: Generate spending analysis
      setProgressMessage('📊 Generating your spending breakdown...');
      setProgress(60);

      const analysisResponse = await fetch('/api/spending-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!analysisResponse.ok) {
        throw new Error('Failed to generate analysis');
      }

      const analysisResult = await analysisResponse.json();
      setAnalysis(analysisResult);

      setProgressMessage('✅ Analysis complete!');
      setProgress(100);
      setAnalysisState('complete');

    } catch (error) {
      console.error('Analysis error:', error);
      setError(error instanceof Error ? error.message : 'An error occurred');
      setAnalysisState('error');
    }
  };

  const continueToTransactions = () => {
    router.push('/protected/transactions');
  };

  if (analysisState === 'ready') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
              <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <CardTitle className="text-3xl font-bold text-green-800">
              🎉 Bank Account Connected!
            </CardTitle>
            <p className="text-lg text-gray-600 mt-4">
              Your transactions are ready. Now let&apos;s add some intelligence to see where your money goes.
            </p>
          </CardHeader>
          <CardContent className="text-center space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="font-semibold text-blue-800 mb-2">What you&apos;ll get:</h3>
              <ul className="text-blue-700 space-y-1">
                <li>🍔 Spending breakdown by category</li>
                <li>🏪 Your top merchants and frequency</li>
                <li>📊 Insights you can&apos;t get anywhere else</li>
              </ul>
            </div>
            
            <Button 
              onClick={generateAnalysis}
              size="lg"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 text-lg font-semibold"
            >
              Generate My Financial Analysis
            </Button>
            
            <p className="text-sm text-gray-500">
              This takes about 30-60 seconds • Powered by AI
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (analysisState === 'processing') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardContent className="text-center py-12 space-y-6">
            <ContentAreaLoader />
            
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-gray-800">
                Analyzing Your Finances
              </h2>
              <p className="text-lg text-gray-600">
                {progressMessage}
              </p>
              
              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-blue-600 h-3 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-gray-500">
                {progress}% complete
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (analysisState === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardContent className="text-center py-12 space-y-6">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100">
              <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-red-800">
                Analysis Failed
              </h2>
              <p className="text-gray-600">
                {error || 'Something went wrong while analyzing your transactions.'}
              </p>
              
              <div className="space-y-3">
                <Button 
                  onClick={generateAnalysis}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Try Again
                </Button>
                <Button 
                  onClick={continueToTransactions}
                  variant="outline"
                >
                  Continue Without Analysis
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Analysis complete - show results
  if (analysisState === 'complete' && analysis) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-3xl font-bold text-green-800">
                🎉 Your Financial Analysis
              </CardTitle>
              <p className="text-lg text-gray-600">
                Here&apos;s where your money goes • Based on {analysis.timeframe}
              </p>
            </CardHeader>
          </Card>

          {/* Category Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl font-semibold">📊 Spending by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analysis.categories.map((category, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{category.icon}</span>
                      <div>
                        <div className="font-semibold">{category.name}</div>
                        <div className="text-sm text-gray-500">
                          {category.count} transactions • ${(category.total / category.count).toFixed(2)} avg
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg">${category.total.toLocaleString()}</div>
                      <div className="text-sm text-gray-500">{category.percentage.toFixed(1)}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Top Merchants */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl font-semibold">🏪 Your Top Merchants</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analysis.merchants.map((merchant, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="font-bold text-lg text-gray-500">#{index + 1}</div>
                      <div>
                        <div className="font-semibold">{merchant.name}</div>
                        <div className="text-sm text-gray-500">
                          {merchant.category} • {merchant.count} transactions
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">${merchant.total.toLocaleString()}</div>
                      <div className="text-sm text-gray-500">
                        ${(merchant.total / merchant.count).toFixed(2)} avg
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Continue Button */}
          <Card>
            <CardContent className="text-center py-8">
              <Button 
                onClick={continueToTransactions}
                size="lg"
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 text-lg font-semibold"
              >
                View All Transactions →
              </Button>
              <p className="text-sm text-gray-500 mt-3">
                See your complete transaction history with AI categories
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return null;
}