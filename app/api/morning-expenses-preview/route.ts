import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create a Supabase client for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Specific user ID that should receive this SMS
const TARGET_USER_ID = 'bc474c8b-4b47-4c7d-b202-f469330af2a2';

export async function GET() {
  try {
    console.log('👁️ Previewing morning expenses message for user:', TARGET_USER_ID);

    // Build the morning expenses message (same logic as the SMS route but don't send)
    const morningMessage = await buildMorningExpensesMessage(TARGET_USER_ID);
    
    return NextResponse.json({
      success: true,
      message: morningMessage,
      userId: TARGET_USER_ID,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Morning expenses preview error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ 
      success: false, 
      error: errorMessage 
    }, { status: 500 });
  }
}

async function buildMorningExpensesMessage(userId: string): Promise<string> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // Calculate rest of month date range
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  
  console.log(`📅 Fetching expenses from ${today.toISOString()} to ${endOfMonth.toISOString()}`);
  
  let message = `🌅 MORNING SNAPSHOT\n\n`;
  
  // UPCOMING EXPENSES (rest of the month only)
  const upcomingExpenses = await getUpcomingExpenses(userId, today, endOfMonth);
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
  const recentlyPaid = await getRecentlyPaidExpenses(userId);
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

async function getUpcomingExpenses(userId: string, startDate: Date, endDate: Date): Promise<Array<{
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
    console.error('Error in getUpcomingExpenses:', error);
  }
  
  return expenses.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

async function getRecentlyPaidExpenses(userId: string): Promise<Array<{
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
      console.log('No tracked merchants found for user');
      return expenses;
    }
    
    // Get user's items to find their transactions
    const { data: userItems } = await supabase
      .from('items')
      .select('plaid_item_id')
      .eq('user_id', userId)
      .is('deleted_at', null);
    
    if (!userItems || userItems.length === 0) {
      console.log('No items found for user');
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
    console.error('Error in getRecentlyPaidExpenses:', error);
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
