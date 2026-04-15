import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { keep_id, remove_id } = await request.json();

    if (!keep_id || !remove_id) {
      return NextResponse.json({ error: 'keep_id and remove_id are required' }, { status: 400 });
    }

    if (keep_id === remove_id) {
      return NextResponse.json({ error: 'Cannot merge a bill with itself' }, { status: 400 });
    }

    const { data: bills, error: fetchErr } = await supabase
      .from('tagged_merchants')
      .select('*')
      .in('id', [keep_id, remove_id])
      .eq('user_id', user.id);

    if (fetchErr || !bills || bills.length !== 2) {
      return NextResponse.json({ error: 'One or both bills not found' }, { status: 404 });
    }

    const keepBill = bills.find(b => b.id === keep_id);
    const removeBill = bills.find(b => b.id === remove_id);

    if (!keepBill || !removeBill) {
      return NextResponse.json({ error: 'Bill lookup mismatch' }, { status: 404 });
    }

    // Transfer any linked transactions from the removed bill to the kept one
    await supabase
      .from('tagged_merchant_transactions')
      .update({ tagged_merchant_id: keep_id })
      .eq('tagged_merchant_id', remove_id)
      .eq('user_id', user.id);

    // Use the higher occurrence count and better stats
    const mergedOccurrences = (keepBill.occurrence_count || 0) + (removeBill.occurrence_count || 0);
    const betterConfidence = Math.max(keepBill.confidence_score || 0, removeBill.confidence_score || 0);

    await supabase
      .from('tagged_merchants')
      .update({
        occurrence_count: mergedOccurrences,
        confidence_score: betterConfidence,
        updated_at: new Date().toISOString()
      })
      .eq('id', keep_id)
      .eq('user_id', user.id);

    // Deactivate the removed bill
    await supabase
      .from('tagged_merchants')
      .update({
        is_active: false,
        lifecycle_state: 'merged',
        updated_at: new Date().toISOString()
      })
      .eq('id', remove_id)
      .eq('user_id', user.id);

    return NextResponse.json({
      success: true,
      message: `Merged "${removeBill.merchant_name}" into "${keepBill.merchant_name}"`,
      kept: keepBill.merchant_name,
      removed: removeBill.merchant_name
    });

  } catch (error) {
    console.error('Merge error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
