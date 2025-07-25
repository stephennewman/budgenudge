// DISABLED FOR PERFORMANCE - Heavy analytics feature
// import WeeklySpendingDashboard from '@/components/weekly-spending-dashboard';

export default function WeeklySpendingPage() {
  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="text-center py-12">
        <h1 className="text-2xl font-medium text-gray-600 mb-4">📊 Weekly Spending Analytics</h1>
        <p className="text-gray-500 mb-6">This feature has been temporarily disabled to improve app performance.</p>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-w-md mx-auto">
          <p className="text-sm text-yellow-700">
            <strong>Core functionality available:</strong><br/>
            • Real-time transaction monitoring<br/>
            • SMS notifications<br/>
            • Basic transaction dashboard
          </p>
        </div>
      </div>
      {/* COMMENTED OUT FOR PERFORMANCE:
      <WeeklySpendingDashboard />
      */}
    </div>
  );
} 