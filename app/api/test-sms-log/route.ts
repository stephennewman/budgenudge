import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(_request: NextRequest) {
  try {
    console.log('📊 Fetching SMS test logs...');
    
    // Get recent test SMS logs
    const { data: logs, error } = await supabase
      .from('sms_test_log')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(20);

    if (error) {
      console.error('❌ Error fetching SMS test logs:', error);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch logs',
        details: error
      }, { status: 500 });
    }

    // Calculate statistics
    const totalTests = logs?.length || 0;
    const successfulTests = logs?.filter(log => log.success).length || 0;
    const failedTests = totalTests - successfulTests;
    const averageDuration = logs?.length ? 
      logs.reduce((sum, log) => sum + (log.duration_ms || 0), 0) / logs.length : 0;
    
    const mostRecentTest = logs?.[0];
    const oldestTest = logs?.[logs.length - 1];

    console.log(`📊 SMS Test Stats: ${successfulTests}/${totalTests} successful, avg ${averageDuration.toFixed(0)}ms`);

    return NextResponse.json({ 
      success: true,
      stats: {
        totalTests,
        successfulTests,
        failedTests,
        successRate: totalTests > 0 ? (successfulTests / totalTests * 100).toFixed(1) : '0',
        averageDurationMs: Math.round(averageDuration),
        mostRecentTest: mostRecentTest?.timestamp,
        oldestTest: oldestTest?.timestamp
      },
      logs: logs?.map(log => ({
        timestamp: log.timestamp,
        success: log.success,
        messageLength: log.message_length,
        durationMs: log.duration_ms,
        error: log.error,
        preview: log.message_preview,
        phoneNumber: log.phone_number
      })),
      nextCronRuns: getNextCronRuns()
    });

  } catch (error) {
    console.error('🚨 SMS test log error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

function getNextCronRuns(): string[] {
  const now = new Date();
  const runs: string[] = [];
  
  // Calculate next 5 cron runs (every 30 minutes)
  for (let i = 1; i <= 5; i++) {
    const nextRun = new Date(now);
    const currentMinutes = now.getMinutes();
    const nextHalfHour = currentMinutes < 30 ? 30 : 60;
    
    if (nextHalfHour === 60) {
      nextRun.setHours(nextRun.getHours() + 1);
      nextRun.setMinutes(0);
    } else {
      nextRun.setMinutes(30);
    }
    
    // Add additional 30-minute intervals
    nextRun.setMinutes(nextRun.getMinutes() + (i - 1) * 30);
    
    runs.push(nextRun.toLocaleTimeString('en-US', { 
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true 
    }) + ' EST');
  }
  
  return runs;
} 