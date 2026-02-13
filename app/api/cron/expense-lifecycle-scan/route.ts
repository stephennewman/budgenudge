import { NextRequest, NextResponse } from 'next/server';

/**
 * Nightly Expense Lifecycle Scan Cron Job
 * 
 * Schedule: Daily at 2:00 AM EST
 * Purpose: Run AI-powered expense detection, bill matching, dormant detection
 * 
 * Vercel Cron Config (add to vercel.json):
 * {
 *   "crons": [{
 *     "path": "/api/cron/expense-lifecycle-scan",
 *     "schedule": "0 7 * * *"  // 2am EST = 7am UTC
 *   }]
 * }
 */

export async function GET(request: NextRequest) {
  try {
    // Check authorization: allow Vercel cron or correct secret
    const isVercelCron = request.headers.get('x-vercel-cron');
    const authHeader = request.headers.get('authorization');
    const CRON_SECRET = process.env.CRON_SECRET;
    
    if (!isVercelCron && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const startTime = Date.now();

    // Call the AI lifecycle scan API for all users
    const scanResponse = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('supabase.co', 'vercel.app') || 'http://localhost:3000'}/api/expenses/ai-lifecycle-scan`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scanAllUsers: true
        })
      }
    );

    const scanResult = await scanResponse.json();
    const duration = Date.now() - startTime;

    if (!scanResult.success) {
      throw new Error(`Scan failed: ${scanResult.error}`);
    }

    return NextResponse.json({
      success: true,
      duration,
      results: scanResult.results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Expense lifecycle scan cron error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

