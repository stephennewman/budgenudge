import AIIncomeChat from '@/components/ai-income-chat';

export default function IncomeSetupPage() {
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <h1 className="text-3xl font-bold text-gray-900">💰 Income Profile Setup</h1>
            <p className="mt-2 text-gray-600">
              Chat with our AI to configure your personalized SMS insights based on your income schedule.
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <AIIncomeChat />
        </div>

        {/* Help Section */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-800 mb-3">💡 How This Works</h3>
          <div className="space-y-3 text-sm text-blue-700">
            <p><strong>1. Natural Conversation:</strong> Just tell the AI when you get paid in your own words</p>
            <p><strong>2. Smart Understanding:</strong> It recognizes patterns like &quot;bi-weekly&quot;, &quot;15th and last day&quot;, &quot;every Friday&quot;</p>
            <p><strong>3. Multiple Income Sources:</strong> Perfect for couples with different pay schedules</p>
            <p><strong>4. Business Day Rules:</strong> Handles complex rules like &quot;15th or preceding business day&quot;</p>
            <p><strong>5. Personalized SMS:</strong> Your insights will be timed to YOUR specific paycheck schedule</p>
          </div>
        </div>

        {/* Examples */}
        <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">💬 Example Conversations</h3>
          <div className="space-y-4 text-sm">
            <div className="bg-white rounded p-3 border-l-4 border-blue-500">
              <p className="font-medium text-gray-700">User:</p>
              <p className="text-gray-600">&quot;I get paid twice a month on the 15th and last day&quot;</p>
            </div>
            <div className="bg-white rounded p-3 border-l-4 border-green-500">
              <p className="font-medium text-gray-700">User:</p>
              <p className="text-gray-600">&quot;My wife gets paid every other Friday, I get paid bi-monthly&quot;</p>
            </div>
            <div className="bg-white rounded p-3 border-l-4 border-purple-500">
              <p className="font-medium text-gray-700">User:</p>
              <p className="text-gray-600">&quot;Weekly paycheck on Fridays, but if Friday is a holiday it comes Thursday&quot;</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 