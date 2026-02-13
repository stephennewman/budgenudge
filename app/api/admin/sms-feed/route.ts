import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/server';
import { isSuperAdmin } from '@/utils/auth/superadmin';

interface SMSFeedEntry {
  id: number;
  timestamp: string;
  template_type: string;
  user_id_short: string;
  phone_short: string;
  success: boolean;
  message_id: string | null;
  source_endpoint: string;
}

export async function GET() {
  try {
    const supabase = await createSupabaseClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check superadmin access
    if (!isSuperAdmin(user.id)) {
      return NextResponse.json({ error: 'Forbidden: Superadmin access required' }, { status: 403 });
    }

    // Query recent SMS sends from sms_send_log (ALL USERS - not filtered by user_id)
    const { data: smsLogs, error: fetchError } = await supabase
      .from('sms_send_log')
      .select('id, phone_number, template_type, user_id, sent_at, source_endpoint, message_id, success')
      .order('sent_at', { ascending: false })
      .limit(100); // Last 100 SMS sends across ALL users

    // Debug: Check for Ashley's phone in multiple formats (SlickText vs E.164)
    const ashleyPhoneFormats = ['+15084934141', '15084934141', '5084934141', '508-493-4141', '(508) 493-4141'];
    let debugLogs: { id: number; phone_number: string; template_type: string; sent_at: string; success: boolean }[] = [];
    
    for (const phoneFormat of ashleyPhoneFormats) {
      const { data: formatLogs } = await supabase
        .from('sms_send_log')
        .select('id, phone_number, template_type, sent_at, success')
        .eq('phone_number', phoneFormat)
        .order('sent_at', { ascending: false })
        .limit(5);
      
      if (formatLogs && formatLogs.length > 0) {
        debugLogs.push(...formatLogs);
      }
    }

    // Also search for any phone containing "5084934141" digits
    const { data: wildcardLogs } = await supabase
      .from('sms_send_log')
      .select('id, phone_number, template_type, sent_at, success')
      .like('phone_number', '%5084934141%')
      .order('sent_at', { ascending: false })
      .limit(5);

    if (wildcardLogs && wildcardLogs.length > 0) {
      debugLogs.push(...wildcardLogs);
    }

    // Remove duplicates and sort by most recent
    debugLogs = debugLogs
      .filter((log, index, self) => index === self.findIndex(l => l.id === log.id))
      .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())
      .slice(0, 10);

    // Debug: Get total count
    const { count: totalCount } = await supabase
      .from('sms_send_log')
      .select('*', { count: 'exact', head: true });

    if (debugLogs && debugLogs.length > 0) {
    }

    if (fetchError) {
      console.error('❌ Error fetching SMS logs:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch SMS logs' }, { status: 500 });
    }

    // Transform data for feed display (sanitize sensitive info)
    const feedEntries: SMSFeedEntry[] = (smsLogs || []).map(log => ({
      id: log.id,
      timestamp: log.sent_at,
      template_type: log.template_type,
      user_id_short: log.user_id ? log.user_id.slice(-8) : 'unknown',
      phone_short: log.phone_number ? `***${log.phone_number.slice(-4)}` : 'unknown',
      success: log.success,
      message_id: log.message_id,
      source_endpoint: log.source_endpoint
    }));

    // Calculate basic stats
    const total = feedEntries.length;
    const successful = feedEntries.filter(entry => entry.success).length;
    const failed = total - successful;
    const successRate = total > 0 ? Math.round((successful / total) * 100) : 0;

    // Get today's sends
    const today = new Date().toISOString().split('T')[0];
    const todayEntries = feedEntries.filter(entry => 
      entry.timestamp.startsWith(today)
    );

    return NextResponse.json({
      success: true,
      data: {
        entries: feedEntries,
        stats: {
          total,
          successful,
          failed,
          successRate,
          todayCount: todayEntries.length,
          lastUpdate: new Date().toISOString()
        },
        debug: {
          totalSMSInDatabase: totalCount || 0,
          debugPhoneNumber: 'Ashley: 508-493-4141',
          debugPhoneLogCount: debugLogs?.length || 0,
          debugPhoneMostRecent: debugLogs?.[0]?.sent_at || 'No logs found',
          debugPhoneActualFormat: debugLogs?.[0]?.phone_number || 'N/A',
          ashleyFormatsSearched: ashleyPhoneFormats,
          showingLast100Only: true
        }
      }
    });

  } catch (error) {
    console.error('❌ SMS Feed API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
