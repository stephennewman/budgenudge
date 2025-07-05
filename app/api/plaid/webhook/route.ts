import { NextRequest, NextResponse } from 'next/server';
import { plaidClient } from '@/utils/plaid/client';
import { createSupabaseServerClient, storeTransactions } from '@/utils/plaid/server';
import { createClient } from '@supabase/supabase-js';

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
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // Fetch current account balances
  let balanceSection = '';
  if (userId) {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      
      // First get the user's item IDs
      const { data: userItems } = await supabase
        .from('items')
        .select('id')
        .eq('user_id', userId);
      
      if (userItems && userItems.length > 0) {
        const itemIds = userItems.map((item: { id: number }) => item.id);
        
        const { data: accounts } = await supabase
          .from('accounts')
          .select(`
            name,
            type,
            current_balance,
            available_balance,
            balance_last_updated
          `)
          .in('item_id', itemIds)
          .eq('type', 'depository'); // Focus on checking/savings accounts
        
        if (accounts && accounts.length > 0) {
          const totalAvailable = accounts.reduce((sum: number, acc: { available_balance: number | null }) => sum + (acc.available_balance || 0), 0);
          balanceSection = `\n💰 AVAILABLE BALANCE: $${totalAvailable.toFixed(2)}\n`;
          
          console.log(`📱 Including balance in SMS: $${totalAvailable.toFixed(2)} from ${accounts.length} accounts`);
        } else {
          console.log(`📱 No accounts found for balance inclusion in SMS`);
        }
      }
    } catch (error) {
      console.error('Error fetching balances for SMS:', error);
    }
  }
  
  // 1. PREDICTED TRANSACTIONS - Next 30 days
  const upcomingBills = findUpcomingBills(allTransactions);
  const thirtyDaysFromNow = new Date(now);
  thirtyDaysFromNow.setDate(now.getDate() + 30);
  
  let billsSection = '💳 PREDICTED TRANSACTIONS (NEXT 30 DAYS):\n';
  upcomingBills
    .filter(bill => bill.predictedDate <= thirtyDaysFromNow)
    .slice(0, 8)
    .forEach(bill => {
      const date = new Date(bill.predictedDate);
      const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
      const dayStr = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
      billsSection += `${dateStr} (${dayStr}): ${bill.merchant} ${bill.amount}\n`;
    });
  
  // 2. MERCHANT SPENDING - Monthly focus (Publix + Amazon)
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  
  // Monthly Publix spending
  const publixThisMonth = allTransactions
    .filter(t => {
      const transDate = new Date(t.date);
      return (t.merchant_name || t.name || '').toLowerCase().includes('publix') && 
             transDate >= monthStart && transDate <= monthEnd;
    })
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  
  // Monthly Amazon spending
  const amazonThisMonth = allTransactions
    .filter(t => {
      const transDate = new Date(t.date);
      return (t.merchant_name || t.name || '').toLowerCase().includes('amazon') && 
             transDate >= monthStart && transDate <= monthEnd;
    })
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  
  // Calculate average monthly spending from historical data
  const avgPublixWeekly = calculateAverageWeeklyPublix(allTransactions);
  const avgPublixMonthly = avgPublixWeekly * 4.33; // Average weeks per month
  
  const avgAmazonWeekly = calculateAverageWeeklyAmazon(allTransactions);
  const avgAmazonMonthly = avgAmazonWeekly * 4.33; // Average weeks per month
  
  // Monthly paced projection for Publix
  const daysInMonth = monthEnd.getDate();
  const monthDaysElapsed = today.getDate();
  const publixPacedTarget = (avgPublixMonthly / daysInMonth) * monthDaysElapsed;
  const publixPacedDiff = publixThisMonth - publixPacedTarget;
  
  // Monthly paced projection for Amazon
  const amazonPacedTarget = (avgAmazonMonthly / daysInMonth) * monthDaysElapsed;
  const amazonPacedDiff = amazonThisMonth - amazonPacedTarget;
  
  // Monthly budgets
  const publixBudget = 400;
  const amazonBudget = 300;
  const publixBudgetRemaining = Math.max(0, publixBudget - publixThisMonth);
  const amazonBudgetRemaining = Math.max(0, amazonBudget - amazonThisMonth);
  
  // AI Recommendation based on monthly metrics
  let recommendation = '';
  if (publixPacedDiff > 50 || amazonPacedDiff > 50) {
    recommendation = 'Consider reducing impulse purchases this month';
  } else if (publixBudgetRemaining < 50 || amazonBudgetRemaining < 50) {
    recommendation = 'Budget running low - focus on essentials only';
  } else if (publixPacedDiff < -20 && amazonPacedDiff < -20) {
    recommendation = 'Great pacing! Keep up the mindful spending';
  } else {
    recommendation = 'Steady spending - you\'re on track';
  }
  
  let publixSection = `\n🏪 PUBLIX SPENDING:\n`;
  publixSection += `PACED MONTHLY - $${publixThisMonth.toFixed(2)} vs $${publixPacedTarget.toFixed(2)} expected`;
  if (publixPacedDiff > 0) {
    publixSection += ` (+$${publixPacedDiff.toFixed(2)} over pace)\n`;
  } else if (publixPacedDiff < 0) {
    publixSection += ` ($${Math.abs(publixPacedDiff).toFixed(2)} under pace)\n`;
  } else {
    publixSection += ` (on pace)\n`;
  }
  publixSection += `MONTHLY BUDGET REMAINING - $${publixBudgetRemaining.toFixed(2)}\n`;
  
  publixSection += `\n📦 AMAZON SPENDING:\n`;
  publixSection += `PACED MONTHLY - $${amazonThisMonth.toFixed(2)} vs $${amazonPacedTarget.toFixed(2)} expected`;
  if (amazonPacedDiff > 0) {
    publixSection += ` (+$${amazonPacedDiff.toFixed(2)} over pace)\n`;
  } else if (amazonPacedDiff < 0) {
    publixSection += ` ($${Math.abs(amazonPacedDiff).toFixed(2)} under pace)\n`;
  } else {
    publixSection += ` (on pace)\n`;
  }
  publixSection += `MONTHLY BUDGET REMAINING - $${amazonBudgetRemaining.toFixed(2)}\n`;
  
  publixSection += `\nRECOMMENDATION - ${recommendation}`;
  
  // 3. RECENT TRANSACTIONS - Last 3 days
  const threeDaysAgo = new Date(now);
  threeDaysAgo.setDate(now.getDate() - 3);
  
  let recentSection = '\n\n📋 RECENT TRANSACTIONS:\n';
  allTransactions
    .filter(t => new Date(t.date) >= threeDaysAgo)
    .slice(0, 10)
    .forEach(t => {
      const transDate = new Date(t.date);
      const dateStr = `${transDate.getMonth() + 1}/${transDate.getDate()}`;
      const dayStr = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][transDate.getDay()];
      const merchant = t.merchant_name || t.name || 'Unknown';
      recentSection += `${dateStr} (${dayStr}): ${merchant} $${Math.abs(t.amount).toFixed(2)}\n`;
    });
  
  return billsSection + balanceSection + publixSection + recentSection;
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

function calculateAverageWeeklyAmazon(transactions: Transaction[]): number {
  const now = new Date();
  const eightWeeksAgo = new Date(now);
  eightWeeksAgo.setDate(now.getDate() - 56); // 8 weeks ago
  
  const amazonTransactions = transactions.filter(t => {
    const transDate = new Date(t.date);
    return (t.merchant_name || t.name || '').toLowerCase().includes('amazon') && 
           transDate >= eightWeeksAgo && transDate <= now;
  });
  
  if (amazonTransactions.length === 0) return 0;
  
  const totalSpent = amazonTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
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