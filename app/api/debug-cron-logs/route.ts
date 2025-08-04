import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    console.log('📊 Fetching cron logs for SMS duplication investigation...');
    
    // Get recent cron logs, especially from today
    const { data: logs, error } = await supabase
      .from('cron_log')
      .select('*')
      .eq('job_name', 'scheduled-sms')
      .gte('started_at', '2025-08-04T00:00:00-04:00') // Today in EDT
      .order('started_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('❌ Error fetching cron logs:', error);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch cron logs',
        details: error
      }, { status: 500 });
    }

    console.log(`📊 Found ${logs?.length || 0} cron logs for today`);

    return NextResponse.json({ 
      success: true,
      date: '2025-08-04',
      totalLogs: logs?.length || 0,
      logs: logs || []
    });

  } catch (err) {
    console.error('💥 Unexpected error:', err);
    return NextResponse.json({ 
      success: false, 
      error: 'Unexpected error',
      details: err 
    }, { status: 500 });
  }
}