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
          start_date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Last 90 days
          end_date: new Date().toISOString().split('T')[0],
        });

        // Store transactions in database
        await storeTransactions(response.data.transactions, item_id);
        
        console.log(`✅ WEBHOOK SUCCESS: Stored ${response.data.transactions.length} transactions for item ${item_id}`);
        
        // Send SMS notification via T-Mobile email gateway
        if (response.data.transactions.length > 0) {
          try {
            // Get all historical transactions for analysis
            const { data: allTransactions } = await supabase
              .from('transactions')
              .select('*')
              .order('date', { ascending: false });

            const message = await buildAdvancedSMSMessage(allTransactions || []);
            
            const smsResponse = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: 'BudgeNudge <noreply@krezzo.com>',
                to: ['6173472721@tmomail.net'],
                subject: 'BudgeNudge Alert!',
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

interface Transaction {
  date: string;
  merchant_name?: string;
  name: string;
  amount: number;
}

async function buildAdvancedSMSMessage(allTransactions: Transaction[]): Promise<string> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // 1. UPCOMING BILLS - Find recurring bills
  const upcomingBills = findUpcomingBills(allTransactions);
  let billsSection = '💳 UPCOMING BILLS:\n';
  upcomingBills.slice(0, 4).forEach(bill => {
    const date = new Date(bill.predictedDate);
    const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
    const dayStr = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
    billsSection += `${dateStr} (${dayStr}): ${bill.merchant} ${bill.amount}\n`;
  });
  
  // 2. PUBLIX THIS WEEK
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6); // End of week (Saturday)
  
  const publixThisWeek = allTransactions
    .filter(t => {
      const transDate = new Date(t.date);
      return (t.merchant_name || t.name || '').toLowerCase().includes('publix') && 
             transDate >= weekStart && transDate <= weekEnd;
    })
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  
  // Calculate average weekly Publix spending (last 8 weeks)
  const avgPublixWeekly = calculateAverageWeeklyPublix(allTransactions);
  const publixDiff = publixThisWeek - avgPublixWeekly;
  const publixPercent = avgPublixWeekly > 0 ? Math.round((publixDiff / avgPublixWeekly) * 100) : 0;
  
  const weekStartStr = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;
  const weekEndStr = `${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`;
  let publixSection = `\n🏪 PUBLIX THIS WEEK (${weekStartStr}-${weekEndStr}):\n`;
  publixSection += `$${publixThisWeek.toFixed(2)} vs $${avgPublixWeekly.toFixed(2)} avg`;
  if (publixPercent > 0) {
    publixSection += ` (+${publixPercent}% over)`;
  } else if (publixPercent < 0) {
    publixSection += ` (${publixPercent}% under)`;
  }
  
  // 3. LAST 10 TRANSACTIONS
  let recentSection = '\n\n📋 LAST 10 TRANSACTIONS:\n';
  allTransactions.slice(0, 10).forEach(t => {
    const transDate = new Date(t.date);
    const dateStr = `${transDate.getMonth() + 1}/${transDate.getDate()}`;
    const merchant = t.merchant_name || t.name || 'Unknown';
    recentSection += `${dateStr}: ${merchant} $${Math.abs(t.amount)}\n`;
  });
  
  return billsSection + publixSection + recentSection;
}

interface Bill {
  merchant: string;
  amount: string;
  predictedDate: Date;
  confidence: string;
}

function findUpcomingBills(transactions: Transaction[]): Bill[] {
  // Group transactions by merchant
  const merchantGroups: { [key: string]: Transaction[] } = {};
  transactions.forEach(t => {
    const merchant = (t.merchant_name || t.name || '').toLowerCase();
    if (!merchantGroups[merchant]) merchantGroups[merchant] = [];
    merchantGroups[merchant].push(t);
  });
  
  const bills: Bill[] = [];
  const now = new Date();
  
  // Look for recurring patterns
  Object.entries(merchantGroups).forEach(([merchant, merchantTransactions]) => {
    if (merchantTransactions.length < 2) return;
    
    // Sort by date
    merchantTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    // Check for monthly recurring bills (Netflix, utilities, etc.)
    const intervals: number[] = [];
    for (let i = 0; i < merchantTransactions.length - 1; i++) {
      const date1 = new Date(merchantTransactions[i].date);
      const date2 = new Date(merchantTransactions[i + 1].date);
      const diffDays = Math.abs((date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24));
      intervals.push(diffDays);
    }
    
    // Check if intervals suggest monthly billing (25-35 days)
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    if (avgInterval >= 25 && avgInterval <= 35 && intervals.length >= 2) {
      const lastTransaction = merchantTransactions[0];
      const lastDate = new Date(lastTransaction.date);
      const predictedNext = new Date(lastDate);
      predictedNext.setDate(predictedNext.getDate() + Math.round(avgInterval));
      
      // Only include if predicted date is in future
      if (predictedNext > now) {
        bills.push({
          merchant: merchant.charAt(0).toUpperCase() + merchant.slice(1),
          amount: `$${Math.abs(lastTransaction.amount).toFixed(2)}`,
          predictedDate: predictedNext,
          confidence: 'monthly'
        });
      }
    }
  });
  
  // Sort by predicted date
  return bills.sort((a, b) => a.predictedDate.getTime() - b.predictedDate.getTime());
}

function calculateAverageWeeklyPublix(transactions: Transaction[]): number {
  const now = new Date();
  const eightWeeksAgo = new Date(now);
  eightWeeksAgo.setDate(now.getDate() - 56); // 8 weeks ago
  
  const publixTransactions = transactions.filter(t => {
    const transDate = new Date(t.date);
    return (t.merchant_name || t.name || '').toLowerCase().includes('publix') && 
           transDate >= eightWeeksAgo && transDate <= now;
  });
  
  if (publixTransactions.length === 0) return 0;
  
  const totalSpent = publixTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  return totalSpent / 8; // Average over 8 weeks
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