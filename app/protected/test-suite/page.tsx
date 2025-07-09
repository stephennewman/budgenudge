import TestRunner from '@/components/test-runner';

export default function TestSuitePage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">🧪 System Testing</h1>
        <p className="text-gray-600">
          Test all recent deployment fixes and verify system health. This test suite validates 
          the 6 critical fixes deployed on January 9, 2025.
        </p>
      </div>

      <TestRunner />

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-3">📋 Manual Testing Checklist</h3>
        <div className="space-y-3 text-sm">
          <div>
            <h4 className="font-medium text-blue-800 mb-1">1. Sign-up Flow Test</h4>
            <p className="text-blue-700">
              • Open new incognito window → Sign up → Should redirect to check-email page (not sign-in)
            </p>
          </div>
          
          <div>
            <h4 className="font-medium text-blue-800 mb-1">2. Email Confirmation Test</h4>
            <p className="text-blue-700">
              • Click email confirmation link → Should auto-login and redirect to protected area
            </p>
          </div>
          
          <div>
            <h4 className="font-medium text-blue-800 mb-1">3. New User Onboarding Test</h4>
            <p className="text-blue-700">
              • New user should see welcome screen with bank connection requirement
            </p>
          </div>
          
          <div>
            <h4 className="font-medium text-blue-800 mb-1">4. User Data Isolation Test</h4>
            <p className="text-blue-700">
              • Check calendar page → Should only show YOUR transactions, not other users'
            </p>
          </div>
          
          <div>
            <h4 className="font-medium text-blue-800 mb-1">5. SMS System Test</h4>
            <p className="text-blue-700">
              • Use "Test SMS" button → Should send to YOUR phone number, not hardcoded 617-347-2721
            </p>
          </div>
          
          <div>
            <h4 className="font-medium text-blue-800 mb-1">6. Webhook Test</h4>
            <p className="text-blue-700">
              • Make a real transaction → Should appear in dashboard within 5 seconds + SMS notification
            </p>
          </div>
        </div>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <h3 className="font-semibold text-green-900 mb-3">🎯 Quick Tests</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <h4 className="font-medium text-green-800 mb-2">API Tests</h4>
            <ul className="space-y-1 text-green-700">
              <li>• <a href="/api/test-sms" className="underline" target="_blank">Test SMS API</a></li>
              <li>• Check database connectivity</li>
              <li>• Verify user authentication</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-medium text-green-800 mb-2">UI Tests</h4>
            <ul className="space-y-1 text-green-700">
              <li>• <a href="/protected/calendar" className="underline">Calendar page</a></li>
              <li>• <a href="/protected/transactions" className="underline">Transactions page</a></li>
              <li>• <a href="/sign-out" className="underline">Sign out flow</a></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
} 