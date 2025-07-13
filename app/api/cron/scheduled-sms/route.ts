import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEnhancedSlickTextSMS } from '@/utils/sms/slicktext-client';

// Create a Supabase client for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Transaction interface (matches the webhook)
interface Transaction {
  date: string;
  merchant_name?: string;
  name: string;
  amount: number;
}

// Bill interface (matches the webhook)  
interface Bill {
  merchant: string;
  amount: string;
  predictedDate: Date;
  confidence: string;
}

export async function GET(request: NextRequest) {
  // Secure GET method with same auth as POST
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    console.log('🕐 Starting daily transaction analysis and SMS processing...');
    
    const now = new Date();
    console.log(`⏰ Daily Analysis Time:
      - Server Time (UTC): ${now.toISOString()}
      - Server Time (Local): ${now.toLocaleString()}
      - Analysis: Daily transaction insights for active users
    `);
    
    // Get all users with items (bank connections) and phone numbers
    const { data: itemsWithUsers, error: itemsError } = await supabase
      .from('items')
      .select(`
        id,
        user_id,
        plaid_item_id
      `);

    if (itemsError) {
      console.error('Error fetching items:', itemsError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch items' 
      }, { status: 500 });
    }

    if (!itemsWithUsers || itemsWithUsers.length === 0) {
      console.log('📭 No items (bank connections) found');
      return NextResponse.json({ 
        success: true, 
        processed: 0,
        message: 'No items found' 
      });
    }

    // For now, process all users with items and use phone fallback system
    const usersWithTransactions = itemsWithUsers;
    
    console.log(`📱 Processing ${usersWithTransactions.length} users with items (using phone fallback system)`);

    if (!usersWithTransactions || usersWithTransactions.length === 0) {
      console.log('📭 No users with transactions and phone numbers found');
      return NextResponse.json({ 
        success: true, 
        processed: 0,
        message: 'No users with transactions to analyze' 
      });
    }

    console.log(`📨 Found ${usersWithTransactions.length} users with transactions to analyze`);
    
    let successCount = 0;
    let failureCount = 0;

    // Process each user
    for (const item of usersWithTransactions) {
      try {
        const userId = item.user_id;
        
        console.log(`🔍 Analyzing transactions for user: ${userId}`);
        
        // Get all transactions for this user (last 90 days for analysis)
        const { data: allTransactions, error: transError } = await supabase
          .from('transactions')
          .select('date, name, merchant_name, amount')
          .eq('plaid_item_id', item.plaid_item_id)
          .gte('date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
          .order('date', { ascending: false });

        if (transError) {
          console.error(`Error fetching transactions for user ${userId}:`, transError);
          failureCount++;
          continue;
        }

        if (!allTransactions || allTransactions.length === 0) {
          console.log(`📭 No recent transactions found for user ${userId}`);
          continue;
        }

        // Generate advanced SMS message using existing logic
        const smsMessage = await buildAdvancedSMSMessage(allTransactions, userId);
        
        console.log(`📱 Generated SMS for user ${userId}: ${smsMessage.substring(0, 100)}...`);

        // Send SMS using SlickText with fallback phone number system
        const smsResult = await sendEnhancedSlickTextSMS({
          phoneNumber: '+16173472721', // Use your phone number directly for now
          message: `📊 DAILY BUDGENUDGE INSIGHT\n\n${smsMessage}`,
          userId: userId
        });

        if (smsResult.success) {
          console.log(`✅ Daily SMS sent successfully to user: ${userId}`);
          successCount++;
        } else {
          console.log(`❌ Daily SMS failed for user ${userId}: ${smsResult.error}`);
          failureCount++;
        }

      } catch (error) {
        console.log(`❌ Daily SMS error for user ${item.user_id}: ${error}`);
        failureCount++;
      }
    }

    console.log(`📊 Daily SMS processing complete: ${successCount} sent, ${failureCount} failed`);

    return NextResponse.json({ 
      success: true, 
      processed: usersWithTransactions.length,
      sent: successCount,
      failed: failureCount,
      message: `Processed daily analysis for ${usersWithTransactions.length} users`
    });

  } catch (error) {
    console.error('🚨 Daily SMS processing error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error during daily SMS processing' 
    }, { status: 500 });
  }
}

