import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Transaction {
  date: string;
  merchant_name?: string;
  name: string;
  amount: number;
}

interface Bill {
  merchant: string;
  amount: string;
  predictedDate: Date;
  confidence: string;
}

export async function GET(request: NextRequest) {
  try {
    const { data: itemsWithUsers } = await supabase
      .from('items')
      .select('id, user_id, plaid_item_id');

    const firstItem = itemsWithUsers?.[0];
    if (!firstItem) {
      return NextResponse.json({ error: 'No items found' });
    }

    const { data: allTransactions } = await supabase
      .from('transactions')
      .select('date, name, merchant_name, amount')
      .eq('plaid_item_id', firstItem.plaid_item_id)
      .gte('date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('date', { ascending: false });

    if (!allTransactions) {
      return NextResponse.json({ error: 'No transactions found' });
    }

    const smsMessage = await buildAdvancedSMSMessage(allTransactions, firstItem.user_id);
    
    return NextResponse.json({ 
      success: true, 
      smsMessage: smsMessage,
      smsLength: smsMessage.length,
      slickTextLimit: 918,
      isWithinLimit: smsMessage.length <= 918,
      charactersRemaining: 918 - smsMessage.length
    });

  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function buildAdvancedSMSMessage(allTransactions: Transaction[], userId: string): Promise<string> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
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
  
  const upcomingBills = await findUpcomingBillsEnhanced(allTransactions, userId);
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
  
  const publixBudget = 400;
  const amazonBudget = 300;
  const publixRemaining = Math.max(0, publixBudget - publixThisMonth);
  const amazonRemaining = Math.max(0, amazonBudget - amazonThisMonth);
  
  let recommendation = '';
  if (publixPacedDiff > 50 || amazonPacedDiff > 50) {
    recommendation = 'Consider reducing impulse purchases this month';
  } else if (publixRemaining < 50 || amazonRemaining < 50) {
    recommendation = 'Budget running low - focus on essentials only';
  } else if (publixPacedDiff < -20 && amazonPacedDiff < -20) {
    recommendation = 'Great pacing! Keep up the mindful spending';
  } else {
    recommendation = 'Steady spending - you\'re on track';
  }
  
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
  
  const optimizedMessage = `${billsSection}
💰 BALANCE: $${totalAvailable.toFixed(2)}

🏪 PUBLIX: $${publixThisMonth.toFixed(2)} vs $${publixPacedTarget.toFixed(2)} expected
📦 AMAZON: $${amazonThisMonth.toFixed(2)} vs $${amazonPacedTarget.toFixed(2)} expected
💡 ${recommendation}${recentSection}`;
  
  return optimizedMessage;
}

// Copy helper functions from the actual route
async function findUpcomingBillsEnhanced(transactions: Transaction[], userId: string): Promise<Bill[]> {
  const { data: taggedMerchants } = await supabase
    .from('tagged_merchants')
    .select('merchant_name, predicted_amount, predicted_date')
    .eq('user_id', userId)
    .eq('is_recurring', true);
  
  let upcomingBills: Bill[] = [];
  
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
  
  const patternBills = findUpcomingBills(transactions);
  upcomingBills = upcomingBills.concat(patternBills);
  
  upcomingBills.sort((a, b) => a.predictedDate.getTime() - b.predictedDate.getTime());
  
  return upcomingBills;
}

function findUpcomingBills(transactions: Transaction[]): Bill[] {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  
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
  
  merchantMap.forEach((merchantTransactions, merchant) => {
    if (merchantTransactions.length < 2) return;
    
    merchantTransactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const monthlyTransactions = merchantTransactions.filter(t => {
      const transDate = new Date(t.date);
      return transDate.getMonth() === currentMonth - 1 && transDate.getFullYear() === currentYear;
    });
    
    if (monthlyTransactions.length > 0) {
      const lastTransaction = monthlyTransactions[monthlyTransactions.length - 1];
      const lastDate = new Date(lastTransaction.date);
      const predictedDate = new Date(currentYear, currentMonth, lastDate.getDate());
      
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