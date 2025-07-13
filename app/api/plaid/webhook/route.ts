import { NextRequest, NextResponse } from 'next/server';
import { plaidClient } from '@/utils/plaid/client';
import { createSupabaseServerClient, storeTransactions } from '@/utils/plaid/server';
import { createClient } from '@supabase/supabase-js';
import { sendEnhancedSlickTextSMS } from '@/utils/sms/slicktext-client';

// Set timeout to 60 seconds for Hobby plan (prevents 503 errors)
export const maxDuration = 60;

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
    console.log(`🕐 WEBHOOK TIMESTAMP: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} EST`);

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
      
      // Get access token for this item and verify it exists
      const { data: item } = await supabase
        .from('items')
        .select('plaid_access_token, plaid_item_id')
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

        // Store transactions in database using the verified database plaid_item_id
        await storeTransactions(response.data.transactions, item.plaid_item_id);
        
        // Update account balances
        try {
          const accountsResponse = await plaidClient.accountsGet({
            access_token: item.plaid_access_token,
          });

          const supabaseService = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          );

          for (const account of accountsResponse.data.accounts) {
            const balance = account.balances;
            
            console.log(`💰 Updating balance for ${account.name}: Current=$${balance.current}, Available=$${balance.available}`);
            
            await supabaseService
              .from('accounts')
              .update({
                current_balance: balance.current,
                available_balance: balance.available,
                iso_currency_code: balance.iso_currency_code || 'USD',
                balance_last_updated: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('plaid_account_id', account.account_id);
          }
          console.log(`💰 ✅ Successfully updated balances for ${accountsResponse.data.accounts.length} accounts`);
        } catch (error) {
          console.error('❌ Error updating balances:', error);
        }
        
        console.log(`✅ WEBHOOK SUCCESS: Stored ${response.data.transactions.length} transactions for item ${item_id}`);
        
        // Send SMS notification via T-Mobile email gateway
        if (response.data.transactions.length > 0) {
          console.log(`📱 NEW TRANSACTIONS FOUND: Sending SMS for ${response.data.transactions.length} transactions`);
          try {
            // Get user ID from item first
            const { data: itemData } = await supabase
              .from('items')
              .select('user_id')
              .eq('plaid_item_id', item_id)
              .single();
            
            // Get all user's items for filtering
            const { data: userItems } = await supabase
              .from('items')
              .select('plaid_item_id')
              .eq('user_id', itemData?.user_id);
              
            const userItemIds = userItems?.map(item => item.plaid_item_id) || [];
            
            // Get ONLY this user's transactions for analysis
            const { data: allTransactions } = await supabase
              .from('transactions')
              .select('*')
              .in('plaid_item_id', userItemIds)
              .order('date', { ascending: false });
            
            const message = await buildAdvancedSMSMessage(allTransactions || [], itemData?.user_id);
            
            // Get user's email for SlickText contact lookup
            // Note: Using service role client to access auth data
            const supabaseService = createClient(
              process.env.NEXT_PUBLIC_SUPABASE_URL!,
              process.env.SUPABASE_SERVICE_ROLE_KEY!
            );
            
            const { data: userData } = await supabaseService.auth.admin.getUserById(itemData?.user_id);
            
            console.log(`📱 Sending SMS via SlickText to: 6173472721`);
            
                         // Send SMS via SlickText
             const smsResult = await sendEnhancedSlickTextSMS({
               phoneNumber: '6173472721', // Your phone number
               message: message,
               userId: itemData?.user_id,
               userEmail: userData?.user?.email || 'stephen@krezzo.com'
             });
            
            if (smsResult.success) {
              console.log('📱 SlickText SMS notification sent successfully:', smsResult.messageId);
            } else {
              console.log('📱 SlickText SMS notification failed:', smsResult.error);
            }
          } catch (error) {
            console.log('📱 SMS notification error:', error);
          }
        } else {
          console.log(`📱 NO NEW TRANSACTIONS: Webhook fired but found ${response.data.transactions.length} new transactions - no SMS sent`);
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

async function buildAdvancedSMSMessage(allTransactions: Transaction[], userId: string): Promise<string> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // Fetch current account balances
  let totalAvailable = 0;
  if (userId) {
    try {
      const { data: userItems } = await supabase
        .from('items')
        .select('id')
        .eq('user_id', userId);
      
      if (userItems && userItems.length > 0) {
        const itemIds = userItems.map((item: { id: number }) => item.id);
        
        const { data: accounts } = await supabase
          .from('accounts')
          .select('available_balance')
          .in('item_id', itemIds)
          .eq('type', 'depository');
        
        if (accounts && accounts.length > 0) {
          totalAvailable = accounts.reduce((sum: number, acc: { available_balance: number | null }) => sum + (acc.available_balance || 0), 0);
        }
      }
    } catch (error) {
      console.error('Error fetching balances for SMS:', error);
    }
  }
  
  // Get next 6 most important bills - ONLY from tagged merchants (recurring bills)
  const upcomingBills = await findUpcomingRecurringBills(userId);
  const thirtyDaysFromNow = new Date(now);
  thirtyDaysFromNow.setDate(now.getDate() + 30);
  
  let billsSection = '💳 NEXT BILLS:\n';
  upcomingBills
    .filter(bill => bill.predictedDate <= thirtyDaysFromNow)
    .slice(0, 6)
    .forEach(bill => {
      const date = new Date(bill.predictedDate);
      const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
      const dayStr = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
      const confidenceIcon = bill.confidence === 'tagged' ? '🏷️' : bill.confidence === 'monthly' ? '🗓️' : '📊';
      billsSection += `${dateStr} (${dayStr}): ${bill.merchant} ${bill.amount} ${confidenceIcon}\n`;
    });
  
  // Monthly calculations
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  
  const publixThisMonth = allTransactions
    .filter(t => {
      const transDate = new Date(t.date);
      return (t.merchant_name || t.name || '').toLowerCase().includes('publix') && 
             transDate >= monthStart && transDate <= monthEnd;
    })
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  
  const amazonThisMonth = allTransactions
    .filter(t => {
      const transDate = new Date(t.date);
      return (t.merchant_name || t.name || '').toLowerCase().includes('amazon') && 
             transDate >= monthStart && transDate <= monthEnd;
    })
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  
  // Calculate paced spending
  const avgPublixWeekly = calculateAverageWeeklyPublix(allTransactions);
  const avgPublixMonthly = avgPublixWeekly * 4.33;
  const avgAmazonWeekly = calculateAverageWeeklyAmazon(allTransactions);
  const avgAmazonMonthly = avgAmazonWeekly * 4.33;
  
  const daysInMonth = monthEnd.getDate();
  const monthDaysElapsed = today.getDate();
  const publixPacedTarget = (avgPublixMonthly / daysInMonth) * monthDaysElapsed;
  const amazonPacedTarget = (avgAmazonMonthly / daysInMonth) * monthDaysElapsed;
  
  const publixPacedDiff = publixThisMonth - publixPacedTarget;
  const amazonPacedDiff = amazonThisMonth - amazonPacedTarget;
  
  // AI Recommendation
  let recommendation = '';
  if (publixPacedDiff > 50 || amazonPacedDiff > 50) {
    recommendation = 'Consider reducing impulse purchases this month';
  } else if (publixThisMonth > 400 || amazonThisMonth > 300) {
    recommendation = 'Budget running low - focus on essentials only';
  } else if (publixPacedDiff < -20 && amazonPacedDiff < -20) {
    recommendation = 'Great pacing! Keep up the mindful spending';
  } else {
    recommendation = 'Steady spending - you\'re on track';
  }
  
  // Recent transactions (last 3 days, top 6)
  const threeDaysAgo = new Date(now);
  threeDaysAgo.setDate(now.getDate() - 3);
  
  let recentSection = '\n📋 RECENT:\n';
  allTransactions
    .filter(t => new Date(t.date) >= threeDaysAgo)
    .slice(0, 6)
    .forEach(t => {
      const transDate = new Date(t.date);
      const dateStr = `${transDate.getMonth() + 1}/${transDate.getDate()}`;
      const dayStr = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][transDate.getDay()];
      const merchant = (t.merchant_name || t.name || 'Unknown').substring(0, 20);
      recentSection += `${dateStr} (${dayStr}): ${merchant} $${Math.abs(t.amount).toFixed(2)}\n`;
    });
  
  // Build optimized message for SlickText (under 918 characters)
  const optimizedMessage = `${billsSection}
💰 BALANCE: $${Math.round(totalAvailable)}

🏪 PUBLIX: $${Math.round(publixThisMonth)} vs $${Math.round(publixPacedTarget)} expected pace against $${Math.round(avgPublixMonthly)} avg monthly spend
📦 AMAZON: $${Math.round(amazonThisMonth)} vs $${Math.round(amazonPacedTarget)} expected pace against $${Math.round(avgAmazonMonthly)} avg monthly spend
💡 ${recommendation}${recentSection}`;
  
  console.log(`📱 Optimized SMS generated: ${optimizedMessage.length} characters (SlickText limit: 918)`);
  return optimizedMessage;
}

