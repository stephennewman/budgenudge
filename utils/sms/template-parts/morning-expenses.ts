import { supabase, type Transaction, type MerchantPacing } from './shared';
import {
  getUserFirstName,
  runEnhancedBillDetectionInTemplate,
  analyzeMerchantPatternForTemplate,
  isNonBillMerchant,
  calculateEnhancedBillScoreForTemplate,
  isBillMerchant,
  normalizeMerchantNameForTemplate,
  calculateVarianceForTemplate,
  findNextIncome,
  normalizeIncomeSourceName,
  generateAIVibeMessage,
  generateEnhancedAIVibeMessage,
  generateActionItems,
} from './helpers';
import { generateMorningInsightText } from '@/utils/sms/morning-insights';

export async function generateMorningExpensesMessage(userId: string): Promise<string> {
  // New behavioral morning text (Claude-composed from deterministic stats).
  // Falls back to the legacy static snapshot below if it can't be produced.
  try {
    const insightText = await generateMorningInsightText(userId);
    if (insightText && insightText.trim().length >= 15) {
      return insightText.trim();
    }
  } catch (error) {
    console.error('Error generating behavioral morning text, falling back to snapshot:', error);
  }

  return generateMorningExpensesSnapshot(userId);
}

export async function generateMorningExpensesSnapshot(userId: string): Promise<string> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // Calculate rest of month date range
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  
  let message = `🌅 MORNING SNAPSHOT\n\n`;
  
  // AVAILABLE BALANCE
  try {
    const { data: items } = await supabase
      .from('items')
      .select(`
        accounts!inner(available_balance, name, current_balance)
      `)
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (items && items.length > 0) {
      let totalAvailable = 0;
      let totalCurrent = 0;
      
      items.forEach(item => {
        if (item.accounts && Array.isArray(item.accounts)) {
          item.accounts.forEach(account => {
            totalAvailable += account.available_balance || 0;
            totalCurrent += account.current_balance || 0;
          });
        }
      });

      message += `💰 AVAILABLE BALANCE\n`;
      message += `Available: $${totalAvailable.toFixed(2)}\n`;
      message += `Current: $${totalCurrent.toFixed(2)}\n\n`;
    }
  } catch (error) {
    console.error('Error fetching balance for morning snapshot:', error);
    // Continue without balance if there's an error
  }
  
  // UPCOMING EXPENSES (rest of the month only)
  const upcomingExpenses = await getMorningUpcomingExpenses(userId, today, endOfMonth);
  const unpaidTotal = upcomingExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  
  message += `💸 UPCOMING EXPENSES (rest of the month only)\n`;
  if (upcomingExpenses.length > 0) {
    upcomingExpenses.forEach(expense => {
      const date = new Date(expense.date);
      const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
      message += `${dateStr}: ${expense.merchant} $${expense.amount.toFixed(2)}\n`;
    });
    message += `\nUnpaid: $${unpaidTotal.toFixed(2)}\n\n`;
  } else {
    message += `No upcoming expenses found\n\nUnpaid: $0.00\n\n`;
  }
  
  // RECENTLY PAID (show historical expenses that are now paid)
  const recentlyPaid = await getMorningRecentlyPaidExpenses(userId);
  const paidTotal = recentlyPaid.reduce((sum, expense) => sum + expense.amount, 0);
  
  message += `✅ RECENTLY PAID\n`;
  if (recentlyPaid.length > 0) {
    recentlyPaid.forEach(expense => {
      const date = new Date(expense.date);
      const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
      message += `${dateStr}: ${expense.merchant} $${expense.amount.toFixed(2)}\n`;
    });
    message += `\nPaid: $${paidTotal.toFixed(2)}`;
  } else {
    message += `No recently paid expenses found\n\nPaid: $0.00`;
  }
  
  return message;
}

