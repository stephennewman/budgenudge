import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/server';

interface Transaction {
  id: string;
  date: string;
  amount: number;
  name: string;
  merchant_name?: string;
  ai_merchant_name?: string;
  ai_category_tag?: string;
}

interface TransactionGroup {
  id: string;
  transactions: Transaction[];
  averageAmount: number;
  frequency: string;
  confidence: number;
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { merchant_id, groups }: { merchant_id: number; groups: TransactionGroup[] } = body;

    if (!merchant_id || !groups || groups.length === 0) {
      return NextResponse.json({ 
        error: 'merchant_id and groups are required' 
      }, { status: 400 });
    }

    // Get the original merchant
    const { data: originalMerchant, error: fetchError } = await supabase
      .from('tagged_merchants')
      .select('*')
      .eq('id', merchant_id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !originalMerchant) {
      return NextResponse.json({ 
        error: 'Merchant not found or access denied' 
      }, { status: 404 });
    }

    // Calculate next predicted dates for each group
    const calculateNextDate = (transactions: Transaction[], frequency: string): string => {
      if (transactions.length === 0) {
        const today = new Date();
        const nextDate = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
        return nextDate.toISOString().split('T')[0];
      }

      // Get the most recent transaction date
      const sortedTxs = transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const lastTransaction = new Date(sortedTxs[0].date);
      let nextDate: Date;

      switch (frequency) {
        case 'weekly':
          nextDate = new Date(lastTransaction.getTime() + 7 * 24 * 60 * 60 * 1000);
          break;
        case 'monthly':
          nextDate = new Date(lastTransaction.getFullYear(), lastTransaction.getMonth() + 1, lastTransaction.getDate());
          break;
        case 'bi-monthly':
          nextDate = new Date(lastTransaction.getFullYear(), lastTransaction.getMonth() + 2, lastTransaction.getDate());
          break;
        case 'quarterly':
          nextDate = new Date(lastTransaction.getFullYear(), lastTransaction.getMonth() + 3, lastTransaction.getDate());
          break;
        default:
          nextDate = new Date(lastTransaction.getFullYear(), lastTransaction.getMonth() + 1, lastTransaction.getDate());
      }

      // If predicted date is in the past, calculate from today
      const today = new Date();
      if (nextDate <= today) {
        switch (frequency) {
          case 'weekly':
            nextDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
            break;
          case 'monthly':
            nextDate = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
            break;
          case 'bi-monthly':
            nextDate = new Date(today.getFullYear(), today.getMonth() + 2, today.getDate());
            break;
          case 'quarterly':
            nextDate = new Date(today.getFullYear(), today.getMonth() + 3, today.getDate());
            break;
          default:
            nextDate = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
        }
      }

      return nextDate.toISOString().split('T')[0];
    };

    // Start transaction
    const { error: deactivateError } = await supabase
      .from('tagged_merchants')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', merchant_id)
      .eq('user_id', user.id);

    if (deactivateError) {
      console.error('Error deactivating original merchant:', deactivateError);
      return NextResponse.json({ 
        error: 'Failed to deactivate original merchant' 
      }, { status: 500 });
    }

    // Create new split accounts
    const newMerchants = [];
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      const accountIdentifier = (i + 1).toString();
      const nextPredictedDate = calculateNextDate(group.transactions, group.frequency);

      const { data: newMerchant, error: insertError } = await supabase
        .from('tagged_merchants')
        .insert({
          user_id: user.id,
          merchant_name: originalMerchant.merchant_name,
          merchant_pattern: originalMerchant.merchant_pattern,
          account_identifier: accountIdentifier,
          expected_amount: parseFloat(group.averageAmount.toFixed(2)),
          prediction_frequency: group.frequency,
          confidence_score: Math.round(group.confidence),
          auto_detected: false,
          is_active: true,
          next_predicted_date: nextPredictedDate,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating split merchant:', insertError);
        return NextResponse.json({ 
          error: `Failed to create split account ${accountIdentifier}` 
        }, { status: 500 });
      }

      // Store the specific transactions for this split merchant
      const transactionLinks = group.transactions.map(transaction => ({
        tagged_merchant_id: newMerchant.id,
        transaction_id: transaction.id,
        user_id: user.id,
        created_at: new Date().toISOString()
      }));

      console.log(`🔗 Linking ${transactionLinks.length} transactions to merchant ${newMerchant.id}:`, 
        transactionLinks.map(link => link.transaction_id));

      const { error: linkError } = await supabase
        .from('tagged_merchant_transactions')
        .insert(transactionLinks);

      if (linkError) {
        console.error('Error linking transactions to split merchant:', linkError);
        // Continue even if linking fails - the split merchant is created
      } else {
        console.log(`✅ Successfully linked ${transactionLinks.length} transactions to split merchant`);
      }

      newMerchants.push(newMerchant);
    }

    // Get AI merchant name if available
    let aiMerchantName = originalMerchant.merchant_name;
    if (originalMerchant.merchant_pattern) {
      const { data: aiData } = await supabase
        .from('merchant_ai_tags')
        .select('ai_merchant_name')
        .eq('merchant_pattern', originalMerchant.merchant_pattern)
        .single();
      
      if (aiData?.ai_merchant_name) {
        aiMerchantName = aiData.ai_merchant_name;
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `Successfully split ${aiMerchantName} into ${groups.length} accounts`,
      originalMerchant,
      newMerchants
    });

  } catch (error) {
    console.error('Split merchant error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 