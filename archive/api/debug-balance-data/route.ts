import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { plaidClient } from '@/utils/plaid/client';

interface BalanceDiagnostic {
  account_id: string;
  account_name: string;
  account_type: string;
  institution: string;
  plaid_current: number | null;
  plaid_available: number | null;
  plaid_currency: string | null;
  stored_current: number | null;
  stored_available: number | null;
  stored_last_updated: string | null;
  stored_updated_at: string | null;
  current_balance_match: boolean;
  available_balance_match: boolean;
  hours_stale: number | null;
  staleness_level: string;
  current_discrepancy: number | null;
  available_discrepancy: number | null;
  missing_stored_data: boolean;
  missing_plaid_current: boolean;
  missing_plaid_available: boolean;
  pending_transactions_count: number;
  pending_transactions_amount: number;
  pending_impact_on_available: number | null;
}

interface DiagnosticError {
  item_id: string;
  institution: string;
  error: string;
  error_details: string;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized - Missing token' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`🔍 Balance diagnostic for user: ${user.id}`);

    // Get user's items and accounts
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('id, plaid_item_id, plaid_access_token, plaid_institution_id')
      .eq('user_id', user.id);

    if (itemsError || !items?.length) {
      return NextResponse.json({ 
        error: 'No connected accounts found',
        user_id: user.id 
      }, { status: 404 });
    }

    // Get stored account balance data
    const { data: storedAccounts, error: accountsError } = await supabase
      .from('accounts')
      .select(`
        id,
        plaid_account_id,
        name,
        type,
        subtype,
        current_balance,
        available_balance,
        balance_last_updated,
        updated_at,
        item_id
      `)
      .in('item_id', items.map(item => item.id));

    if (accountsError) {
      console.error('Error fetching stored accounts:', accountsError);
      return NextResponse.json({ 
        error: 'Failed to fetch stored account data',
        details: accountsError
      }, { status: 500 });
    }

    console.log(`📊 Found ${storedAccounts?.length || 0} stored accounts`);

    // Get pending transactions for analysis
    const { data: pendingTransactions } = await supabase
      .from('transactions')
      .select('account_id, amount, name, date, pending, plaid_transaction_id')
      .eq('pending', true)
      .in('plaid_item_id', items?.map(i => i.plaid_item_id) || []);

    console.log(`⏳ Found ${pendingTransactions?.length || 0} pending transactions`);

    const diagnostics: (BalanceDiagnostic | DiagnosticError)[] = [];

    // Check each item for real-time vs stored balance discrepancies
    for (const item of items) {
      try {
        console.log(`🏦 Checking item: ${item.plaid_item_id}`);

        // Fetch real-time balance data from Plaid
        const accountsResponse = await plaidClient.accountsGet({
          access_token: item.plaid_access_token,
        });

        const realTimeAccounts = accountsResponse.data.accounts;
        
        // Compare with stored data
        for (const realTimeAccount of realTimeAccounts) {
          const storedAccount = storedAccounts?.find(
            acc => acc.plaid_account_id === realTimeAccount.account_id
          );

          const now = new Date();
          const lastUpdated = storedAccount?.balance_last_updated 
            ? new Date(storedAccount.balance_last_updated)
            : null;
          
          const hoursStale = lastUpdated 
            ? Math.round((now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60))
            : null;

          // Calculate pending transaction impact for this account
          const accountPendingTxns = pendingTransactions?.filter(
            tx => tx.account_id === realTimeAccount.account_id
          ) || [];
          
          const pendingAmount = accountPendingTxns.reduce((sum, tx) => sum + tx.amount, 0);
          const pendingCount = accountPendingTxns.length;

          const diagnostic: BalanceDiagnostic = {
            account_id: realTimeAccount.account_id,
            account_name: realTimeAccount.name,
            account_type: `${realTimeAccount.type}${realTimeAccount.subtype ? ` (${realTimeAccount.subtype})` : ''}`,
            institution: item.plaid_institution_id,
            
            // Real-time Plaid data
            plaid_current: realTimeAccount.balances.current,
            plaid_available: realTimeAccount.balances.available,
            plaid_currency: realTimeAccount.balances.iso_currency_code,
            
            // Stored database data
            stored_current: storedAccount?.current_balance,
            stored_available: storedAccount?.available_balance,
            stored_last_updated: storedAccount?.balance_last_updated,
            stored_updated_at: storedAccount?.updated_at,
            
            // Analysis
            current_balance_match: realTimeAccount.balances.current === storedAccount?.current_balance,
            available_balance_match: realTimeAccount.balances.available === storedAccount?.available_balance,
            hours_stale: hoursStale,
            staleness_level: hoursStale === null ? 'never_updated' : 
                           hoursStale < 1 ? 'fresh' :
                           hoursStale < 24 ? 'stale' : 'very_stale',
            
            // Discrepancies
            current_discrepancy: realTimeAccount.balances.current && storedAccount?.current_balance
              ? realTimeAccount.balances.current - storedAccount.current_balance
              : null,
            available_discrepancy: realTimeAccount.balances.available && storedAccount?.available_balance
              ? realTimeAccount.balances.available - storedAccount.available_balance
              : null,
              
            // Missing data flags
            missing_stored_data: !storedAccount,
            missing_plaid_current: realTimeAccount.balances.current === null,
            missing_plaid_available: realTimeAccount.balances.available === null,
            
            // Pending transaction analysis
            pending_transactions_count: pendingCount,
            pending_transactions_amount: pendingAmount,
            pending_impact_on_available: realTimeAccount.balances.available !== null && storedAccount?.available_balance !== null 
              ? (realTimeAccount.balances.available - storedAccount!.available_balance) 
              : null,
          };

          diagnostics.push(diagnostic);
        }

      } catch (plaidError) {
        console.error(`❌ Plaid error for item ${item.plaid_item_id}:`, plaidError);
        const errorDiagnostic: DiagnosticError = {
          item_id: item.plaid_item_id,
          institution: item.plaid_institution_id,
          error: 'Failed to fetch real-time Plaid data',
          error_details: plaidError instanceof Error ? plaidError.message : 'Unknown error'
        };
        diagnostics.push(errorDiagnostic);
      }
    }