// Helper functions
async function findUpcomingRecurringBills(userId: string): Promise<Array<{
  merchant: string;
  amount: string;
  predictedDate: Date;
  confidence: string;
}>> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: taggedMerchants } = await supabase
    .from('tagged_merchants')
    .select('merchant_name, expected_amount, next_predicted_date')
    .eq('user_id', userId)
    .eq('is_active', true);
  
  const upcomingBills: Array<{
    merchant: string;
    amount: string;
    predictedDate: Date;
    confidence: string;
  }> = [];
  
  if (taggedMerchants && taggedMerchants.length > 0) {
    const now = new Date();
    taggedMerchants.forEach(tm => {
      const predictedDate = new Date(tm.next_predicted_date);
      // Only include future bills
      if (predictedDate > now) {
        upcomingBills.push({
          merchant: tm.merchant_name,
          amount: `$${tm.expected_amount.toFixed(2)}`,
          predictedDate: predictedDate,
          confidence: 'tagged'
        });
      }
    });
  }
  
  return upcomingBills.sort((a, b) => a.predictedDate.getTime() - b.predictedDate.getTime());
}

function calculateAverageWeeklyPublix(transactions: Transaction[]): number {
  const publixTransactions = transactions.filter(t => 
    (t.merchant_name || t.name || '').toLowerCase().includes('publix')
  );
  
  if (publixTransactions.length === 0) return 0;
  
  const totalSpent = publixTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const oldestDate = new Date(publixTransactions[publixTransactions.length - 1].date);
  const newestDate = new Date(publixTransactions[0].date);
  const daysDiff = Math.max(1, (newestDate.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24));
  const weeksDiff = daysDiff / 7;
  
  return totalSpent / weeksDiff;
}

function calculateAverageWeeklyAmazon(transactions: Transaction[]): number {
  const amazonTransactions = transactions.filter(t => 
    (t.merchant_name || t.name || '').toLowerCase().includes('amazon')
  );
  
  if (amazonTransactions.length === 0) return 0;
  
  const totalSpent = amazonTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const oldestDate = new Date(amazonTransactions[amazonTransactions.length - 1].date);
  const newestDate = new Date(amazonTransactions[0].date);
  const daysDiff = Math.max(1, (newestDate.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24));
  const weeksDiff = daysDiff / 7;
  
  return totalSpent / weeksDiff;
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