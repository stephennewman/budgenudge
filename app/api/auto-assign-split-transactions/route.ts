import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/server';

interface SplitMerchant {
  id: number;
  merchant_name: string;
  account_identifier: string;
  expected_amount: number;
  prediction_frequency: string;
  confidence_score: number;
}

interface Transaction {
  id: number;
  plaid_transaction_id: string;
  date: string;
  amount: number;
  name: string;
  merchant_name?: string;
  ai_merchant_name?: string;
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
    const { merchant_name, dry_run = false } = body;

    if (!merchant_name) {
      return NextResponse.json({ error: 'merchant_name is required' }, { status: 400 });
    }

    // Get all split merchants for this merchant name
    const { data: splitMerchants, error: splitError } = await supabase
      .from('tagged_merchants')
      .select('*')
      .eq('user_id', user.id)
      .eq('merchant_name', merchant_name)
      .not('account_identifier', 'is', null)
      .eq('is_active', true);

    if (splitError || !splitMerchants?.length) {
      return NextResponse.json({ 
        error: 'No split merchants found for this merchant name' 
      }, { status: 404 });
    }

    // Get user's items for transaction filtering
    const { data: items } = await supabase
      .from('items')
      .select('plaid_item_id')
      .eq('user_id', user.id);

    const itemIds = items?.map(item => item.plaid_item_id) || [];

    // Get unassigned transactions for this merchant (not in tagged_merchant_transactions)
    const { data: allTransactions } = await supabase
      .from('transactions')
      .select('id, plaid_transaction_id, date, amount, name, merchant_name, ai_merchant_name')
      .in('plaid_item_id', itemIds)
      .or(`merchant_name.ilike.%${merchant_name}%,name.ilike.%${merchant_name}%,ai_merchant_name.ilike.%${merchant_name}%`)
      .order('date', { ascending: false });

    // Get already assigned transaction IDs
    const { data: assignedTransactions } = await supabase
      .from('tagged_merchant_transactions')
      .select('transaction_id')
      .eq('user_id', user.id);

    const assignedIds = new Set(assignedTransactions?.map(at => at.transaction_id) || []);
    
    // Filter to only unassigned transactions
    const unassignedTransactions = (allTransactions || []).filter(
      tx => !assignedIds.has(tx.plaid_transaction_id)
    );

    // Auto-assign transactions to split merchants
    const assignments = [];
    for (const transaction of unassignedTransactions) {
      const assignment = assignTransactionToSplit(transaction, splitMerchants);
      if (assignment) {
        assignments.push(assignment);
      }
    }

    // Sort by confidence (highest first)
    assignments.sort((a, b) => b.confidence - a.confidence);

    if (!dry_run) {
      // Actually create the assignments for high-confidence matches
      const highConfidenceAssignments = assignments.filter(a => a.confidence >= 80);
      
      if (highConfidenceAssignments.length > 0) {
        const transactionLinks = highConfidenceAssignments.map(assignment => ({
          tagged_merchant_id: assignment.split_merchant_id,
          transaction_id: assignment.transaction_id,
          user_id: user.id,
          created_at: new Date().toISOString()
        }));

        const { error: insertError } = await supabase
          .from('tagged_merchant_transactions')
          .insert(transactionLinks);

        if (insertError) {
          console.error('Error auto-assigning transactions:', insertError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      merchant_name,
      split_merchants: splitMerchants.length,
      unassigned_transactions: unassignedTransactions.length,
      potential_assignments: assignments.length,
      high_confidence_assignments: assignments.filter(a => a.confidence >= 80).length,
      assignments: assignments.slice(0, 20), // Return top 20 for review
      dry_run
    });

  } catch (error) {
    console.error('Auto-assign split transactions error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

function assignTransactionToSplit(
  transaction: Transaction, 
  splitMerchants: SplitMerchant[]
): { 
  transaction_id: string; 
  split_merchant_id: number; 
  confidence: number; 
  reason: string;
  amount_match: number;
  split_account: string;
} | null {
  
  const txAmount = Math.abs(transaction.amount);
  let bestMatch = null;
  let highestConfidence = 0;

  for (const splitMerchant of splitMerchants) {
    let confidence = 0;
    const reasons = [];

    // Amount similarity (most important factor)
    const amountDiff = Math.abs(txAmount - splitMerchant.expected_amount);
    const amountPercentDiff = amountDiff / splitMerchant.expected_amount;
    
    if (amountPercentDiff <= 0.05) { // Within 5%
      confidence += 60;
      reasons.push('exact amount match');
    } else if (amountPercentDiff <= 0.15) { // Within 15%
      confidence += 40;
      reasons.push('close amount match');
    } else if (amountPercentDiff <= 0.30) { // Within 30%
      confidence += 20;
      reasons.push('similar amount');
    }

    // Date pattern analysis (for recurring bills)
    const dayOfMonth = new Date(transaction.date).getDate();
    if (splitMerchant.prediction_frequency === 'monthly') {
      // Monthly bills often happen on the same day of month
      if (dayOfMonth >= 1 && dayOfMonth <= 5) {
        confidence += 10;
        reasons.push('early month pattern');
      } else if (dayOfMonth >= 28) {
        confidence += 10;
        reasons.push('end month pattern');
      }
    }

    // Merchant confidence score boost
    confidence += Math.min(20, splitMerchant.confidence_score / 5);

    if (confidence > highestConfidence) {
      highestConfidence = confidence;
      bestMatch = {
        transaction_id: transaction.plaid_transaction_id,
        split_merchant_id: splitMerchant.id,
        confidence: Math.round(confidence),
        reason: reasons.join(', '),
        amount_match: Math.round((1 - amountPercentDiff) * 100),
        split_account: `${splitMerchant.merchant_name} ${splitMerchant.account_identifier}`
      };
    }
  }

  // Only return assignments with reasonable confidence
  return bestMatch && highestConfidence >= 30 ? bestMatch : null;
} 