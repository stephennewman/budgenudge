import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create admin Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Simple analytics: Show phone-to-email conversions
 */
export async function GET() {
  try {
    // Get sample SMS leads with their conversion status
    const { data: leads, error: leadsError } = await supabase
      .from('sample_sms_leads')
      .select(`
        id,
        phone_number,
        created_at,
        converted_to_signup,
        conversion_date,
        user_id
      `)
      .order('created_at', { ascending: false });

    if (leadsError) {
      console.error('Error fetching leads:', leadsError);
      return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
    }

    // Get user emails for converted leads
    const convertedLeadUserIds = leads
      .filter(lead => lead.converted_to_signup && lead.user_id)
      .map(lead => lead.user_id);

    const userEmails: { [key: string]: string } = {};
    
    if (convertedLeadUserIds.length > 0) {
      // Get user emails from auth.users
      const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
      
      if (!usersError && users) {
        users.users.forEach(user => {
          if (convertedLeadUserIds.includes(user.id)) {
            userEmails[user.id] = user.email || '';
          }
        });
      }
    }

    // Build simple conversion data
    const conversions = leads.map(lead => ({
      phone_number: lead.phone_number,
      sample_sms_date: lead.created_at,
      converted: lead.converted_to_signup,
      conversion_date: lead.conversion_date,
      user_email: lead.user_id ? userEmails[lead.user_id] : null,
      days_to_conversion: lead.converted_to_signup && lead.conversion_date 
        ? Math.floor((new Date(lead.conversion_date).getTime() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60 * 24))
        : null
    }));

    // Simple stats
    const total = leads.length;
    const converted = leads.filter(lead => lead.converted_to_signup).length;
    const conversionRate = total > 0 ? ((converted / total) * 100).toFixed(1) : '0';

    return NextResponse.json({
      success: true,
      stats: {
        total_sample_sms: total,
        converted_to_signup: converted,
        conversion_rate: `${conversionRate}%`
      },
      conversions: conversions.slice(0, 20) // Show recent 20
    });

  } catch (error) {
    console.error('Error in sample-lead-analytics:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}