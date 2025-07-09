'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'skip';
  message: string;
  duration: number;
}

interface TestSuite {
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  results: TestResult[];
}

interface TestResponse {
  success: boolean;
  summary: TestSuite;
  message: string;
}

export default function TestRunner() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<TestResponse | null>(null);

  const runTests = async () => {
    setIsRunning(true);
    setResults(null);

    try {
      const response = await fetch('/api/run-tests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data: TestResponse = await response.json();
      setResults(data);
    } catch (error) {
      setResults({
        success: false,
        summary: {
          totalTests: 0,
          passed: 0,
          failed: 1,
          skipped: 0,
          duration: 0,
          results: [{
            name: 'Test Suite Execution',
            status: 'fail',
            message: error instanceof Error ? error.message : 'Unknown error',
            duration: 0
          }]
        },
        message: 'Failed to run test suite'
      });
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: 'pass' | 'fail' | 'skip') => {
    switch (status) {
      case 'pass': return '✅';
      case 'fail': return '❌';
      case 'skip': return '⏭️';
    }
  };

  const getStatusColor = (status: 'pass' | 'fail' | 'skip') => {
    switch (status) {
      case 'pass': return 'text-green-600';
      case 'fail': return 'text-red-600';
      case 'skip': return 'text-yellow-600';
    }
  };

  return (
    <Card className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">🧪 BudgeNudge Test Suite</h2>
        <p className="text-gray-600">
          Comprehensive testing for all 6 deployment fixes: signup redirect, email confirmation, 
          onboarding flow, user data isolation, dynamic SMS, and webhook restoration.
        </p>
      </div>

      <div className="mb-6">
        <Button 
          onClick={runTests} 
          disabled={isRunning}
          className="w-full sm:w-auto"
        >
          {isRunning ? '🔄 Running Tests...' : '🚀 Run Test Suite'}
        </Button>
      </div>

      {results && (
        <div className="space-y-4">
          {/* Summary */}
          <Card className={`p-4 ${results.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-lg">{results.message}</h3>
              <span className="text-sm text-gray-500">
                {results.summary.duration}ms
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="font-medium">Total Tests</div>
                <div className="text-gray-600">{results.summary.totalTests}</div>
              </div>
              <div>
                <div className="font-medium text-green-600">Passed</div>
                <div className="text-green-700">{results.summary.passed}</div>
              </div>
              <div>
                <div className="font-medium text-red-600">Failed</div>
                <div className="text-red-700">{results.summary.failed}</div>
              </div>
              <div>
                <div className="font-medium text-yellow-600">Skipped</div>
                <div className="text-yellow-700">{results.summary.skipped}</div>
              </div>
            </div>
          </Card>

          {/* Detailed Results */}
          <div className="space-y-2">
            <h4 className="font-semibold">Test Results</h4>
            {results.summary.results.map((result, index) => (
              <Card key={index} className="p-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <span className="text-lg">{getStatusIcon(result.status)}</span>
                    <div>
                      <div className={`font-medium ${getStatusColor(result.status)}`}>
                        {result.name}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        {result.message}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">
                    {result.duration}ms
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 text-sm text-gray-500">
        <p className="mb-2"><strong>What this tests:</strong></p>
        <ul className="list-disc list-inside space-y-1">
          <li>Database connectivity and schema validation</li>
          <li>SMS carrier detection and phone lookup systems</li>
          <li>API route accessibility and structure</li>
          <li>User data isolation and security</li>
          <li>Auth callback route configuration</li>
          <li>Real SMS delivery via Resend API</li>
        </ul>
      </div>
    </Card>
  );
} 