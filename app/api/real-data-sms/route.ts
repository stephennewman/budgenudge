import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEnhancedSlickTextSMS } from '../../../utils/sms/slicktext-client';

// Create a Supabase client for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Transaction {
  date: string;
  merchant_name?: string;
  name: string;
  amount: number;
  plaid_transaction_id: string;
}

interface Account {
  name: string;
  type: string;
  current_balance: number | null;
  available_balance: number | null;
}

export async function POST() {
  try {
    console.log('📊 Generating real data SMS for Stephen Newman...');
    
    // Get Stephen Newman's user ID by email (assuming he's the main user)
    const { data: userData } = await supabase.auth.admin.listUsers();
    
    let stephenUserId: string | null = null;
    
    if (userData?.users) {
      const stephenUser = userData.users.find(user => 
        user.email?.toLowerCase().includes('stephen') || 
        user.email?.toLowerCase().includes('newman') ||
        user.user_metadata?.full_name?.toLowerCase().includes('stephen')
      );
      
      if (stephenUser) {
        stephenUserId = stephenUser.id;
        console.log('✅ Found Stephen Newman user:', stephenUser.email);
      }
    }
    
    if (!stephenUserId) {
      // Fallback: get the first user with transactions
      const { data: items } = await supabase
        .from('items')
        .select('user_id')
        .limit(1);
      
      if (items && items.length > 0) {
        stephenUserId = items[0].user_id;
        console.log('📝 Using fallback user ID:', stephenUserId);
      } else {
        throw new Error('No users found in the database');
      }
    }
    
    // Get user's items
    const { data: userItems } = await supabase
      .from('items')
      .select('id, plaid_item_id')
      .eq('user_id', stephenUserId);
    
    if (!userItems || userItems.length === 0) {
      throw new Error('No connected accounts found for user');
    }
    
    const itemIds = userItems.map(item => item.plaid_item_id);
    const itemDbIds = userItems.map(item => item.id);
    
    // Get user's real transactions
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .in('plaid_item_id', itemIds)
      .order('date', { ascending: false });
    
    // Get user's real accounts with balances
    const { data: accounts, error: accError } = await supabase
      .from('accounts')
      .select('name, type, current_balance, available_balance')
      .in('item_id', itemDbIds);
    
    if (txError) throw new Error(`Transaction error: ${txError.message}`);
    if (accError) throw new Error(`Account error: ${accError.message}`);
    
    if (!transactions || transactions.length === 0) {
      throw new Error('No transactions found for user');
    }
    
    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts found for user');
    }
    
    console.log(`📊 Found ${transactions.length} transactions and ${accounts.length} accounts`);
    
    if (!stephenUserId) {
      throw new Error('User ID not found');
    }
    
    // Build real SMS message using actual data
    const realSmsMessage = await buildRealFinancialSMS(
      transactions as Transaction[], 
      accounts as Account[], 
      stephenUserId
    );
    
    // Send via SlickText
    const result = await sendEnhancedSlickTextSMS({
      phoneNumber: '+16173472721', // Stephen's phone
      message: realSmsMessage,
      userId: stephenUserId, // Already validated above
      userEmail: 'stephen@krezzo.com'
    });
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Real data SMS sent successfully via SlickText!',
        messageId: result.messageId,
        dataStats: {
          totalTransactions: transactions.length,
          totalAccounts: accounts.length,
          userId: stephenUserId,
          messageLength: realSmsMessage.length
        },
        timestamp: new Date().toISOString()
      });
    } else {
      throw new Error(result.error || 'Failed to send SMS');
    }
    
  } catch (error) {
    console.error('❌ Real data SMS error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate real data SMS',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

async function buildRealFinancialSMS(
  allTransactions: Transaction[], 
  accounts: Account[], 
  userId: string
): Promise<string> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // Calculate real account balances
  const depositoryAccounts = accounts.filter(acc => acc.type === 'depository');
  const totalAvailable = depositoryAccounts.reduce(
    (sum, acc) => sum + (acc.available_balance || 0), 
    0
  );
  
  const balanceSection = `💰 REAL BALANCE: $${totalAvailable.toFixed(2)}\n`;
  
  // 1. REAL PREDICTED TRANSACTIONS - Next 30 days
  const upcomingBills = await findRealUpcomingBills(allTransactions, userId);
  const thirtyDaysFromNow = new Date(now);
  thirtyDaysFromNow.setDate(now.getDate() + 30);
  
  let billsSection = '💳 REAL PREDICTED TRANSACTIONS (NEXT 30 DAYS):\n';
  upcomingBills
    .filter(bill => bill.predictedDate <= thirtyDaysFromNow)
    .slice(0, 6)
    .forEach(bill => {
      const date = new Date(bill.predictedDate);
      const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
      const dayStr = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
      billsSection += `${dateStr} (${dayStr}): ${bill.merchant} ${bill.amount}\n`;
    });
  
  // 2. REAL MERCHANT SPENDING - Monthly focus
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  
  // Real Publix spending this month
  const publixThisMonth = allTransactions
    .filter(t => {
      const transDate = new Date(t.date + 'T12:00:00');
      return (t.merchant_name || t.name || '').toLowerCase().includes('publix') && 
             transDate >= monthStart && transDate <= monthEnd;
    })
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  
  // Real Amazon spending this month
  const amazonThisMonth = allTransactions
    .filter(t => {
      const transDate = new Date(t.date + 'T12:00:00');
      return (t.merchant_name || t.name || '').toLowerCase().includes('amazon') && 
             transDate >= monthStart && transDate <= monthEnd;
    })
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  
  // Calculate real historical averages
  const avgPublixWeekly = calculateRealAverageWeekly(allTransactions, 'publix');
  const avgAmazonWeekly = calculateRealAverageWeekly(allTransactions, 'amazon');
  const avgPublixMonthly = avgPublixWeekly * 4.33;
  const avgAmazonMonthly = avgAmazonWeekly * 4.33;
  
  // Real monthly paced projection
  const daysInMonth = monthEnd.getDate();
  const monthDaysElapsed = today.getDate();
  const publixPacedTarget = (avgPublixMonthly / daysInMonth) * monthDaysElapsed;
  const amazonPacedTarget = (avgAmazonMonthly / daysInMonth) * monthDaysElapsed;
  const publixPacedDiff = publixThisMonth - publixPacedTarget;
  const amazonPacedDiff = amazonThisMonth - amazonPacedTarget;
  
  let spendingSection = `\n🏪 REAL PUBLIX SPENDING:\n`;
  spendingSection += `THIS MONTH: $${publixThisMonth.toFixed(2)} vs $${publixPacedTarget.toFixed(2)} expected`;
  if (publixPacedDiff > 0) {
    spendingSection += ` (+$${publixPacedDiff.toFixed(2)} over pace)\n`;
  } else if (publixPacedDiff < 0) {
    spendingSection += ` ($${Math.abs(publixPacedDiff).toFixed(2)} under pace)\n`;
  } else {
    spendingSection += ` (on pace)\n`;
  }
  
  spendingSection += `\n📦 REAL AMAZON SPENDING:\n`;
  spendingSection += `THIS MONTH: $${amazonThisMonth.toFixed(2)} vs $${amazonPacedTarget.toFixed(2)} expected`;
  if (amazonPacedDiff > 0) {
    spendingSection += ` (+$${amazonPacedDiff.toFixed(2)} over pace)\n`;
  } else if (amazonPacedDiff < 0) {
    spendingSection += ` ($${Math.abs(amazonPacedDiff).toFixed(2)} under pace)\n`;
  } else {
    spendingSection += ` (on pace)\n`;
  }
  
  // 3. REAL RECENT TRANSACTIONS - Last 5 days
  const fiveDaysAgo = new Date(now);
  fiveDaysAgo.setDate(now.getDate() - 5);
  
  let recentSection = '\n📋 REAL RECENT TRANSACTIONS:\n';
  allTransactions
    .filter(t => new Date(t.date + 'T12:00:00') >= fiveDaysAgo)
    .slice(0, 8)
    .forEach(t => {
      // Parse date as local noon to avoid timezone issues
      const transDate = new Date(t.date + 'T12:00:00');
      const dateStr = `${transDate.getMonth() + 1}/${transDate.getDate()}`;
      const merchant = (t.merchant_name || t.name || 'Unknown').substring(0, 20);
      recentSection += `${dateStr}: ${merchant} $${Math.abs(t.amount).toFixed(2)}\n`;
    });
  
  recentSection += `\n🎯 REAL DATA FROM STEPHEN'S ACCOUNTS`;
  recentSection += `\nGenerated: ${new Date().toLocaleString('en-US', { 
    timeZone: 'America/New_York',
    month: 'short', 
    day: 'numeric', 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  })} EST`;
  
  return billsSection + balanceSection + spendingSection + recentSection;
}

async function findRealUpcomingBills(transactions: Transaction[], userId: string): Promise<Array<{
  merchant: string;
  amount: string;
  predictedDate: Date;
}>> {
  const bills: Array<{
    merchant: string;
    amount: string;
    predictedDate: Date;
  }> = [];
  
  // Get REAL predictions from tagged merchants table (same source as recurring bills page)
  try {
    const { data: taggedMerchants, error } = await supabase
      .from('tagged_merchants')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('next_predicted_date', { ascending: true });
    
    if (error) {
      console.error('Error fetching tagged merchants for SMS:', error);
      return bills;
    }
    
    if (taggedMerchants && taggedMerchants.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Set to start of day
      taggedMerchants.forEach(merchant => {
        const predictedDate = new Date(merchant.next_predicted_date + 'T12:00:00');
        predictedDate.setHours(0, 0, 0, 0); // Set to start of day
        // Include bills for today or future
        if (predictedDate >= today) {
          bills.push({
            merchant: merchant.merchant_name,
            amount: `$${merchant.expected_amount.toFixed(2)}`,
            predictedDate: predictedDate
          });
        }
      });
    }
  } catch (error) {
    console.error('Tagged merchants fetch failed for SMS:', error);
  }
  
  // If no tagged merchants found, show a helpful message
  if (bills.length === 0) {
    console.log('No active recurring bills found in tagged_merchants table');
  }
  
  return bills.sort((a, b) => a.predictedDate.getTime() - b.predictedDate.getTime());
}

function calculateRealAverageWeekly(transactions: Transaction[], merchantKeyword: string): number {
  const now = new Date();
  const twelveWeeksAgo = new Date(now);
  twelveWeeksAgo.setDate(now.getDate() - (12 * 7));
  
  const merchantTransactions = transactions.filter(t => {
    const transDate = new Date(t.date + 'T12:00:00');
    return (t.merchant_name || t.name || '').toLowerCase().includes(merchantKeyword.toLowerCase()) &&
           transDate >= twelveWeeksAgo;
  });
  
  const totalSpending = merchantTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  
  return totalSpending / 12; // Average per week over 12 weeks
} 