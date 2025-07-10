import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/server';

export async function POST() {
  try {
    const supabase = await createSupabaseClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();

    // Get all active tagged merchants
    const { data: merchants, error: fetchError } = await supabase
      .from('tagged_merchants')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (fetchError) {
      console.error('Error fetching merchants:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch merchants' }, { status: 500 });
    }

    if (!merchants || merchants.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No active merchants found',
        updated_count: 0
      });
    }

    const updates = [];

    // Update each merchant's prediction based on their most recent transaction
    for (const merchant of merchants) {
      // Find the most recent transaction for this merchant
      const { data: recentTransactions } = await supabase
        .from('transactions')
        .select('date, amount')
        .or(`merchant_name.ilike.%${merchant.merchant_name}%,name.ilike.%${merchant.merchant_name}%`)
        .order('date', { ascending: false })
        .limit(1);

      if (!recentTransactions || recentTransactions.length === 0) {
        console.log(`No transactions found for ${merchant.merchant_name}, skipping`);
        continue;
      }

      const lastTransactionDate = new Date(recentTransactions[0].date);
      const lastAmount = Math.abs(recentTransactions[0].amount);
      
      // Calculate the next predicted date based on last transaction + frequency
      let nextDate: Date;
      
      switch (merchant.prediction_frequency) {
        case 'weekly':
          nextDate = new Date(lastTransactionDate.getTime() + 7 * 24 * 60 * 60 * 1000);
          break;
        case 'monthly':
          nextDate = new Date(lastTransactionDate.getFullYear(), lastTransactionDate.getMonth() + 1, lastTransactionDate.getDate());
          break;
        case 'bi-monthly':
          nextDate = new Date(lastTransactionDate.getFullYear(), lastTransactionDate.getMonth() + 2, lastTransactionDate.getDate());
          break;
        case 'quarterly':
          nextDate = new Date(lastTransactionDate.getFullYear(), lastTransactionDate.getMonth() + 3, lastTransactionDate.getDate());
          break;
        default:
          nextDate = new Date(lastTransactionDate.getFullYear(), lastTransactionDate.getMonth() + 1, lastTransactionDate.getDate());
      }

      // If the calculated date is still in the past, keep adding intervals until it's in the future
      while (nextDate <= now) {
        switch (merchant.prediction_frequency) {
          case 'weekly':
            nextDate = new Date(nextDate.getTime() + 7 * 24 * 60 * 60 * 1000);
            break;
          case 'monthly':
            nextDate = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, nextDate.getDate());
            break;
          case 'bi-monthly':
            nextDate = new Date(nextDate.getFullYear(), nextDate.getMonth() + 2, nextDate.getDate());
            break;
          case 'quarterly':
            nextDate = new Date(nextDate.getFullYear(), nextDate.getMonth() + 3, nextDate.getDate());
            break;
          default:
            nextDate = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, nextDate.getDate());
        }
      }

      // Update the merchant with new prediction and last transaction info
      const { error: updateError } = await supabase
        .from('tagged_merchants')
        .update({
          last_transaction_date: lastTransactionDate.toISOString().split('T')[0],
          next_predicted_date: nextDate.toISOString().split('T')[0],
          expected_amount: lastAmount, // Update expected amount based on most recent transaction
          updated_at: new Date().toISOString()
        })
        .eq('id', merchant.id);

      if (updateError) {
        console.error(`Error updating merchant ${merchant.merchant_name}:`, updateError);
      } else {
        updates.push({
          merchant_name: merchant.merchant_name,
          old_next_date: merchant.next_predicted_date,
          new_next_date: nextDate.toISOString().split('T')[0],
          last_transaction_date: lastTransactionDate.toISOString().split('T')[0],
          frequency: merchant.prediction_frequency,
          expected_amount: lastAmount,
          days_until_next: Math.ceil((nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        });
      }
    }

    // Sort updates by next date (soonest first)
    updates.sort((a, b) => new Date(a.new_next_date).getTime() - new Date(b.new_next_date).getTime());

    return NextResponse.json({
      success: true,
      message: `Updated predictions for ${updates.length} merchants based on most recent transactions`,
      updated_count: updates.length,
      updates: updates,
      summary: updates.map(u => `${u.merchant_name}: ${u.last_transaction_date} + ${u.frequency} = ${u.new_next_date} (${u.days_until_next} days)`).join('\n')
    });

  } catch (error) {
    console.error('Update predictions error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 