export async function getMorningUpcomingExpenses(userId: string, startDate: Date, endDate: Date): Promise<Array<{
  merchant: string;
  amount: number;
  date: string;
}>> {
  const expenses: Array<{
    merchant: string;
    amount: number;
    date: string;
  }> = [];
  
  try {
    // Get upcoming bills from tagged_merchants table (predicted future expenses)
    const { data: taggedMerchants, error } = await supabase
      .from('tagged_merchants')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('next_predicted_date', { ascending: true });
    
    if (error) {
      console.error('Error fetching tagged merchants:', error);
      return expenses;
    }
    
    if (taggedMerchants && taggedMerchants.length > 0) {
      taggedMerchants.forEach(merchant => {
        const predictedDate = new Date(merchant.next_predicted_date + 'T12:00:00');
        predictedDate.setHours(0, 0, 0, 0);
        
        // Filter out shopping/non-bill merchants from upcoming expenses too
        const shoppingMerchants = ['amazon', 'apple', 'target', 'walmart', 'costco', 'publix', 'kroger'];
        const merchantNameLower = merchant.merchant_name.toLowerCase();
        const isShoppingMerchant = shoppingMerchants.some(shopping => 
          merchantNameLower.includes(shopping)
        );
        
        // Only include bills for rest of month (today through end of month) and exclude shopping
        if (predictedDate >= startDate && predictedDate <= endDate && !isShoppingMerchant) {
          expenses.push({
            merchant: merchant.merchant_name,
            amount: Number(merchant.expected_amount),
            date: merchant.next_predicted_date
          });
        }
      });
    }
  } catch (error) {
    console.error('Error in getMorningUpcomingExpenses:', error);
  }
  
  return expenses.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export async function getMorningRecentlyPaidExpenses(userId: string): Promise<Array<{
  merchant: string;
  amount: number;
  date: string;
}>> {
  const expenses: Array<{
    merchant: string;
    amount: number;
    date: string;
  }> = [];
  
  const now = new Date();
  
  try {
    // Get tracked merchants (the ones we're monitoring)
    const { data: trackedMerchants, error: merchantError } = await supabase
      .from('tagged_merchants')
      .select('merchant_name')
      .eq('user_id', userId)
      .eq('is_active', true);
    
    if (merchantError) {
      console.error('Error fetching tracked merchants:', merchantError);
      return expenses;
    }
    
    if (!trackedMerchants || trackedMerchants.length === 0) {
      return expenses;
    }
    
    // Get user's items to find their transactions
    const { data: userItems } = await supabase
      .from('items')
      .select('plaid_item_id')
      .eq('user_id', userId)
      .is('deleted_at', null);
    
    if (!userItems || userItems.length === 0) {
      return expenses;
    }
    
    const itemIds = userItems.map(item => item.plaid_item_id);
    
    // Get recent transactions from tracked merchants - entire current month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthStartStr = monthStart.toISOString().split('T')[0];
    
    const { data: recentTransactions } = await supabase
      .from('transactions')
      .select('date, merchant_name, name, amount')
      .in('plaid_item_id', itemIds)
      .gte('date', monthStartStr)
      .order('date', { ascending: false })
      .limit(1000); // Get all transactions for the month
    
    if (recentTransactions && recentTransactions.length > 0) {
      // Match transactions to tracked merchants
      const trackedMerchantNames = trackedMerchants.map(m => m.merchant_name.toLowerCase());
      
      recentTransactions.forEach(transaction => {
        const transactionMerchant = (transaction.merchant_name || transaction.name || '').toLowerCase();
        
        // Check if this transaction matches any of our tracked merchants
        const matchedMerchant = trackedMerchantNames.find(tracked => 
          transactionMerchant.includes(tracked.toLowerCase()) || 
          tracked.toLowerCase().includes(transactionMerchant)
        );
        
        // Filter out shopping/non-bill merchants
        const shoppingMerchants = ['amazon', 'apple', 'target', 'walmart', 'costco', 'publix', 'kroger'];
        const transactionMerchantLower = (transaction.merchant_name || transaction.name || '').toLowerCase();
        const isShoppingMerchant = shoppingMerchants.some(shopping => 
          transactionMerchantLower.includes(shopping)
        );
        
        if (matchedMerchant && transaction.amount > 0 && !isShoppingMerchant) { // Only include bills/expenses, not shopping
          expenses.push({
            merchant: transaction.merchant_name || transaction.name || 'Unknown',
            amount: Math.abs(transaction.amount),
            date: transaction.date
          });
        }
      });
    }
  } catch (error) {
    console.error('Error in getMorningRecentlyPaidExpenses:', error);
  }
  
  // Group by date and merchant to avoid showing duplicate entries but keep all transactions
  const uniqueExpenses = expenses.filter((expense, index, self) => 
    index === self.findIndex(e => 
      e.merchant === expense.merchant && 
      e.date === expense.date && 
      e.amount === expense.amount
    )
  );
  
  return uniqueExpenses
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 30); // Show all August transactions
}

// ===================================
// 9. 5:30 PM KREZZO REPORT TEMPLATE (IMPROVED)
// ===================================
// 5:30 PM KREZZO REPORT - Enhanced format with better emojis and readability
