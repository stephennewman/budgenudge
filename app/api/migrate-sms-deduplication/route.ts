import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST() {
  try {
    console.log('🗄️ Applying SMS deduplication migration...');
    
    const migrations = [
      {
        name: 'Create SMS send log table',
        sql: `
CREATE TABLE IF NOT EXISTS public.sms_send_log (
    id BIGSERIAL PRIMARY KEY,
    phone_number TEXT NOT NULL,
    template_type TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    source_endpoint TEXT NOT NULL,
    message_id TEXT,
    success BOOLEAN NOT NULL DEFAULT true
);`
      },
      {
        name: 'Add unique constraint for deduplication',
        sql: `
ALTER TABLE public.sms_send_log 
ADD CONSTRAINT IF NOT EXISTS sms_send_log_unique_daily 
UNIQUE(phone_number, template_type, DATE(sent_at AT TIME ZONE 'America/New_York'));`
      },
      {
        name: 'Create performance indexes',
        sql: `
CREATE INDEX IF NOT EXISTS idx_sms_send_log_phone_template_date 
ON public.sms_send_log (phone_number, template_type, DATE(sent_at AT TIME ZONE 'America/New_York'));

CREATE INDEX IF NOT EXISTS idx_sms_send_log_user_date 
ON public.sms_send_log (user_id, DATE(sent_at AT TIME ZONE 'America/New_York'));

CREATE INDEX IF NOT EXISTS idx_sms_send_log_sent_at 
ON public.sms_send_log (sent_at);`
      },
      {
        name: 'Enable RLS',
        sql: `ALTER TABLE public.sms_send_log ENABLE ROW LEVEL SECURITY;`
      },
      {
        name: 'Create RLS policies',
        sql: `
DROP POLICY IF EXISTS "Users can view their own SMS log" ON public.sms_send_log;
DROP POLICY IF EXISTS "Service role can manage SMS log" ON public.sms_send_log;

CREATE POLICY "Users can view their own SMS log" ON public.sms_send_log
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage SMS log" ON public.sms_send_log
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');`
      },
      {
        name: 'Create deduplication function',
        sql: `
CREATE OR REPLACE FUNCTION public.can_send_sms(
    p_phone_number TEXT,
    p_template_type TEXT,
    p_check_date DATE DEFAULT CURRENT_DATE
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN NOT EXISTS (
        SELECT 1 FROM public.sms_send_log 
        WHERE phone_number = p_phone_number 
        AND template_type = p_template_type 
        AND DATE(sent_at AT TIME ZONE 'America/New_York') = p_check_date
        AND success = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;`
      },
      {
        name: 'Create logging function',
        sql: `
CREATE OR REPLACE FUNCTION public.log_sms_send(
    p_phone_number TEXT,
    p_template_type TEXT,
    p_user_id UUID,
    p_source_endpoint TEXT,
    p_message_id TEXT DEFAULT NULL,
    p_success BOOLEAN DEFAULT true
) RETURNS BIGINT AS $$
DECLARE
    log_id BIGINT;
BEGIN
    INSERT INTO public.sms_send_log (
        phone_number,
        template_type, 
        user_id,
        source_endpoint,
        message_id,
        success
    ) VALUES (
        p_phone_number,
        p_template_type,
        p_user_id, 
        p_source_endpoint,
        p_message_id,
        p_success
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;`
      },
      {
        name: 'Grant permissions',
        sql: `
GRANT SELECT, INSERT ON public.sms_send_log TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_send_sms TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_sms_send TO authenticated;`
      }
    ];

    let successCount = 0;
    let errorCount = 0;
    const results = [];

    for (const migration of migrations) {
      try {
        console.log(`📝 ${migration.name}...`);
        
        // Try using the Supabase client directly
        const { error } = await supabase.rpc('exec_sql', { 
          sql: migration.sql 
        });
        
        if (error) {
          console.log(`⚠️  ${migration.name} - ${error.message}`);
          errorCount++;
          results.push({ 
            name: migration.name, 
            success: false, 
            error: error.message 
          });
        } else {
          console.log(`✅ ${migration.name} - completed`);
          successCount++;
          results.push({ 
            name: migration.name, 
            success: true 
          });
        }
      } catch (error) {
        console.error(`❌ ${migration.name} - failed:`, error);
        errorCount++;
        results.push({ 
          name: migration.name, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    console.log(`📊 Migration Summary: ${successCount}/${migrations.length} completed`);

    // Test if we can use the new functions
    try {
      const { data: testFunction, error: testError } = await supabase.rpc('can_send_sms', {
        p_phone_number: '+16173472721',
        p_template_type: 'test',
        p_check_date: new Date().toISOString().split('T')[0]
      });
      
      if (testError) {
        console.log('⚠️  Functions may need manual verification');
        results.push({ 
          name: 'Function test', 
          success: false, 
          error: testError.message 
        });
      } else {
        console.log('✅ Deduplication functions are working!');
        results.push({ 
          name: 'Function test', 
          success: true, 
          result: testFunction 
        });
      }
    } catch (testError) {
      console.log('⚠️  Function testing failed');
      results.push({ 
        name: 'Function test', 
        success: false, 
        error: 'Testing failed'
      });
    }

    return NextResponse.json({
      success: errorCount === 0,
      message: `SMS deduplication migration: ${successCount}/${migrations.length} completed`,
      successCount,
      errorCount,
      results,
      next_steps: errorCount > 0 ? [
        'Some migrations failed. You may need to run the SQL manually in Supabase dashboard.',
        'Check the results above for specific errors.'
      ] : [
        'Migration completed successfully!',
        'SMS deduplication system is now active.',
        'Test with /api/test-sms to verify it blocks duplicates.'
      ]
    });
    
  } catch (error) {
    console.error('❌ Migration error:', error);
    return NextResponse.json({
      success: false,
      error: 'Migration failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}