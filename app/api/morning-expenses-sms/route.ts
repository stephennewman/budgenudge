import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEnhancedSlickTextSMS } from '@/utils/sms/slicktext-client';

// Create a Supabase client for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Specific user ID that should receive this SMS
const TARGET_USER_ID = 'bc474c8b-4b47-4c7d-b202-f469330af2a2';

export async function POST() {
  try {
    console.log('🌅 Starting morning expenses SMS for user:', TARGET_USER_ID);

    // Get user's phone number from SMS settings
    const { data: smsSettings } = await supabase
      .from('user_sms_settings')
      .select('phone_number')
      .eq('user_id', TARGET_USER_ID)
      .single();

    if (!smsSettings?.phone_number) {
      throw new Error('No phone number found for target user');
    }

    // Build the morning expenses message
    const morningMessage = await buildMorningExpensesMessage(TARGET_USER_ID);
    
    // Send via SlickText
    const result = await sendEnhancedSlickTextSMS({
      phoneNumber: smsSettings.phone_number,
      message: morningMessage,
      userId: TARGET_USER_ID
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Morning expenses SMS sent successfully!',
        messageId: result.messageId,
        timestamp: new Date().toISOString()
      });
    } else {
      throw new Error(result.error || 'Failed to send SMS');
    }
    
  } catch (error) {
    console.error('❌ Morning expenses SMS error:', error);
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
  
  // GET AI-DETECTED INSIGHTS
  const insights = await getExpenseInsights(userId);
  
  // ALERTS SECTION (if any anomalies detected)
  if (insights.newBills.length > 0 || insights.dormantBills.length > 0 || insights.amountChanges.length > 0) {
    message += `⚠️ ALERTS\n`;
    
    if (insights.newBills.length > 0) {
      insights.newBills.slice(0, 2).forEach(bill => {
        message += `• NEW: ${bill.merchant} $${bill.amount.toFixed(2)}/${bill.frequency}\n`;
      });
    }
    
    if (insights.amountChanges.length > 0) {
      insights.amountChanges.slice(0, 2).forEach(change => {
        message += `• CHANGE: ${change.merchant} $${change.oldAmount.toFixed(2)} → $${change.newAmount.toFixed(2)}\n`;
      });
    }
    
    if (insights.dormantBills.length > 0) {
      insights.dormantBills.slice(0, 1).forEach(bill => {
        message += `• DORMANT: ${bill.merchant} (cancelled?)\n`;
      });
    }
    
    message += `\n`;
  }
  
  // UPCOMING EXPENSES (rest of the month only)
  const upcomingExpenses = await getUpcomingExpenses(userId, today, endOfMonth);
  const unpaidTotal = upcomingExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  
  message += `💸 UPCOMING (${upcomingExpenses.length} bills)\n`;
  if (upcomingExpenses.length > 0) {
    upcomingExpenses.slice(0, 5).forEach(expense => {
      const date = new Date(expense.date);
      const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
      message += `${dateStr}: ${expense.merchant} $${expense.amount.toFixed(2)}\n`;
    });
    if (upcomingExpenses.length > 5) {
      message += `...and ${upcomingExpenses.length - 5} more\n`;
    }
    message += `\nUnpaid: $${unpaidTotal.toFixed(2)}\n\n`;
  } else {
    message += `No upcoming expenses\nUnpaid: $0.00\n\n`;
  }
  
  // RECENTLY PAID (show historical expenses that are now paid)
  const recentlyPaid = await getRecentlyPaidExpenses(userId);
  const paidTotal = recentlyPaid.reduce((sum, expense) => sum + expense.amount, 0);
  
  message += `✅ PAID THIS MONTH (${recentlyPaid.length})\n`;
  if (recentlyPaid.length > 0) {
    message += `${recentlyPaid.slice(0, 5).map(e => e.merchant.split(' ')[0]).join(', ')}`;
    if (recentlyPaid.length > 5) {
      message += `, +${recentlyPaid.length - 5} more`;
    }
    message += `\n\nPaid: $${paidTotal.toFixed(2)}`;
  } else {
    message += `None yet\nPaid: $0.00`;
  }
  
  return message;
}

async function getExpenseInsights(userId: string): Promise<{
  newBills: Array<{ merchant: string; amount: number; frequency: string }>;
  dormantBills: Array<{ merchant: string }>;
  amountChanges: Array<{ merchant: string; oldAmount: number; newAmount: number }>;
}> {
  const insights = {
    newBills: [] as Array<{ merchant: string; amount: number; frequency: string }>,
    dormantBills: [] as Array<{ merchant: string }>,
    amountChanges: [] as Array<{ merchant: string; oldAmount: number; newAmount: number }>
  };

  try {
    // Get bills created in last 7 days (new detections)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: newBills } = await supabase
      .from('tagged_merchants')
      .select('merchant_name, expected_amount, prediction_frequency')
      .eq('user_id', userId)
      .eq('auto_detected', true)
      .gte('created_at', sevenDaysAgo.toISOString())
      .limit(3);

    if (newBills) {
      insights.newBills = newBills.map(bill => ({
        merchant: bill.merchant_name,
        amount: Number(bill.expected_amount),
        frequency: bill.prediction_frequency
      }));
    }

    // Get dormant bills (marked in last 7 days)
    const { data: dormantBills } = await supabase
      .from('tagged_merchants')
      .select('merchant_name')
      .eq('user_id', userId)
      .eq('lifecycle_state', 'dormant')
      .gte('updated_at', sevenDaysAgo.toISOString())
      .limit(2);

    if (dormantBills) {
      insights.dormantBills = dormantBills.map(bill => ({
        merchant: bill.merchant_name
      }));
    }

    // Get bills with recent amount changes
    const { data: changedBills } = await supabase
      .from('tagged_merchants')
      .select('merchant_name, expected_amount, amount_drift')
      .eq('user_id', userId)
      .not('amount_drift', 'is', null)
      .neq('amount_drift', 0)
      .gte('updated_at', sevenDaysAgo.toISOString())
      .limit(2);

    if (changedBills) {
      insights.amountChanges = changedBills.map(bill => ({
        merchant: bill.merchant_name,
        newAmount: Number(bill.expected_amount),
        oldAmount: Number(bill.expected_amount) - Number(bill.amount_drift)
      }));
    }

  } catch (error) {
    console.error('Error fetching expense insights:', error);
  }

  return insights;
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
