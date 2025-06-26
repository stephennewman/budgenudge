import UpcomingBillsTable from '@/components/upcoming-bills-table';

export default function CalendarPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Upcoming Bill Predictions</h1>
          <p className="text-muted-foreground">Predicted recurring bills sorted by upcoming date</p>
        </div>
        <UpcomingBillsTable />
      </div>
    </div>
  );
} 