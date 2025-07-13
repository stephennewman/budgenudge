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
  
  // Get next 3 most important bills
  const upcomingBills = await findUpcomingBillsEnhanced(allTransactions, userId);
  const thirtyDaysFromNow = new Date(now);
  thirtyDaysFromNow.setDate(now.getDate() + 30);
  
  let billsSection = '💳 NEXT BILLS:\n';
  upcomingBills
    .filter(bill => bill.predictedDate <= thirtyDaysFromNow)
    .slice(0, 3)
    .forEach(bill => {
      const date = new Date(bill.predictedDate);
      const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
      billsSection += `${dateStr}: ${bill.merchant} ${bill.amount}\n`;
    });
  
  // Calculate monthly spending
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
  
  // Monthly budgets
  const publixBudget = 400;
  const amazonBudget = 300;
  const publixRemaining = Math.max(0, publixBudget - publixThisMonth);
  const amazonRemaining = Math.max(0, amazonBudget - amazonThisMonth);
  
  // Recent transactions (last 2 days, top 3)
  const twoDaysAgo = new Date(now);
  twoDaysAgo.setDate(now.getDate() - 2);
  
  let recentSection = '\n📋 RECENT:\n';
  allTransactions
    .filter(t => new Date(t.date) >= twoDaysAgo)
    .slice(0, 3)
    .forEach(t => {
      const transDate = new Date(t.date);
      const dateStr = `${transDate.getMonth() + 1}/${transDate.getDate()}`;
      const merchant = (t.merchant_name || t.name || 'Unknown').substring(0, 15);
      recentSection += `${dateStr}: ${merchant} $${Math.abs(t.amount).toFixed(2)}\n`;
    });
  
  // Build compact message
  const compactMessage = `${billsSection}
💰 BALANCE: $${totalAvailable.toFixed(2)}

🏪 PUBLIX: $${publixThisMonth.toFixed(2)} ($${publixRemaining.toFixed(2)} left)
📦 AMAZON: $${amazonThisMonth.toFixed(2)} ($${amazonRemaining.toFixed(2)} left)${recentSection}`;
  
  console.log(`📱 Compact SMS generated: ${compactMessage.length} characters`);
  return compactMessage;
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