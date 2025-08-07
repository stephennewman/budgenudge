import { NextResponse } from 'next/server';
import { 
  getSecurityContext, 
  getUserTransactions, 
  createSecureQuery, 
  requireAuth,
  createSecureResponse 
} from '@/utils/supabase/security';

/**
 * Example API route demonstrating enhanced security features
 * This shows how to ensure users can only access their own data
 */

export async function GET(request: Request) {
  try {
    // Method 1: Using the security context
    const context = await getSecurityContext();
    if (!context) {
      return NextResponse.json(
        createSecureResponse(null, new Error('Authentication required'), 401)
      );
    }

    console.log(`🔒 Secure request from user: ${context.userId}`);
    console.log(`📊 User has ${context.userItemIds.length} connected items`);

    // Method 2: Using the secure query builder
    const secureQuery = await createSecureQuery();
    
    // This automatically filters by user's item IDs
    const { data: transactions, error: txError } = await secureQuery
      .filterTransactionsByUser()
      .order('date', { ascending: false })
      .limit(50);

    if (txError) {
      return NextResponse.json(
        createSecureResponse(null, txError, 500)
      );
    }

    // Method 3: Using secure views (alternative approach)
    const { data: secureTransactions, error: viewError } = await secureQuery
      .useSecureTransactionsView()
      .order('date', { ascending: false })
      .limit(50);

    if (viewError) {
      console.error('Secure view error:', viewError);
    }

    // Method 4: Using the secure function directly
    const functionTransactions = await getUserTransactions();

    return NextResponse.json(
      createSecureResponse({
        transactions: transactions || [],
        secureTransactions: secureTransactions || [],
        functionTransactions: functionTransactions || [],
        userContext: {
          userId: context.userId,
          itemCount: context.userItemIds.length,
          isAuthenticated: context.isAuthenticated
        }
      })
    );

  } catch (error) {
    console.error('Secure transactions API error:', error);
    return NextResponse.json(
      createSecureResponse(null, error, 500)
    );
  }
}

export async function POST(request: Request) {
  try {
    // Method 5: Using requireAuth for simple authentication check
    const context = await requireAuth();
    
    const body = await request.json();
    const { transaction_id } = body;

    if (!transaction_id) {
      return NextResponse.json(
        createSecureResponse(null, new Error('transaction_id is required'), 400)
      );
    }

    // Method 6: Validating access to specific resources
    const { validateTransactionAccess } = await import('@/utils/supabase/security');
    const hasAccess = await validateTransactionAccess(transaction_id);

    if (!hasAccess) {
      return NextResponse.json(
        createSecureResponse(null, new Error('Access denied to this transaction'), 403)
      );
    }

    // Proceed with the operation since access is validated
    const secureQuery = await createSecureQuery();
    
    const { data, error } = await secureQuery.supabase
      .from('transactions')
      .select('*')
      .eq('id', transaction_id)
      .single();

    if (error) {
      return NextResponse.json(
        createSecureResponse(null, error, 500)
      );
    }

    return NextResponse.json(
      createSecureResponse({
        transaction: data,
        message: 'Transaction accessed securely'
      })
    );

  } catch (error) {
    console.error('Secure transaction POST error:', error);
    return NextResponse.json(
      createSecureResponse(null, error, 500)
    );
  }
}
