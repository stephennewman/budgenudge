import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { reconcileUserBills } from '@/utils/bills/reconcile';

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const isVercelCron = request.headers.get('x-vercel-cron');
    const authHeader = request.headers.get('authorization');
    const CRON_SECRET = process.env.CRON_SECRET;
    
    if (!isVercelCron && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const startTime = Date.now();
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    // Step 1: Run AI lifecycle scan for new bill detection + dormant marking
    let scanResults = null;
    try {
      const scanResponse = await fetch(
        `${baseUrl}/api/expenses/ai-lifecycle-scan`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scanAllUsers: true })
        }
      );
      const scanResult = await scanResponse.json();
      if (scanResult.success) {
        scanResults = scanResult.results;
      } else {
        console.error('AI lifecycle scan failed:', scanResult.error);
      }
    } catch (scanError) {
      console.error('AI lifecycle scan error (continuing with reconciliation):', scanError);
    }

    // Step 2: Reconcile all users' bills against actual transactions
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: activeUsers } = await supabase
      .from('items')
      .select('user_id')
      .is('deleted_at', null);

    const userIds = [...new Set((activeUsers || []).map(item => item.user_id))];
    
    let totalReconciled = 0;
    const reconcileErrors: string[] = [];

    for (const uid of userIds) {
      try {
        const result = await reconcileUserBills(uid);
        totalReconciled += result.reconciledCount;
      } catch (err) {
        reconcileErrors.push(`${uid}: ${err instanceof Error ? err.message : 'Unknown'}`);
      }
    }

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      duration,
      scanResults,
      reconciliation: {
        usersProcessed: userIds.length,
        billsReconciled: totalReconciled,
        errors: reconcileErrors
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Expense lifecycle scan cron error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
