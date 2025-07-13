import { createClient } from '@supabase/supabase-js';

// Create a Supabase client for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Transaction interface
interface Transaction {
  date: string;
  merchant_name?: string;
  name: string;
  amount: number;
}

// Bill interface
interface Bill {
  merchant: string;
  amount: string;
  predictedDate: Date;
  confidence: string;
}

// SMS Template Types
export type SMSTemplateType = 'bills' | 'spending' | 'activity';

// Template 1: Bills & Payments
export async function buildBillsSMS(userId: string): Promise<string> {
  try {
    // Get next 6 most important bills - ONLY from tagged merchants (recurring bills)
    const upcomingBills = await findUpcomingRecurringBills(userId);
    const now = new Date();
    const thirtyDaysFromNow = new Date(now);
    thirtyDaysFromNow.setDate(now.getDate() + 30);
    
    let billsSection = '💳 NEXT BILLS:\n';
    const filteredBills = upcomingBills
      .filter(bill => bill.predictedDate <= thirtyDaysFromNow)
      .slice(0, 6);
    
    if (filteredBills.length === 0) {
      billsSection += 'No upcoming bills in next 30 days\n';
    } else {
      filteredBills.forEach(bill => {
        const date = new Date(bill.predictedDate);
        const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
        const dayStr = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
        const confidenceIcon = bill.confidence === 'tagged' ? '🏷️' : bill.confidence === 'monthly' ? '🗓️' : '📊';
        billsSection += `${dateStr} (${dayStr}): ${bill.merchant} ${bill.amount} ${confidenceIcon}\n`;
      });
    }
    
    return billsSection.trim();
  } catch (error) {
    console.error('Error building bills SMS:', error);
    return '💳 NEXT BILLS:\nError loading bills data';
  }
}

// Template 2: Spending Analysis
export async function buildSpendingSMS(allTransactions: Transaction[], userId: string): Promise<string> {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Fetch current account balances
    let totalAvailable = 0;
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
      console.error('Error fetching balances for spending SMS:', error);
    }
    
    // Calculate monthly spending with pacing
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
    
    // AI Recommendation
    const publixPacedDiff = publixThisMonth - publixPacedTarget;
    const amazonPacedDiff = amazonThisMonth - amazonPacedTarget;
    
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
    
    const spendingMessage = `💰 BALANCE: $${Math.round(totalAvailable)}

🏪 PUBLIX: $${Math.round(publixThisMonth)} vs $${Math.round(publixPacedTarget)} expected pace against $${Math.round(avgPublixMonthly)} avg monthly spend
📦 AMAZON: $${Math.round(amazonThisMonth)} vs $${Math.round(amazonPacedTarget)} expected pace against $${Math.round(avgAmazonMonthly)} avg monthly spend
💡 ${recommendation}`;
    
    return spendingMessage;
  } catch (error) {
    console.error('Error building spending SMS:', error);
    return '💰 BALANCE: Error loading spending data';
  }
}

// Template 3: Recent Activity
export async function buildActivitySMS(allTransactions: Transaction[]): Promise<string> {
  try {
    // Get current date in UTC
    const now = new Date();
    const currentDateUTC = new Date(now.toISOString().split('T')[0] + 'T00:00:00.000Z');
    
    // Calculate 3 days ago (inclusive)
    const threeDaysAgoUTC = new Date(currentDateUTC.getTime() - (3 * 24 * 60 * 60 * 1000));
    
    console.log(`🔍 Activity SMS Debug:
      - Current UTC date: ${currentDateUTC.toISOString()}
      - Three days ago UTC: ${threeDaysAgoUTC.toISOString()}
      - Total transactions: ${allTransactions.length}
    `);
    
    let recentSection = '📋 RECENT (Last 3 days):\n';
    const recentTransactions = allTransactions
      .filter(t => {
        // Parse transaction date as UTC date (since DB stores YYYY-MM-DD format)
        const transactionDateUTC = new Date(t.date + 'T00:00:00.000Z');
        const isRecent = transactionDateUTC >= threeDaysAgoUTC;
        
        console.log(`  📅 Transaction: ${t.date} (${transactionDateUTC.toISOString()}) >= ${threeDaysAgoUTC.toISOString()} = ${isRecent} - ${t.name}`);
        return isRecent;
      })
      .slice(0, 6);
    
    console.log(`📊 Recent transactions found: ${recentTransactions.length}`);
    
    if (recentTransactions.length === 0) {
      recentSection += 'No recent transactions in last 3 days\n';
    } else {
      recentTransactions.forEach(t => {
        const transDate = new Date(t.date + 'T00:00:00.000Z');
        const dateStr = `${transDate.getUTCMonth() + 1}/${transDate.getUTCDate()}`;
        const dayStr = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][transDate.getUTCDay()];
        const merchant = (t.merchant_name || t.name || 'Unknown').substring(0, 20);
        recentSection += `${dateStr} (${dayStr}): ${merchant} $${Math.abs(t.amount).toFixed(2)}\n`;
      });
    }
    
    return recentSection.trim();
  } catch (error) {
    console.error('Error building activity SMS:', error);
    return '📋 RECENT: Error loading transaction data';
  }
}

// Helper function to find upcoming recurring bills
async function findUpcomingRecurringBills(userId: string): Promise<Bill[]> {
  try {
    const { data: taggedMerchants, error } = await supabase
      .from('tagged_merchants')
      .select('merchant, amount, predicted_date, confidence')
      .eq('user_id', userId)
      .eq('active', true)
      .order('predicted_date', { ascending: true });

    if (error) {
      console.error('Error fetching tagged merchants:', error);
      return [];
    }

    return (taggedMerchants || []).map(tm => ({
      merchant: tm.merchant,
      amount: `$${Math.abs(parseFloat(tm.amount)).toFixed(2)}`,
      predictedDate: new Date(tm.predicted_date),
      confidence: tm.confidence
    }));
  } catch (error) {
    console.error('Error in findUpcomingRecurringBills:', error);
    return [];
  }
}

// Helper function to calculate average weekly Publix spending
function calculateAverageWeeklyPublix(transactions: Transaction[]): number {
  const publixTransactions = transactions.filter(t => 
    (t.merchant_name || t.name || '').toLowerCase().includes('publix')
  );
  
  if (publixTransactions.length === 0) return 0;
  
  const totalAmount = publixTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const oldestDate = new Date(Math.min(...publixTransactions.map(t => new Date(t.date).getTime())));
  const newestDate = new Date(Math.max(...publixTransactions.map(t => new Date(t.date).getTime())));
  const weeksDiff = Math.max(1, (newestDate.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
  
  return totalAmount / weeksDiff;
}

// Helper function to calculate average weekly Amazon spending
function calculateAverageWeeklyAmazon(transactions: Transaction[]): number {
  const amazonTransactions = transactions.filter(t => 
    (t.merchant_name || t.name || '').toLowerCase().includes('amazon')
  );
  
  if (amazonTransactions.length === 0) return 0;
  
  const totalAmount = amazonTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const oldestDate = new Date(Math.min(...amazonTransactions.map(t => new Date(t.date).getTime())));
  const newestDate = new Date(Math.max(...amazonTransactions.map(t => new Date(t.date).getTime())));
  const weeksDiff = Math.max(1, (newestDate.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
  
  return totalAmount / weeksDiff;
} 