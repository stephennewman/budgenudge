import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/server';

/**
 * Initialize expense tracking for a user
 * 
 * This endpoint:
 * 1. Checks if user has any expense data
 * 2. If not, triggers AI lifecycle scan
 * 3. Returns initialization status
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseClient();
    
    // Get user from auth session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;
    console.log(`🚀 Checking expense initialization for user: ${userId}`);

    // Check if user already has expense data
    const { data: existingBills, error: checkError } = await supabase
      .from('tagged_merchants')
      .select('id')
      .eq('user_id', userId)
      .limit(1);

    if (checkError) {
      throw new Error(`Database check failed: ${checkError.message}`);
    }

    // If user already has bills, they're initialized
    if (existingBills && existingBills.length > 0) {
      return NextResponse.json({
        success: true,
        status: 'already_initialized',
        message: 'User already has expense tracking set up'
      });
    }

    console.log(`🔍 First-time user detected. Running AI expense analysis...`);

    // User is new - run AI lifecycle scan
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 
                    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                    'http://localhost:3001';

    const scanResponse = await fetch(`${baseUrl}/api/expenses/ai-lifecycle-scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId })
    });

    const scanResult = await scanResponse.json();

    if (!scanResult.success) {
      throw new Error(`Expense scan failed: ${scanResult.error}`);
    }

    console.log(`✅ First-time expense setup complete for user ${userId}:`, scanResult.results);

    // Check if any bills were detected
    const billsDetected = scanResult.results.newBillsDetected > 0;

    return NextResponse.json({
      success: true,
      status: 'initialized',
      message: billsDetected 
        ? `Found ${scanResult.results.newBillsDetected} recurring bills!`
        : 'Setup complete. Bills will be detected as transactions come in.',
      results: scanResult.results
    });

  } catch (error) {
    console.error('❌ Expense initialization error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

