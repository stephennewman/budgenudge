import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/server';
import { sendEnhancedSlickTextSMS } from '@/utils/sms/slicktext-client';
import { DateTime } from 'luxon';

export async function POST(request: NextRequest) {
  try {
    const { templateId, schedule, sendFirstSmsNow } = await request.json();
    
    if (!templateId || !schedule) {
      return NextResponse.json({ 
        error: 'Template ID and schedule configuration are required' 
      }, { status: 400 });
    }

    // Create Supabase client with proper server-side authentication
    const supabase = await createSupabaseClient();
    
    // Get current user (uses cookies automatically)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`📅 Saving schedule for template ${templateId} for user: ${user.id}`);

    // Calculate next send time based on schedule
    const nextSendAt = calculateNextSendTime(schedule);

    // Upsert the schedule (create or update)
    const { data, error } = await supabase
      .from('template_schedules')
      .upsert({
        template_id: templateId,
        user_id: user.id,
        cadence_type: schedule.cadence_type,
        cadence_config: schedule.cadence_config,
        send_time: schedule.send_time + ':00', // Add seconds for TIME format
        timezone: schedule.timezone,
        is_active: schedule.is_active,
        next_send_at: nextSendAt,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'template_id',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Failed to save schedule:', error);
      return NextResponse.json({ 
        error: 'Failed to save schedule' 
      }, { status: 500 });
    }

    console.log(`✅ Schedule saved successfully:`, data);
    
    // Send first SMS immediately if requested
    if (sendFirstSmsNow && schedule.is_active) {
      try {
        // Get the template content
        const { data: template, error: templateError } = await supabase
          .from('custom_sms_templates')
          .select('template_name, template_content, variables_used')
          .eq('id', templateId)
          .eq('user_id', user.id)
          .single();

        if (templateError || !template) {
          console.error('❌ Failed to fetch template for immediate send:', templateError);
        } else {
          // Get user's phone number
          const { data: settings } = await supabase
            .from('user_sms_settings')
            .select('phone_number')
            .eq('user_id', user.id)
            .single();

          if (settings?.phone_number) {
            // Replace variables in template content
            let finalMessage = template.template_content;
            
            // Process variables
            for (const variable of template.variables_used) {
              switch (variable) {
                case 'today-date':
                  const todayDate = new Date().toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long', 
                    day: 'numeric'
                  });
                  finalMessage = finalMessage.replace('${today-date}', todayDate);
                  break;
                default:
                  console.log(`⚠️ Unknown variable: ${variable}`);
              }
            }
            
            // Format message with template name
            const formattedMessage = `🧪 ${template.template_name}: \n\n${finalMessage}`;
            
            // Send the SMS
            const smsResult = await sendEnhancedSlickTextSMS({
              phoneNumber: settings.phone_number,
              message: formattedMessage,
              userId: user.id
            });
            
            if (smsResult.success) {
              console.log(`✅ First SMS sent immediately for template "${template.template_name}"`);
            } else {
              console.error(`❌ Failed to send first SMS:`, smsResult.error);
            }
          } else {
            console.log(`📭 No phone number found for user ${user.id}, skipping immediate SMS`);
          }
        }
      } catch (smsError) {
        console.error('❌ Error sending first SMS:', smsError);
        // Don't fail the whole request if SMS fails
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      message: sendFirstSmsNow && schedule.is_active ? 'Schedule saved and first SMS sent!' : 'Schedule saved successfully!',
      schedule: data
    });
    
  } catch (error) {
    console.error('❌ Save schedule API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error while saving schedule' 
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    // Create Supabase client with proper server-side authentication
    const supabase = await createSupabaseClient();
    
    // Get current user (uses cookies automatically)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`📋 Fetching schedules for user: ${user.id}`);

    // Get user's template schedules
    const { data: schedules, error } = await supabase
      .from('template_schedules')
      .select(`
        *,
        custom_sms_templates!inner(template_name)
      `)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('❌ Failed to fetch schedules:', error);
      return NextResponse.json({ 
        error: 'Failed to fetch schedules' 
      }, { status: 500 });
    }

    console.log(`✅ Found ${schedules?.length || 0} schedules`);
    
    return NextResponse.json({ 
      success: true, 
      schedules: schedules || []
    });
    
  } catch (error) {
    console.error('❌ Get schedules API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error while fetching schedules' 
    }, { status: 500 });
  }
}

interface ScheduleConfig {
  cadence_type: string;
  cadence_config: {
    day?: string;
    interval?: number;
    day_of_month?: number;
  };
  send_time: string;
  timezone: string;
  is_active: boolean;
}

// Helper function to calculate next send time
function calculateNextSendTime(schedule: ScheduleConfig): string | null {
  if (!schedule.is_active) return null;

  // Get current time in user's timezone using luxon
  const now = DateTime.now().setZone(schedule.timezone);
  const [hours, minutes] = schedule.send_time.split(':');
  
  // Create next send time for today at the specified time in user's timezone
  let nextSend = now.set({ 
    hour: parseInt(hours), 
    minute: parseInt(minutes), 
    second: 0, 
    millisecond: 0 
  });

  switch (schedule.cadence_type) {
    case 'daily':
      // If time has passed today, schedule for tomorrow
      if (nextSend <= now) {
        nextSend = nextSend.plus({ days: 1 });
      }
      break;
      
    case 'weekly':
      const targetDay = getLuxonWeekday(schedule.cadence_config.day || 'monday');
      const currentDay = nextSend.weekday;
      
      // Calculate days until target day
      let daysUntilTarget = (targetDay - currentDay + 7) % 7;
      
      // If it's the target day but time has passed, schedule for next week
      if (daysUntilTarget === 0 && nextSend <= now) {
        daysUntilTarget = 7;
      }
      
      nextSend = nextSend.plus({ days: daysUntilTarget });
      break;
      
    case 'bi-weekly':
      // Similar to weekly but add 14 days instead of 7
      const biWeeklyTargetDay = getLuxonWeekday(schedule.cadence_config.day || 'monday');
      const biWeeklyCurrentDay = nextSend.weekday;
      
      let daysUntilBiWeeklyTarget = (biWeeklyTargetDay - biWeeklyCurrentDay + 7) % 7;
      
      if (daysUntilBiWeeklyTarget === 0 && nextSend <= now) {
        daysUntilBiWeeklyTarget = 14;
      }
      
      nextSend = nextSend.plus({ days: daysUntilBiWeeklyTarget });
      break;
      
    case 'monthly':
      // Set to first day of next month (simplified)
      nextSend = nextSend.plus({ months: 1 }).set({ day: 1 });
      break;
      
    default:
      return null;
  }

  return nextSend.toISO();
}

// Helper function to convert day name to luxon weekday number (1 = Monday, 7 = Sunday)
function getLuxonWeekday(dayName: string): number {
  const days = {
    'monday': 1,
    'tuesday': 2,
    'wednesday': 3,
    'thursday': 4,
    'friday': 5,
    'saturday': 6,
    'sunday': 7
  };
  return days[dayName.toLowerCase() as keyof typeof days] || 1;
}
