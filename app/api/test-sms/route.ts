import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEnhancedSlickTextSMS } from '@/utils/sms/slicktext-client';

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

export async function GET() {
  const startTime = new Date();
  console.log(`🧪 TEST SMS: Starting at ${startTime.toISOString()}`);
  
  try {
    // Get all items (bank connections)
    const { data: itemsWithUsers, error: itemsError } = await supabase
      .from('items')
      .select('id, user_id, plaid_item_id');

    if (itemsError) {
      console.error('❌ TEST SMS: Error fetching items:', itemsError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch items',
        details: itemsError,
        timestamp: startTime.toISOString()
      }, { status: 500 });
    }

    if (!itemsWithUsers || itemsWithUsers.length === 0) {
      console.log('📭 TEST SMS: No items found');
      return NextResponse.json({ 
        success: false, 
        error: 'No items found',
        timestamp: startTime.toISOString()
      });
    }

    console.log(`📱 TEST SMS: Found ${itemsWithUsers.length} items`);

    // Process first user for testing
    const firstItem = itemsWithUsers[0];
    const userId = firstItem.user_id;
    
    console.log(`🔍 TEST SMS: Analyzing transactions for user: ${userId}`);
    
    // Get all transactions for this user (last 90 days for analysis)
    const { data: allTransactions, error: transError } = await supabase
      .from('transactions')
      .select('date, name, merchant_name, amount')
      .eq('plaid_item_id', firstItem.plaid_item_id)
      .gte('date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('date', { ascending: false });

    if (transError) {
      console.error('❌ TEST SMS: Error fetching transactions:', transError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch transactions',
        details: transError,
        timestamp: startTime.toISOString()
      }, { status: 500 });
    }

    if (!allTransactions || allTransactions.length === 0) {
      console.log('📭 TEST SMS: No transactions found');
      return NextResponse.json({ 
        success: false, 
        error: 'No transactions found',
        timestamp: startTime.toISOString()
      });
    }

    console.log(`📊 TEST SMS: Found ${allTransactions.length} transactions`);

    // Generate SMS message using the current production logic
    const smsMessage = await buildAdvancedSMSMessage(allTransactions, userId);
    
    console.log(`📱 TEST SMS: Generated message (${smsMessage.length} chars): ${smsMessage.substring(0, 100)}...`);

    // Send SMS using SlickText
    const testNumber = '+16173472721'; // Your phone number
    const fullMessage = `🧪 TEST SMS (${startTime.toLocaleTimeString('en-US', { timeZone: 'America/New_York' })} EST)\n\n${smsMessage}`;
    
    console.log(`📤 TEST SMS: Sending to ${testNumber} (${fullMessage.length} total chars)`);
    
    const smsResult = await sendEnhancedSlickTextSMS({
      phoneNumber: testNumber,
      message: fullMessage,
      userId: userId
    });

    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    if (smsResult.success) {
      console.log(`✅ TEST SMS: Successfully sent! Duration: ${duration}ms`);
      
      // Log to database for tracking
      try {
        await supabase
          .from('sms_test_log')
          .insert({
            timestamp: startTime.toISOString(),
            user_id: userId,
            phone_number: testNumber,
            message_length: fullMessage.length,
            success: true,
            duration_ms: duration,
            message_preview: fullMessage.substring(0, 200)
          });
      } catch (logError) {
        console.warn('⚠️ TEST SMS: Could not log to database:', logError);
      }
      
      return NextResponse.json({ 
        success: true, 
        messageLength: fullMessage.length,
        slickTextLimit: 918,
        isWithinLimit: fullMessage.length <= 918,
        charactersRemaining: 918 - fullMessage.length,
        durationMs: duration,
        timestamp: startTime.toISOString(),
        message: fullMessage
      });
    } else {
      console.log(`❌ TEST SMS: Failed to send. Error: ${smsResult.error}`);
      
      // Log failure to database
      try {
        await supabase
          .from('sms_test_log')
          .insert({
            timestamp: startTime.toISOString(),
            user_id: userId,
            phone_number: testNumber,
            message_length: fullMessage.length,
            success: false,
            error: smsResult.error,
            duration_ms: duration,
            message_preview: fullMessage.substring(0, 200)
          });
      } catch (logError) {
        console.warn('⚠️ TEST SMS: Could not log failure to database:', logError);
      }
      
      return NextResponse.json({ 
        success: false, 
        error: `SMS failed: ${smsResult.error}`,
        messageLength: fullMessage.length,
        durationMs: duration,
        timestamp: startTime.toISOString()
      }, { status: 500 });
    }

  } catch (error) {
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    
    console.error('🚨 TEST SMS: Critical error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error during test SMS',
      details: error instanceof Error ? error.message : 'Unknown error',
      durationMs: duration,
      timestamp: startTime.toISOString()
    }, { status: 500 });
  }
}

// Copy the buildAdvancedSMSMessage function from the cron route
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
  
  // Get next 6 most important bills - ONLY from tagged merchants (recurring bills)
  const upcomingBills = await findUpcomingRecurringBills(userId);
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
  
  const publixPacedDiff = publixThisMonth - publixPacedTarget;
  const amazonPacedDiff = amazonThisMonth - amazonPacedTarget;
  
  // Monthly budgets
  const publixBudget = 400;
  const amazonBudget = 300;
  const publixRemaining = Math.max(0, publixBudget - publixThisMonth);
  const amazonRemaining = Math.max(0, amazonBudget - amazonThisMonth);
  
  // AI Recommendation
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
  
  // Recent transactions (last 3 days, top 6)
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
  
  // Build optimized message for SlickText (under 918 characters)
  const optimizedMessage = `${billsSection}
💰 BALANCE: $${Math.round(totalAvailable)}

🏪 PUBLIX: $${Math.round(publixThisMonth)} vs $${Math.round(publixPacedTarget)} expected pace against $${Math.round(avgPublixMonthly)} avg monthly spend
📦 AMAZON: $${Math.round(amazonThisMonth)} vs $${Math.round(amazonPacedTarget)} expected pace against $${Math.round(avgAmazonMonthly)} avg monthly spend
💡 ${recommendation}${recentSection}`;
  
  console.log(`📱 Optimized SMS generated: ${optimizedMessage.length} characters (SlickText limit: 918)`);
  return optimizedMessage;
}



async function findUpcomingRecurringBills(userId: string): Promise<Bill[]> {
  const { data: taggedMerchants } = await supabase
    .from('tagged_merchants')
    .select('merchant_name, expected_amount, next_predicted_date')
    .eq('user_id', userId)
    .eq('is_active', true);
  
  const upcomingBills: Bill[] = [];
  
  if (taggedMerchants && taggedMerchants.length > 0) {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of day
    taggedMerchants.forEach(tm => {
      const predictedDate = new Date(tm.next_predicted_date);
      predictedDate.setHours(0, 0, 0, 0); // Set to start of day
      // Include bills for today or future
      if (predictedDate >= today) {
        upcomingBills.push({
          merchant: tm.merchant_name,
          amount: `$${tm.expected_amount.toFixed(2)}`,
          predictedDate: predictedDate,
          confidence: 'tagged'
        });
      }
    });
  }
  
  return upcomingBills.sort((a, b) => a.predictedDate.getTime() - b.predictedDate.getTime());
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