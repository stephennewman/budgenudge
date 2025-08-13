import { createSupabaseClient } from '@/utils/supabase/server';
import { generateDailyReportV2 } from '@/utils/sms/templates';

export default async function SMSPreviewPage() {
  const supabase = await createSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto py-10">
        <h1 className="text-2xl font-semibold mb-4">Daily SMS Preview</h1>
        <p>Please sign in to view your daily SMS preview.</p>
      </div>
    );
  }

  let message = 'Loading...';
  try {
    message = await generateDailyReportV2(user.id);
  } catch {
    message = 'Failed to generate preview.';
  }

  return (
    <div className="max-w-3xl mx-auto py-10">
      <h1 className="text-2xl font-semibold mb-4">Daily SMS Preview</h1>
      <div className="rounded-md border p-4 whitespace-pre-wrap">
        {message}
      </div>
      <p className="text-sm text-gray-500 mt-3">
        Generated at {new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })}
      </p>
    </div>
  );
}