// Copy the analysis functions from the webhook to avoid duplication
async function buildAdvancedSMSMessage(allTransactions: Transaction[], userId: string): Promise<string> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // Fetch current account balances
  let balanceSection = '';
  if (userId) {
    try {
      // Get the user's item IDs
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
  const upcomingBills = await findUpcomingBillsEnhanced(allTransactions, userId);
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
      const confidenceIcon = bill.confidence === 'tagged' ? '🏷️' : bill.confidence === 'monthly' ? '🗓️' : '📊';
      billsSection += `${dateStr} (${dayStr}): ${bill.merchant} ${bill.amount} ${confidenceIcon}\n`;
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

// Copy helper functions from webhook
async function findUpcomingBillsEnhanced(transactions: Transaction[], userId: string): Promise<Bill[]> {
  // Get tagged merchants first
  const { data: taggedMerchants } = await supabase
    .from('tagged_merchants')
    .select('*')
    .eq('user_id', userId);
  
  const upcomingBills: Bill[] = [];
  const now = new Date();
  
  // Process tagged merchants
  if (taggedMerchants) {
    for (const merchant of taggedMerchants) {
      const lastTransaction = transactions.find(t => 
        (t.merchant_name || t.name || '').toLowerCase().includes(merchant.name.toLowerCase())
      );
      
      if (lastTransaction) {
        const nextDate = new Date(merchant.next_expected_date);
        if (nextDate > now) {
          upcomingBills.push({
            merchant: merchant.name,
            amount: `$${merchant.predicted_amount.toFixed(2)}`,
            predictedDate: nextDate,
            confidence: 'tagged'
          });
        }
      }
    }
  }
  
  // Add historical analysis
  const historicalBills = findUpcomingBills(transactions);
  upcomingBills.push(...historicalBills);
  
  // Remove duplicates and sort by date
  const uniqueBills = upcomingBills.filter((bill, index, self) => 
    index === self.findIndex(b => b.merchant === bill.merchant)
  );
  
  return uniqueBills.sort((a, b) => a.predictedDate.getTime() - b.predictedDate.getTime());
}

function findUpcomingBills(transactions: Transaction[]): Bill[] {
  const merchantPatterns = [
    { pattern: 'netflix', name: 'Netflix' },
    { pattern: 'spotify', name: 'Spotify' },
    { pattern: 'amazon prime', name: 'Amazon Prime' },
    { pattern: 'verizon', name: 'Verizon' },
    { pattern: 'at&t', name: 'AT&T' },
    { pattern: 'comcast', name: 'Comcast' },
    { pattern: 'electric', name: 'Electric Bill' },
    { pattern: 'water', name: 'Water Bill' },
    { pattern: 'gas', name: 'Gas Bill' },
    { pattern: 'insurance', name: 'Insurance' },
    { pattern: 'mortgage', name: 'Mortgage' },
    { pattern: 'rent', name: 'Rent' }
  ];
  
  const bills: Bill[] = [];
  const now = new Date();
  
  for (const { pattern, name } of merchantPatterns) {
    const merchantTransactions = transactions.filter(t => 
      (t.merchant_name || t.name || '').toLowerCase().includes(pattern)
    );
    
    if (merchantTransactions.length >= 2) {
      const amounts = merchantTransactions.map(t => Math.abs(t.amount));
      const avgAmount = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
      
      const lastTransaction = merchantTransactions[0];
      const lastDate = new Date(lastTransaction.date);
      
      // Estimate next payment date (30 days from last)
      const nextDate = new Date(lastDate);
      nextDate.setDate(lastDate.getDate() + 30);
      
      if (nextDate > now) {
        bills.push({
          merchant: name,
          amount: `$${avgAmount.toFixed(2)}`,
          predictedDate: nextDate,
          confidence: 'monthly'
        });
      }
    }
  }
  
  return bills;
}

function calculateAverageWeeklyPublix(transactions: Transaction[]): number {
  const publixTransactions = transactions.filter(t => 
    (t.merchant_name || t.name || '').toLowerCase().includes('publix')
  );
  
  if (publixTransactions.length === 0) return 0;
  
  const weeklyTotals = new Map<string, number>();
  
  publixTransactions.forEach(t => {
    const date = new Date(t.date);
    const yearWeek = `${date.getFullYear()}-${Math.floor(date.getTime() / (7 * 24 * 60 * 60 * 1000))}`;
    weeklyTotals.set(yearWeek, (weeklyTotals.get(yearWeek) || 0) + Math.abs(t.amount));
  });
  
  const totals = Array.from(weeklyTotals.values());
  return totals.reduce((sum, total) => sum + total, 0) / totals.length;
}

function calculateAverageWeeklyAmazon(transactions: Transaction[]): number {
  const amazonTransactions = transactions.filter(t => 
    (t.merchant_name || t.name || '').toLowerCase().includes('amazon')
  );
  
  if (amazonTransactions.length === 0) return 0;
  
  const weeklyTotals = new Map<string, number>();
  
  amazonTransactions.forEach(t => {
    const date = new Date(t.date);
    const yearWeek = `${date.getFullYear()}-${Math.floor(date.getTime() / (7 * 24 * 60 * 60 * 1000))}`;
    weeklyTotals.set(yearWeek, (weeklyTotals.get(yearWeek) || 0) + Math.abs(t.amount));
  });
  
  const totals = Array.from(weeklyTotals.values());
  return totals.reduce((sum, total) => sum + total, 0) / totals.length;
}

// Handle authorization for cron jobs
export async function POST(request: NextRequest) {
  // Vercel Cron jobs use POST with authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  return GET(request);
} 