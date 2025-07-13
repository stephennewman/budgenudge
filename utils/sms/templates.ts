import { createSupabaseClient } from '@/utils/supabase/server';

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

export type SMSTemplateType = 'bills' | 'spending' | 'activity';

// Template 1: Bills & Payments
export async function buildBillsSMS(userId: string): Promise<string> {
  try {
    const supabase = await createSupabaseClient();
    
    // For now, get recent large transactions as "upcoming bills"
    const { data: recentTransactions } = await supabase
      .from('transactions')
      .select('date, name, merchant_name, amount')
      .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('amount', { ascending: false })
      .limit(3);

    let billsSection = '💳 NEXT BILLS:\n';
    
    if (!recentTransactions || recentTransactions.length === 0) {
      billsSection += 'No large transactions found\n';
    } else {
      recentTransactions.forEach(t => {
        const merchant = (t.merchant_name || t.name || 'Unknown').substring(0, 15);
        billsSection += `${merchant}: $${Math.abs(parseFloat(t.amount.toString())).toFixed(2)}\n`;
      });
    }
    
    return billsSection.trim();
  } catch (error) {
    console.error('Error building bills SMS:', error);
    return '💳 BILLS: Error loading data';
  }
}

// Template 2: Spending Analysis  
export async function buildSpendingSMS(allTransactions: Transaction[], userId: string): Promise<string> {
  try {
    if (!allTransactions || allTransactions.length === 0) {
      return '💰 SPENDING: No transaction data available';
    }

    // Calculate today's spending
    const today = new Date().toISOString().split('T')[0];
    const todayTransactions = allTransactions.filter(t => t.date === today);
    const todaySpending = todayTransactions.reduce((sum, t) => sum + Math.abs(parseFloat(t.amount.toString())), 0);
    
    // Calculate this week's spending
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const weekTransactions = allTransactions.filter(t => t.date >= weekAgo);
    const weekSpending = weekTransactions.reduce((sum, t) => sum + Math.abs(parseFloat(t.amount.toString())), 0);

    let spendingSection = '💰 SPENDING:\n';
    spendingSection += `Today: $${todaySpending.toFixed(2)}\n`;
    spendingSection += `This week: $${weekSpending.toFixed(2)}\n`;
    
    if (todayTransactions.length > 0) {
      spendingSection += `Transactions today: ${todayTransactions.length}`;
    }
    
    return spendingSection.trim();
  } catch (error) {
    console.error('Error building spending SMS:', error);
    return '💰 SPENDING: Error loading data';
  }
}

// Template 3: Recent Activity (SIMPLIFIED)
export async function buildActivitySMS(allTransactions: Transaction[]): Promise<string> {
  try {
    if (!allTransactions || allTransactions.length === 0) {
      return '📋 RECENT: No transactions available';
    }
    
    // Get the most recent transactions from the last 5 days
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const recentTransactions = allTransactions
      .filter(t => t.date >= fiveDaysAgo)
      .slice(0, 4); // Show top 4 recent transactions
    
    let recentSection = '📋 RECENT (Last few days):\n';
    
    if (recentTransactions.length === 0) {
      recentSection += 'No recent transactions found\n';
    } else {
      recentTransactions.forEach(t => {
        const merchant = (t.merchant_name || t.name || 'Unknown').substring(0, 18);
        const amount = Math.abs(parseFloat(t.amount.toString()));
        recentSection += `${merchant}: $${amount.toFixed(2)}\n`;
      });
    }
    
    return recentSection.trim();
  } catch (error) {
    console.error('Error building activity SMS:', error);
    return '📋 RECENT: Error loading data';
  }
}

// Helper functions (keeping for compatibility)
async function findUpcomingRecurringBills(userId: string): Promise<Bill[]> {
  return [];
}

function calculateAverageWeeklyPublix(transactions: Transaction[]): number {
  const publixTransactions = transactions.filter(t => 
    (t.merchant_name || t.name).toLowerCase().includes('publix')
  );
  
  if (publixTransactions.length === 0) return 0;
  
  const total = publixTransactions.reduce((sum, t) => 
    sum + Math.abs(parseFloat(t.amount.toString())), 0
  );
  
  return total / Math.max(1, publixTransactions.length);
}

function calculateAverageWeeklyAmazon(transactions: Transaction[]): number {
  const amazonTransactions = transactions.filter(t => 
    (t.merchant_name || t.name).toLowerCase().includes('amazon')
  );
  
  if (amazonTransactions.length === 0) return 0;
  
  const total = amazonTransactions.reduce((sum, t) => 
    sum + Math.abs(parseFloat(t.amount.toString())), 0
  );
  
  return total / Math.max(1, amazonTransactions.length);
} 