import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/server';
import { generateSMSMessage } from '@/utils/sms/templates';

export async function GET() {
  try {
    console.log('🧪 Testing SMS templates with real data...');
    
    const supabase = await createSupabaseClient();
    
    // Get all users with bank connections (same as cron job)
    const { data: itemsWithUsers, error: itemsError } = await supabase
      .from('items')
      .select('id, user_id, plaid_item_id');

    if (itemsError || !itemsWithUsers || itemsWithUsers.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'No bank connections found',
        message: 'No users with connected bank accounts found'
      });
    }

    const userId = itemsWithUsers[0].user_id;
    console.log(`📱 Testing templates for user: ${userId}`);

    // Test all three template types (same as cron job)
    const templates: Array<'recurring' | 'recent' | 'pacing'> = ['recurring', 'recent', 'pacing'];
    const results: { template: string; message: string; length: number; hasData: boolean; error?: string }[] = [];

    for (const templateType of templates) {
      try {
        console.log(`�� Testing ${templateType} template...`);
        const message = await generateSMSMessage(userId, templateType);
        
        const hasData = !message.includes('No transactions found') && 
                       !message.includes('No bank accounts connected') &&
                       !message.includes('Error') &&
                       message.length > 15;
        
        results.push({
          template: templateType,
          message: message,
          length: message.length,
          hasData: hasData
        });
        
        console.log(`✅ ${templateType} template: ${message.substring(0, 100)}...`);
      } catch (error) {
        console.error(`❌ Error testing ${templateType} template:`, error);
        results.push({
          template: templateType,
          message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          length: 0,
          hasData: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const successfulTemplates = results.filter(r => r.hasData).length;
    const totalTemplates = templates.length;

    // Also check if user has transactions
    const { data: transactions } = await supabase
      .from('transactions')
      .select('id, date, merchant_name, name, amount')
      .eq('plaid_item_id', itemsWithUsers[0].plaid_item_id)
      .limit(5);

    return NextResponse.json({
      success: true,
      userId: userId,
      userHasTransactions: transactions && transactions.length > 0,
      transactionCount: transactions?.length || 0,
      sampleTransactions: transactions?.slice(0, 3).map(t => ({
        date: t.date,
        merchant: t.merchant_name || t.name,
        amount: t.amount
      })) || [],
      templatesTested: totalTemplates,
      successfulTemplates: successfulTemplates,
      results: results,
      summary: `${successfulTemplates}/${totalTemplates} templates have meaningful data`,
      recommendation: successfulTemplates === 0 
        ? 'No transaction data found. Check if user has recent transactions.'
        : 'Templates are working correctly with user data.'
    });

  } catch (error) {
    console.error('❌ SMS template test error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 