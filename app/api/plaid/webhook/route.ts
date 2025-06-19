import { NextRequest, NextResponse } from 'next/server';
import { plaidClient } from '@/utils/plaid/client';
import { createSupabaseServerClient, storeTransactions } from '@/utils/plaid/server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    // Use CORS headers
    
    const body = await request.json();
    
    console.log('🎯 WEBHOOK RECEIVED:', body);

    // Verify webhook (you should implement proper verification in production)
    // const signature = request.headers.get('plaid-signature');
    // TODO: Verify webhook signature

    const { webhook_type, webhook_code, item_id } = body;

    // Handle different webhook types
    switch (webhook_type) {
      case 'TRANSACTIONS':
        await handleTransactionWebhook(webhook_code, item_id, body);
        break;
      
      case 'ITEM':
        await handleItemWebhook(webhook_code, item_id, body);
        break;
      
      default:
        console.log(`Unhandled webhook type: ${webhook_type}`);
    }

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    console.error('❌ WEBHOOK ERROR:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500, headers: corsHeaders }
    );
  }
}

async function handleTransactionWebhook(webhook_code: string, item_id: string, body: Record<string, unknown>) {
  const supabase = createSupabaseServerClient();
  
  switch (webhook_code) {
    case 'INITIAL_UPDATE':
    case 'HISTORICAL_UPDATE':
    case 'DEFAULT_UPDATE':
      console.log(`🔄 Processing ${webhook_code} for item ${item_id}`);
      
      // Get access token for this item
      const { data: item } = await supabase
        .from('items')
        .select('plaid_access_token')
        .eq('plaid_item_id', item_id)
        .single();

      if (!item) {
        console.error(`❌ Item not found: ${item_id}`);
        return;
      }

      // Fetch new transactions
      try {
        const response = await plaidClient.transactionsGet({
          access_token: item.plaid_access_token,
          start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Last 30 days
          end_date: new Date().toISOString().split('T')[0],
        });

        // Store transactions in database
        await storeTransactions(response.data.transactions, item_id);
        
        console.log(`✅ WEBHOOK SUCCESS: Stored ${response.data.transactions.length} transactions for item ${item_id}`);
        
        // Send SMS notification via T-Mobile email gateway
        if (response.data.transactions.length > 0) {
          try {
            const latestTransaction = response.data.transactions[0];
            const message = `💳 BudgeNudge: ${response.data.transactions.length} new transaction(s)! Latest: $${Math.abs(latestTransaction.amount)} at ${latestTransaction.merchant_name || latestTransaction.name}`;
            
            const smsResponse = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: 'webhooks@budgenudge.com',
                to: ['6173472721@tmomail.net'],
                subject: '',
                text: message
              }),
            });
            
            if (smsResponse.ok) {
              console.log('📱 SMS notification sent successfully');
            } else {
              console.log('📱 SMS notification failed:', await smsResponse.text());
            }
          } catch (error) {
            console.log('📱 SMS notification error:', error);
          }
        }
      } catch (error) {
        console.error('❌ Error fetching transactions:', error);
      }
      break;

    case 'TRANSACTIONS_REMOVED':
      // Handle removed transactions
      const { removed_transactions } = body;
      if (removed_transactions && Array.isArray(removed_transactions) && removed_transactions.length > 0) {
        await supabase
          .from('transactions')
          .delete()
          .in('plaid_transaction_id', removed_transactions);
        
        console.log(`🗑️ Removed ${removed_transactions.length} transactions`);
      }
      break;

    default:
      console.log(`Unhandled transaction webhook code: ${webhook_code}`);
  }
}

async function handleItemWebhook(webhook_code: string, item_id: string, body: Record<string, unknown>) {
  const supabase = createSupabaseServerClient();

  switch (webhook_code) {
    case 'ERROR':
      console.error(`❌ Item error for ${item_id}:`, body.error);
      
      // Update item status
      await supabase
        .from('items')
        .update({ status: 'error' })
        .eq('plaid_item_id', item_id);
      break;

    case 'PENDING_EXPIRATION':
      console.log(`⚠️ Item ${item_id} has pending expiration`);
      
      // Update item status
      await supabase
        .from('items')
        .update({ status: 'pending_expiration' })
        .eq('plaid_item_id', item_id);
      break;

    default:
      console.log(`Unhandled item webhook code: ${webhook_code}`);
  }
} 