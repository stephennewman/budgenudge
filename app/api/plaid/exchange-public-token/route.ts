import { NextRequest, NextResponse } from 'next/server';
import { plaidClient, handlePlaidError } from '@/utils/plaid/client';
import { storeItem, storeTransactions } from '@/utils/plaid/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { public_token } = await request.json();

    if (!public_token) {
      return NextResponse.json(
        { error: 'public_token is required' },
        { status: 400 }
      );
    }

    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized - Missing token' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Create Supabase client and get user with token
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Exchange public token for access token
    const response = await plaidClient.itemPublicTokenExchange({
      public_token,
    });

    const { access_token, item_id } = response.data;

    // Get institution info
    const itemResponse = await plaidClient.itemGet({
      access_token,
    });

    // Store item in database
    await storeItem(
      user.id,
      item_id,
      access_token,
      itemResponse.data.item.institution_id!
    );

    // Fetch and store accounts
    const accountsResponse = await plaidClient.accountsGet({
      access_token,
    });

    // Store accounts in database
    const supabaseService = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get the database item ID for proper foreign key relationship
    const { data: storedItem, error: itemLookupError } = await supabaseService
      .from('items')
      .select('id')
      .eq('plaid_item_id', item_id)
      .eq('user_id', user.id)
      .single();

    if (itemLookupError || !storedItem) {
      throw new Error(`Failed to find stored item for linking accounts: ${itemLookupError?.message || 'Item not found'}`);
    }

    for (const account of accountsResponse.data.accounts) {
      const balance = account.balances;
      await supabaseService
        .from('accounts')
        .upsert({
          item_id: storedItem.id, // ✅ CORRECT: Use database item ID for foreign key
          plaid_account_id: account.account_id,
          name: account.name,
          official_name: account.official_name,
          type: account.type,
          subtype: account.subtype,
          mask: account.mask,
          current_balance: balance.current,
          available_balance: balance.available,
          iso_currency_code: balance.iso_currency_code || 'USD',
          balance_last_updated: new Date().toISOString(),
        }, { onConflict: 'plaid_account_id' });
    }

    // Fetch initial transactions (last 30 days)
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = new Date().toISOString().split('T')[0];

    const transactionsResponse = await plaidClient.transactionsGet({
      access_token,
      start_date: startDate,
      end_date: endDate,
    });

    // Store transactions in database
    if (transactionsResponse.data.transactions.length > 0) {
      await storeTransactions(transactionsResponse.data.transactions, item_id);
      
      // 🆕 PHASE 1: Trigger AI tagging for all historical transactions
      // This ensures new users see clean merchant names from day 1
      try {
        console.log('🤖 Triggering historical AI tagging for new account...');
        const tagResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/tag-all-transactions`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` // Pass through user's auth token
          },
          body: JSON.stringify({ 
            max_transactions: 1000 // Process up to 1000 historical transactions
          })
        });

        if (tagResponse.ok) {
          const tagResult = await tagResponse.json();
          console.log('✅ Historical AI tagging initiated:', tagResult.tagged || 0, 'transactions processed');
        } else {
          console.log('⚠️ Historical AI tagging failed (non-blocking):', tagResponse.status);
        }
      } catch (tagError) {
        console.log('⚠️ Historical AI tagging error (non-blocking):', tagError);
        // Non-blocking: Account setup continues even if AI tagging fails
      }

      // 🆕 PHASE 2: Trigger auto-selection for pacing tracking
      // This sets up merchant and category tracking for new users automatically
      try {
        console.log('🎯 Triggering pacing auto-selection for new account...');
        const autoSelectResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/auto-select-pacing`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` // Pass through user's auth token
          }
        });

        if (autoSelectResponse.ok) {
          const autoSelectResult = await autoSelectResponse.json();
          console.log('✅ Pacing auto-selection completed:', {
            merchants: autoSelectResult.merchants_selected || 0,
            categories: autoSelectResult.categories_selected || 0,
            total: autoSelectResult.total_selected || 0
          });
        } else {
          console.log('⚠️ Pacing auto-selection failed (non-blocking):', autoSelectResponse.status);
        }
      } catch (autoSelectError) {
        console.log('⚠️ Pacing auto-selection error (non-blocking):', autoSelectError);
        // Non-blocking: Account setup continues even if auto-selection fails
      }

      // 🆕 PHASE 3: Trigger automatic recurring bill detection
      // This analyzes transaction patterns to auto-detect recurring bills
      try {
        console.log('💳 Triggering automatic recurring bill detection for new account...');
        const billDetectionResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/auto-detect-recurring-bills`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` // Pass through user's auth token
          },
          body: JSON.stringify({ 
            user_id: user.id,
            confidence_threshold: 85 // Minimum confidence for auto-inclusion
          })
        });

        if (billDetectionResponse.ok) {
          const billResult = await billDetectionResponse.json();
          console.log('✅ Automatic recurring bill detection completed:', {
            bills_detected: billResult.bills_detected || 0,
            total_monthly_amount: billResult.total_monthly_amount || 0
          });
        } else {
          console.log('⚠️ Automatic recurring bill detection failed (non-blocking):', billDetectionResponse.status);
        }
      } catch (billDetectionError) {
        console.log('⚠️ Automatic recurring bill detection error (non-blocking):', billDetectionError);
        // Non-blocking: Account setup continues even if bill detection fails
      }

      // 🆕 PHASE 4: Complete SMS workflow setup for new users
      // This ensures all future users get full SMS functionality automatically
      try {
        console.log('📱 Setting up complete SMS workflow for new user...');
        
        // 4A: Create SMS preferences for all 4 message types
        const smsPreferencesResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/sms-preferences`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            userId: user.id,
            preferences: [
              { sms_type: 'activity', enabled: true, frequency: 'daily', phone_number: null },
              { sms_type: 'bills', enabled: true, frequency: 'daily', phone_number: null },
              { sms_type: 'merchant-pacing', enabled: true, frequency: 'daily', phone_number: null },
              { sms_type: 'category-pacing', enabled: true, frequency: 'daily', phone_number: null }
            ]
          })
        });

        if (smsPreferencesResponse.ok) {
          console.log('✅ SMS preferences created for all 4 message types');
        } else {
          console.log('⚠️ SMS preferences setup failed (non-blocking):', smsPreferencesResponse.status);
        }

        // 4B: Create user_sms_settings with default 8AM send time
        const { data: profileData } = await supabase
          .from('profiles')
          .select('phone_number')
          .eq('id', user.id)
          .single();

        const phoneNumber = profileData?.phone_number || null;

        const { error: smsSettingsError } = await supabase
          .from('user_sms_settings')
          .upsert({
            user_id: user.id,
            phone_number: phoneNumber,
            send_time: '08:00:00'
          }, {
            onConflict: 'user_id'
          });

        if (!smsSettingsError) {
          console.log('✅ SMS settings created with 8AM default send time');
        } else {
          console.log('⚠️ SMS settings creation failed (non-blocking):', smsSettingsError.message);
        }

      } catch (smsSetupError) {
        console.log('⚠️ SMS workflow setup error (non-blocking):', smsSetupError);
        // Non-blocking: Account setup continues even if SMS setup fails
      }
    }

    return NextResponse.json({ 
      success: true,
      item_id,
      accounts: accountsResponse.data.accounts.length,
      transactions: transactionsResponse.data.transactions.length
    });
  } catch (error: unknown) {
    console.error('Error exchanging public token:', error);
    
    // Try to extract more details about the error
    if (error && typeof error === 'object' && 'response' in error) {
      const typedError = error as { response?: { data?: { error_message?: string; error_code?: string } } };
      if (typedError.response?.data) {
        console.error('Plaid API Error Details:', typedError.response.data);
      }
    }
    
    handlePlaidError(error);
    
    // More descriptive error response with proper type checking
    let errorMessage = 'Failed to exchange token';
    let errorCode = 'UNKNOWN_ERROR';
    
    if (error && typeof error === 'object' && 'response' in error) {
      const typedError = error as { response?: { data?: { error_message?: string; error_code?: string } } };
      errorMessage = typedError.response?.data?.error_message || errorMessage;
      errorCode = typedError.response?.data?.error_code || errorCode;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        error_code: errorCode,
        details: 'Please try reconnecting your account. If the issue persists, contact support.'
      },
      { status: 500 }
    );
  }
} 