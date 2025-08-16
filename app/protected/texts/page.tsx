import { createSupabaseClient } from '@/utils/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { generateDailyReportV2, generateSMSMessage } from '@/utils/sms/templates';
import SendTestSMSButton from '@/components/send-test-sms-button';
import AddRecipientButton from '@/components/add-recipient-button';
import RecipientsPanel from '@/components/recipients-panel';

export default async function TextsPage() {
  const supabase = await createSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto py-10">
        <h1 className="text-2xl font-semibold mb-4">Texts</h1>
        <p>Please sign in to view SMS previews.</p>
      </div>
    );
  }

  let krezz = 'Loading...';
  let weekly = 'Loading...';
  let monthly = 'Loading...';
  let bogoDinnerPlan = 'Loading...';

  try {
    // Live templates only
    krezz = await generateDailyReportV2(user.id);
  } catch {
    krezz = 'Failed to generate Krezzo report preview.';
  }
  try {
    weekly = await generateSMSMessage(user.id, 'weekly-summary');
  } catch {
    weekly = 'Failed to generate weekly summary preview.';
  }
  try {
    monthly = await generateSMSMessage(user.id, 'monthly-summary');
  } catch {
    monthly = 'Failed to generate monthly summary preview.';
  }
  try {
    bogoDinnerPlan = await generateSMSMessage(user.id, 'bogo-dinner-plan');
  } catch {
    bogoDinnerPlan = 'Failed to generate BOGO dinner plan preview.';
  }

  return (
    <div className="max-w-4xl mx-auto py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">📱 Texts</h1>
        <p className="text-muted-foreground mt-2">
          These are the live SMS templates.
          <br />
          Daily Krezzo report is sent at <span className="font-semibold">5:00 PM ET</span>. Weekly and monthly summaries are sent at <span className="font-semibold">7:00 AM ET</span>.
        </p>
      </div>

      {/* Krezzo Report */}
      <Card>
        <CardContent className="p-6 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Krezzo Report (Daily)</h2>
              <p className="text-sm text-muted-foreground">Sent every day at 5:00 PM Eastern</p>
            </div>
            <div className="flex items-center gap-2">
              <SendTestSMSButton userId={user.id} templateType="415pm-special" label="Send to my phone" />
              <AddRecipientButton />
            </div>
          </div>
          <div className="rounded-md border p-4 whitespace-pre-wrap text-sm">
            {krezz}
          </div>
        </CardContent>
      </Card>

      {/* Weekly Summary */}
      <Card>
        <CardContent className="p-6 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Weekly Summary</h2>
              <p className="text-sm text-muted-foreground">Sent every Sunday at 7:00 AM Eastern</p>
            </div>
            <SendTestSMSButton userId={user.id} templateType="weekly-summary" label="Send to my phone" />
          </div>
          <div className="rounded-md border p-4 whitespace-pre-wrap text-sm">
            {weekly}
          </div>
        </CardContent>
      </Card>

      {/* Monthly Summary */}
      <Card>
        <CardContent className="p-6 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Monthly Summary</h2>
              <p className="text-sm text-muted-foreground">Sent on the 1st at 7:00 AM Eastern</p>
            </div>
            <SendTestSMSButton userId={user.id} templateType="monthly-summary" label="Send to my phone" />
          </div>
          <div className="rounded-md border p-4 whitespace-pre-wrap text-sm">
            {monthly}
          </div>
        </CardContent>
      </Card>

      {/* BOGO Dinner Plan */}
      <Card>
        <CardContent className="p-6 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">BOGO Dinner Plan</h2>
              <p className="text-sm text-muted-foreground">Sample meal plan using only BOGO deals</p>
            </div>
            <SendTestSMSButton userId={user.id} templateType="bogo-dinner-plan" label="Send to my phone" />
          </div>
          <div className="rounded-md border p-4 whitespace-pre-wrap text-sm">
            {bogoDinnerPlan}
          </div>
        </CardContent>
      </Card>

      {/* Recipients management moved to bottom */}
      <RecipientsPanel />
    </div>
  );
}


