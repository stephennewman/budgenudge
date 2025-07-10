import RecurringBillsManager from '@/components/recurring-bills-manager';
import { createSupabaseClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

export default async function RecurringBillsPage() {
  // Ensure user is authenticated
  const supabase = await createSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/sign-in');
  }

  return (
    <div className="max-w-6xl mx-auto">
      <RecurringBillsManager />
    </div>
  );
} 