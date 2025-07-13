import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
  try {
    console.log('🔍 DEBUG: Starting SMS content analysis...');
    
    // Get all items (bank connections)
    const { data: itemsWithUsers, error: itemsError } = await supabase
      .from('items')
      .select(`
        id,
        user_id,
        plaid_item_id
      `);

    if (itemsError) {
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch items',
        details: itemsError
      }, { status: 500 });
    }

    if (!itemsWithUsers || itemsWithUsers.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'No items found'
      });
    }

    console.log(`📱 Found ${itemsWithUsers.length} items`);

    // Process first user to debug
    const firstItem = itemsWithUsers[0];
    const userId = firstItem.user_id;
    
    console.log(`🔍 Analyzing transactions for user: ${userId}`);
    
    // Get all transactions for this user (last 90 days for analysis)
    const { data: allTransactions, error: transError } = await supabase
      .from('transactions')
      .select('date, name, merchant_name, amount')
      .eq('plaid_item_id', firstItem.plaid_item_id)
      .gte('date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('date', { ascending: false });

    if (transError) {
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch transactions',
        details: transError
      }, { status: 500 });
    }

    if (!allTransactions || allTransactions.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'No transactions found'
      });
    }

    console.log(`📊 Found ${allTransactions.length} transactions`);

    // Generate SMS message using the same logic from cron job
    const smsMessage = await buildAdvancedSMSMessage(allTransactions, userId);
    
    console.log(`📱 Generated SMS (full): ${smsMessage}`);

    return NextResponse.json({ 
      success: true, 
      userId: userId,
      transactionCount: allTransactions.length,
      smsMessage: smsMessage,
      smsLength: smsMessage.length,
      sampleTransactions: allTransactions.slice(0, 5)
    });

  } catch (error) {
    console.error('🚨 Debug SMS error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error',
      details: error
    }, { status: 500 });
  }
}

// Copy the buildAdvancedSMSMessage function from the cron job
async function buildAdvancedSMSMessage(allTransactions: Transaction[], userId: string): Promise<string> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  console.log(`🔍 DEBUG: Building SMS for ${allTransactions.length} transactions`);
  
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
  
  console.log(`🔍 DEBUG: Found ${upcomingBills.length} upcoming bills`);
  
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
  
  console.log(`🔍 DEBUG: Publix this month: $${publixThisMonth}, Amazon this month: $${amazonThisMonth}`);
  
  // Monthly budgets
  const publixBudget = 400;
  const amazonBudget = 300;
  const publixRemaining = Math.max(0, publixBudget - publixThisMonth);
  const amazonRemaining = Math.max(0, amazonBudget - amazonThisMonth);
  
  // Recent transactions (last 2 days, top 3)
  const twoDaysAgo = new Date(now);
  twoDaysAgo.setDate(now.getDate() - 2);
  
  const recentTransactions = allTransactions.filter(t => new Date(t.date) >= twoDaysAgo);
  console.log(`🔍 DEBUG: Found ${recentTransactions.length} recent transactions (last 2 days)`);
  
  let recentSection = '\n📋 RECENT:\n';
  recentTransactions
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
  
  console.log(`🔍 DEBUG: Compact message length: ${compactMessage.length} characters`);
  return compactMessage;
}

// Copy helper functions from the cron job
async function findUpcomingBillsEnhanced(transactions: Transaction[], userId: string): Promise<Bill[]> {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  
  // Get tagged merchants for this user
  const { data: taggedMerchants } = await supabase
    .from('tagged_merchants')
    .select('merchant_name, predicted_amount, predicted_date')
    .eq('user_id', userId)
    .eq('is_recurring', true);
  
  let upcomingBills: Bill[] = [];
  
  // Add tagged merchants as high-confidence predictions
  if (taggedMerchants && taggedMerchants.length > 0) {
    taggedMerchants.forEach(tm => {
      upcomingBills.push({
        merchant: tm.merchant_name,
        amount: `$${tm.predicted_amount.toFixed(2)}`,
        predictedDate: new Date(tm.predicted_date),
        confidence: 'tagged'
      });
    });
  }
  
  // Add pattern-based predictions
  const patternBills = findUpcomingBills(transactions);
  upcomingBills = upcomingBills.concat(patternBills);
  
  // Sort by predicted date
  upcomingBills.sort((a, b) => a.predictedDate.getTime() - b.predictedDate.getTime());
  
  return upcomingBills;
}

function findUpcomingBills(transactions: Transaction[]): Bill[] {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  
  // Group transactions by merchant
  const merchantMap = new Map<string, Transaction[]>();
  
  transactions.forEach(transaction => {
    const merchant = transaction.merchant_name || transaction.name || 'Unknown';
    const normalizedMerchant = merchant.toLowerCase().trim();
    
    if (!merchantMap.has(normalizedMerchant)) {
      merchantMap.set(normalizedMerchant, []);
    }
    merchantMap.get(normalizedMerchant)!.push(transaction);
  });
  
  const upcomingBills: Bill[] = [];
  
  // Analyze each merchant for patterns
  merchantMap.forEach((merchantTransactions, merchant) => {
    if (merchantTransactions.length < 2) return; // Need at least 2 transactions for pattern
    
    // Sort by date
    merchantTransactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Check for monthly patterns
    const monthlyTransactions = merchantTransactions.filter(t => {
      const transDate = new Date(t.date);
      return transDate.getMonth() === currentMonth - 1 && transDate.getFullYear() === currentYear;
    });
    
    if (monthlyTransactions.length > 0) {
      const lastTransaction = monthlyTransactions[monthlyTransactions.length - 1];
      const lastDate = new Date(lastTransaction.date);
      const predictedDate = new Date(currentYear, currentMonth, lastDate.getDate());
      
      // If the predicted date is in the past, move to next month
      if (predictedDate < now) {
        predictedDate.setMonth(predictedDate.getMonth() + 1);
      }
      
      upcomingBills.push({
        merchant: merchant,
        amount: `$${Math.abs(lastTransaction.amount).toFixed(2)}`,
        predictedDate: predictedDate,
        confidence: 'monthly'
      });
    }
  });
  
  return upcomingBills;
}

 