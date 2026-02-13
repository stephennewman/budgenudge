import { NextRequest, NextResponse } from 'next/server';
import { plaidClient } from '@/utils/plaid/client';
import { createSupabaseServerClient } from '@/utils/plaid/server';
import { storeTransactions } from '@/utils/plaid/server-enhanced';
import { createClient } from '@supabase/supabase-js';
import { importJWK, jwtVerify, decodeProtectedHeader } from 'jose';
import { createHash } from 'crypto';

// Set timeout to 60 seconds for Hobby plan (prevents 503 errors)
export const maxDuration = 60;

// Cache verification keys for 24 hours to avoid repeated API calls
const keyCache = new Map<string, { key: Awaited<ReturnType<typeof importJWK>>; expiresAt: number }>();

async function verifyPlaidWebhook(request: NextRequest, rawBody: string): Promise<boolean> {
  const signedJwt = request.headers.get('plaid-verification');
  if (!signedJwt) {
    return false;
  }

  try {
    // 1. Decode the JWT header to get the key ID
    const header = decodeProtectedHeader(signedJwt);

    if (header.alg !== 'ES256') {
      return false;
    }

    const kid = header.kid;
    if (!kid) {
      return false;
    }

    // 2. Get the verification key (from cache or Plaid API)
    let verifyKey: Awaited<ReturnType<typeof importJWK>>;
    const cached = keyCache.get(kid);
    if (cached && cached.expiresAt > Date.now()) {
      verifyKey = cached.key;
    } else {
      const keyResponse = await plaidClient.webhookVerificationKeyGet({ key_id: kid });
      const jwk = keyResponse.data.key;
      verifyKey = await importJWK(jwk, 'ES256');
      keyCache.set(kid, { key: verifyKey, expiresAt: Date.now() + 24 * 60 * 60 * 1000 });
    }

    // 3. Verify the JWT signature
    const { payload } = await jwtVerify(signedJwt, verifyKey, {
      algorithms: ['ES256'],
      clockTolerance: 300, // 5 minute tolerance
    });

    // 4. Verify the request body hash matches the JWT claim
    const bodyHash = createHash('sha256').update(rawBody).digest('hex');
    if (payload.request_body_sha256 !== bodyHash) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('Webhook verification failed:', error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const body = JSON.parse(rawBody);

    // Verify webhook signature in production
    if (process.env.PLAID_ENV === 'production') {
      const isValid = await verifyPlaidWebhook(request, rawBody);
      if (!isValid) {
        console.error('❌ WEBHOOK REJECTED: Invalid signature');
        return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
      }
    }

    const { webhook_type, webhook_code, item_id } = body;

    // Handle different webhook types
    switch (webhook_type) {
      case 'TRANSACTIONS':
        await handleTransactionWebhook(webhook_code, item_id, body);
        break;
      
      case 'ITEM':
        await handleItemWebhook(webhook_code, item_id, body);
        break;
      
      default:
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handleTransactionWebhook(webhook_code: string, item_id: string, body: Record<string, unknown>) {
  const supabase = createSupabaseServerClient();
  
  switch (webhook_code) {
    case 'INITIAL_UPDATE':
    case 'HISTORICAL_UPDATE':
    case 'DEFAULT_UPDATE':
      // Get access token for this item and verify it exists
      const { data: item } = await supabase
        .from('items')
        .select('plaid_access_token, plaid_item_id')
        .eq('plaid_item_id', item_id)
        .single();

      if (!item) {
        console.error(`Item not found: ${item_id}`);
        return;
      }

      // Fetch new transactions
      try {
        const response = await plaidClient.transactionsGet({
          access_token: item.plaid_access_token,
          start_date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          end_date: new Date().toISOString().split('T')[0],
        });

        // Store transactions in database using the verified database plaid_item_id
        const storedTransactions = await storeTransactions(response.data.transactions, item.plaid_item_id);
        
        if (storedTransactions && storedTransactions.length > 0) {
        }
        
        // Update account balances
        try {
          const accountsResponse = await plaidClient.accountsGet({
            access_token: item.plaid_access_token,
          });

          const supabaseService = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          );

          for (const account of accountsResponse.data.accounts) {
            const balance = account.balances;
            
            await supabaseService
              .from('accounts')
              .update({
                current_balance: balance.current,
                available_balance: balance.available,
                iso_currency_code: balance.iso_currency_code || 'USD',
                balance_last_updated: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('plaid_account_id', account.account_id);
          }
        } catch (error) {
          console.error('Error updating balances:', error);
        }
      } catch (error) {
        console.error('Error fetching transactions:', error);
      }
      break;

    case 'TRANSACTIONS_REMOVED':
      // Handle removed transactions
      const { removed_transactions } = body;
      if (removed_transactions && Array.isArray(removed_transactions) && removed_transactions.length > 0) {
        await supabase
          .from('transactions')
          .delete()
          .in('plaid_transaction_id', removed_transactions);
      }
      break;

    default:
  }
}



async function handleItemWebhook(webhook_code: string, item_id: string, body: Record<string, unknown>) {
  const supabase = createSupabaseServerClient();

  switch (webhook_code) {
    case 'ERROR':
      console.error(`Item error for ${item_id}:`, body.error);
      
      await supabase
        .from('items')
        .update({ status: 'error' })
        .eq('plaid_item_id', item_id);
      break;

    case 'PENDING_EXPIRATION':
      await supabase
        .from('items')
        .update({ status: 'pending_expiration' })
        .eq('plaid_item_id', item_id);
      break;

    case 'ITEM_REMOVED':
      // Check if this was an intentional disconnection or external removal
      const { data: itemData } = await supabase
        .from('items')
        .select('id, deleted_at, retention_choice, institution_name, user_id')
        .eq('plaid_item_id', item_id)
        .single();

      if (itemData) {
        if (!itemData.deleted_at) {
          // External removal - user likely disconnected from bank's side
          await supabase
            .from('items')
            .update({ 
              status: 'disconnected_external',
              deleted_at: new Date().toISOString(),
              retention_choice: 'soft_30_days',
              permanent_delete_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            })
            .eq('plaid_item_id', item_id);

          await supabase
            .from('audit_log')
            .insert({
              user_id: itemData.user_id,
              action: 'item_disconnected_external',
              details: {
                item_id: item_id,
                institution_name: itemData.institution_name,
                reason: 'External removal detected via webhook'
              }
            });
        }
      }
      break;

    default:
  }
} 