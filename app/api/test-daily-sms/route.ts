import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEnhancedSlickTextSMS } from '@/utils/sms/slicktext-client';

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

export async function GET() {
  try {
    console.log('🧪 Testing daily SMS system manually...');
    
    const now = new Date();
    console.log(`⏰ Manual Test Time:
      - Server Time (UTC): ${now.toISOString()}
      - Server Time (Local): ${now.toLocaleString()}
      - Purpose: Manual test of daily SMS analysis
    `);
    
    // Get all users who have transactions and phone numbers
    const { data: usersWithTransactions, error: usersError } = await supabase
      .from('users')
      .select(`
        id,
        phone,
        email,
        items!inner (
          id,
          transactions!inner (
            id,
            date,
            name,
            merchant_name,
            amount
          )
        )
      `)
      .not('phone', 'is', null)
      .not('phone', 'eq', '');

    if (usersError) {
      console.error('Error fetching users with transactions:', usersError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch users with transactions' 
      }, { status: 500 });
    }

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
    const results: { userId: string; status: string; error?: string; reason?: string; messageId?: string }[] = [];

    // Process each user
    for (const user of usersWithTransactions) {
      try {
        console.log(`🔍 Analyzing transactions for user: ${user.id}`);
        
        // Get all transactions for this user (last 90 days for analysis)
        const { data: allTransactions, error: transError } = await supabase
          .from('transactions')
          .select('date, name, merchant_name, amount')
          .in('item_id', user.items.map((item: { id: number }) => item.id))
          .gte('date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
          .order('date', { ascending: false });

        if (transError) {
          console.error(`Error fetching transactions for user ${user.id}:`, transError);
          failureCount++;
          results.push({ userId: user.id, status: 'failed', error: transError.message });
          continue;
        }

        if (!allTransactions || allTransactions.length === 0) {
          console.log(`📭 No recent transactions found for user ${user.id}`);
          results.push({ userId: user.id, status: 'skipped', reason: 'No recent transactions' });
          continue;
        }

        // Generate advanced SMS message using existing logic
        const smsMessage = await buildAdvancedSMSMessage(allTransactions, user.id);
        
        console.log(`📱 Generated SMS for user ${user.id}: ${smsMessage.substring(0, 100)}...`);

        // Send SMS using SlickText
        const smsResult = await sendEnhancedSlickTextSMS({
          phoneNumber: user.phone,
          message: `🧪 TEST - DAILY BUDGENUDGE INSIGHT\n\n${smsMessage}`,
          userId: user.id
        });

        if (smsResult.success) {
          console.log(`✅ Test SMS sent successfully to user: ${user.id}`);
          successCount++;
          results.push({ userId: user.id, status: 'success', messageId: smsResult.messageId });
        } else {
          console.log(`❌ Test SMS failed for user ${user.id}: ${smsResult.error}`);
          failureCount++;
          results.push({ userId: user.id, status: 'failed', error: smsResult.error });
        }

      } catch (error) {
        console.log(`❌ Test SMS error for user ${user.id}: ${error}`);
        failureCount++;
        results.push({ userId: user.id, status: 'failed', error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    console.log(`📊 Test SMS processing complete: ${successCount} sent, ${failureCount} failed`);

    return NextResponse.json({ 
      success: true, 
      processed: usersWithTransactions.length,
      sent: successCount,
      failed: failureCount,
      results,
      message: `Manual test completed for ${usersWithTransactions.length} users`
    });

  } catch (error) {
    console.error('🚨 Test SMS processing error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error during test SMS processing' 
    }, { status: 500 });
  }
}

// Copy the analysis functions from the webhook
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
  
  // Monthly calculations
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
  
  // AI Recommendation
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

// Helper functions
async function findUpcomingRecurringBills(userId: string): Promise<Array<{
  merchant: string;
  amount: string;
  predictedDate: Date;
  confidence: string;
}>> {
  const { data: taggedMerchants } = await supabase
    .from('tagged_merchants')
    .select('merchant_name, expected_amount, next_predicted_date')
    .eq('user_id', userId)
    .eq('is_active', true);
  
  let upcomingBills: Array<{
    merchant: string;
    amount: string;
    predictedDate: Date;
    confidence: string;
  }> = [];
  
  if (taggedMerchants && taggedMerchants.length > 0) {
    const now = new Date();
    taggedMerchants.forEach(tm => {
      const predictedDate = new Date(tm.next_predicted_date);
      // Only include future bills
      if (predictedDate > now) {
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
  
  const totalSpent = publixTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const oldestDate = new Date(publixTransactions[publixTransactions.length - 1].date);
  const newestDate = new Date(publixTransactions[0].date);
  const daysDiff = Math.max(1, (newestDate.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24));
  const weeksDiff = daysDiff / 7;
  
  return totalSpent / weeksDiff;
}

function calculateAverageWeeklyAmazon(transactions: Transaction[]): number {
  const amazonTransactions = transactions.filter(t => 
    (t.merchant_name || t.name || '').toLowerCase().includes('amazon')
  );
  
  if (amazonTransactions.length === 0) return 0;
  
  const totalSpent = amazonTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const oldestDate = new Date(amazonTransactions[amazonTransactions.length - 1].date);
  const newestDate = new Date(amazonTransactions[0].date);
  const daysDiff = Math.max(1, (newestDate.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24));
  const weeksDiff = daysDiff / 7;
  
  return totalSpent / weeksDiff;
} 