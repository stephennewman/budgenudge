// DISABLED FOR PERFORMANCE - Heavy predictive calendar feature
// import UpcomingBillsTable from '@/components/upcoming-bills-table';

export default function CalendarPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-gray-600 mb-4">📅 Predictive Calendar</h1>
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
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Upcoming Bill Predictions</h1>
          <p className="text-muted-foreground">Predicted recurring bills sorted by upcoming date</p>
        </div>
        <UpcomingBillsTable />
      </div>
      */}
    </div>
  );
} 