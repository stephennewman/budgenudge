import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
  try {
    const supabase = await createSupabaseClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const merchantName = url.searchParams.get('merchant');

    if (!merchantName) {
      return NextResponse.json({ error: 'merchant parameter is required' }, { status: 400 });
    }

    console.log(`🔍 Checking split integrity for merchant: ${merchantName}`);

    // Get all merchants with this name
    const { data: merchants, error: merchantError } = await supabase
      .from('tagged_merchants')
      .select('*')
      .eq('user_id', user.id)
      .eq('merchant_name', merchantName)
      .order('account_identifier');

    if (merchantError) {
      console.error('Error fetching merchants:', merchantError);
      return NextResponse.json({ error: 'Failed to fetch merchants' }, { status: 500 });
    }

    interface AccountInfo {
      id: number;
      account_identifier: string;
      expected_amount: number;
      is_active: boolean;
      linked_transactions: number;
      transaction_ids: string[];
    }

    interface TransactionLink {
      merchant_id: number;
      account: string;
      transactions: string[];
    }

    const analysis = {
      merchant_name: merchantName,
      total_accounts: merchants?.length || 0,
      accounts: [] as AccountInfo[],
      transaction_links: [] as TransactionLink[]
    };

    if (merchants) {
      for (const merchant of merchants) {
        // Get transaction links for this split account
        const { data: links } = await supabase
          .from('tagged_merchant_transactions')
          .select('transaction_id')
          .eq('tagged_merchant_id', merchant.id)
          .eq('user_id', user.id);

        const accountInfo = {
          id: merchant.id,
          account_identifier: merchant.account_identifier || 'main',
          expected_amount: merchant.expected_amount,
          is_active: merchant.is_active,
          linked_transactions: links?.length || 0,
          transaction_ids: links?.map(l => l.transaction_id) || []
        };

        analysis.accounts.push(accountInfo);
        
        if (links) {
          analysis.transaction_links.push({
            merchant_id: merchant.id,
            account: merchant.account_identifier || 'main',
            transactions: links.map(l => l.transaction_id)
          });
        }
      }
    }

    console.log('🔍 Split integrity analysis:', analysis);

    return NextResponse.json({
      success: true,
      analysis
    });

  } catch (error) {
    console.error('Split integrity check error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 