    // Summary analysis - use type guards
    const isBalanceDiagnostic = (d: BalanceDiagnostic | DiagnosticError): d is BalanceDiagnostic => {
      return !('error' in d);
    };
    
    const validDiagnostics = diagnostics.filter(isBalanceDiagnostic);
    const totalAccounts = validDiagnostics.length;
    const matchingCurrent = validDiagnostics.filter(d => d.current_balance_match).length;
    const matchingAvailable = validDiagnostics.filter(d => d.available_balance_match).length;
    const staleAccounts = validDiagnostics.filter(d => d.hours_stale && d.hours_stale > 1).length;
    const neverUpdated = validDiagnostics.filter(d => d.staleness_level === 'never_updated').length;

    const summary = {
      user_id: user.id,
      timestamp: new Date().toISOString(),
      total_accounts: totalAccounts,
      accounts_with_matching_current: matchingCurrent,
      accounts_with_matching_available: matchingAvailable,
      accounts_stale_over_1hr: staleAccounts,
      accounts_never_updated: neverUpdated,
      current_balance_accuracy: totalAccounts > 0 ? `${matchingCurrent}/${totalAccounts} (${Math.round(matchingCurrent/totalAccounts*100)}%)` : '0%',
      available_balance_accuracy: totalAccounts > 0 ? `${matchingAvailable}/${totalAccounts} (${Math.round(matchingAvailable/totalAccounts*100)}%)` : '0%',
      data_freshness_issues: staleAccounts > 0 || neverUpdated > 0
    };

    console.log(`📊 Balance diagnostic complete:`, summary);

    // Calculate pending transaction metrics
    const totalPendingTxns = validDiagnostics.reduce((sum, d) => sum + d.pending_transactions_count, 0);
    const accountsWithPending = validDiagnostics.filter(d => d.pending_transactions_count > 0).length;
    const totalPendingAmount = validDiagnostics.reduce((sum, d) => sum + Math.abs(d.pending_transactions_amount), 0);

    const recommendations = [
      summary.data_freshness_issues ? "🚨 Balance data is stale - recommend implementing real-time balance refresh" : "✅ Balance data is fresh",
      summary.current_balance_accuracy !== '100%' ? "⚠️ Current balance mismatches detected" : "✅ Current balances match",
      summary.available_balance_accuracy !== '100%' ? "⚠️ Available balance mismatches detected" : "✅ Available balances match"
    ];

    if (totalPendingTxns > 0) {
      recommendations.push(`⏳ Found ${totalPendingTxns} pending transactions ($${totalPendingAmount.toFixed(2)}) across ${accountsWithPending} accounts - these affect available balance but are excluded from KREZZO calculations`);
      recommendations.push("🎯 KEY INSIGHT: Pending transactions are likely the main cause of balance discrepancies");
      recommendations.push("💡 Recommend including pending transactions in balance calculations and UI");
    }

    recommendations.push("💡 Consider switching from accountsGet() to balanceGet() for real-time data");
    recommendations.push("💡 Add scheduled balance refresh cron job");
    recommendations.push("💡 Add balance staleness indicators in UI");

    return NextResponse.json({
      success: true,
      summary: {
        ...summary,
        pending_transactions_total: totalPendingTxns,
        accounts_with_pending: accountsWithPending,
        pending_amount_total: totalPendingAmount
      },
      diagnostics,
      recommendations
    });

  } catch (error) {
    console.error('❌ Balance diagnostic error:', error);
    return NextResponse.json(
      { 
        error: 'Balance diagnostic failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
