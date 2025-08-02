import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create admin Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Get analytics on sample SMS lead conversions
 */
export async function GET() {
  try {
    // Get total leads
    const { data: totalLeads, error: totalError } = await supabase
      .from('sample_sms_leads')
      .select('id, created_at, converted_to_signup, conversion_date, user_id')
      .order('created_at', { ascending: false });

    if (totalError) {
      console.error('Error fetching leads:', totalError);
      return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
    }

    // Calculate analytics
    const total = totalLeads.length;
    const converted = totalLeads.filter(lead => lead.converted_to_signup).length;
    const conversionRate = total > 0 ? ((converted / total) * 100).toFixed(1) : '0';

    // Calculate average time to conversion
    const convertedLeads = totalLeads.filter(lead => lead.converted_to_signup && lead.conversion_date);
    let averageDaysToConversion = 0;
    
    if (convertedLeads.length > 0) {
      const totalDays = convertedLeads.reduce((sum, lead) => {
        const days = Math.floor((new Date(lead.conversion_date).getTime() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60 * 24));
        return sum + days;
      }, 0);
      averageDaysToConversion = Math.round(totalDays / convertedLeads.length);
    }

    // Recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentLeads = totalLeads.filter(lead => new Date(lead.created_at) > sevenDaysAgo);
    const recentConversions = totalLeads.filter(lead => 
      lead.converted_to_signup && 
      lead.conversion_date && 
      new Date(lead.conversion_date) > sevenDaysAgo
    );

    return NextResponse.json({
      success: true,
      analytics: {
        total_leads: total,
        converted_leads: converted,
        conversion_rate: `${conversionRate}%`,
        average_days_to_conversion: averageDaysToConversion,
        recent_activity: {
          new_leads_7d: recentLeads.length,
          conversions_7d: recentConversions.length
        }
      },
      recent_leads: totalLeads.slice(0, 10).map(lead => ({
        id: lead.id,
        created_at: lead.created_at,
        converted: lead.converted_to_signup,
        conversion_date: lead.conversion_date,
        days_to_conversion: lead.converted_to_signup && lead.conversion_date 
          ? Math.floor((new Date(lead.conversion_date).getTime() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60 * 24))
          : null
      }))
    });

  } catch (error) {
    console.error('Error in sample-lead-analytics:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}