import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const testResults = {
      database: { status: 'unknown', message: '' },
      tables: { status: 'unknown', message: '' },
      openai: { status: 'unknown', message: '' }
    };

    // Test 1: Database connection
    try {
      const { error } = await supabase.from('users').select('id').limit(1);
      if (error) throw error;
      testResults.database = { status: 'success', message: 'Database connection working' };
    } catch (error) {
      testResults.database = { status: 'error', message: `Database error: ${error}` };
    }

    // Test 2: New tables exist
    try {
      await supabase.from('user_income_profiles').select('id').limit(1);
      await supabase.from('ai_conversations').select('id').limit(1);
      const { data: templates } = await supabase.from('income_schedule_templates').select('name').limit(1);
      
      testResults.tables = { 
        status: 'success', 
        message: `Tables created: user_income_profiles, ai_conversations, income_schedule_templates (${templates?.length || 0} templates loaded)` 
      };
    } catch (error) {
      testResults.tables = { status: 'error', message: `Table error: ${error}` };
    }

    // Test 3: OpenAI environment variable
    try {
      if (process.env.OPENAI_API_KEY) {
        testResults.openai = { status: 'success', message: 'OpenAI API key configured' };
      } else {
        testResults.openai = { status: 'warning', message: 'OpenAI API key not found in environment' };
      }
    } catch (error) {
      testResults.openai = { status: 'error', message: `OpenAI error: ${error}` };
    }

    const overallStatus = Object.values(testResults).every(test => test.status === 'success') ? 'success' : 'partial';

    return NextResponse.json({
      success: true,
      status: overallStatus,
      message: overallStatus === 'success' 
        ? '✅ Conversational AI system ready!' 
        : '⚠️ Some components may need attention',
      tests: testResults,
      next_steps: overallStatus === 'success' 
        ? ['Visit /protected/income-setup to test the AI chat', 'Configure OpenAI API key if needed']
        : ['Check failed tests above', 'Ensure database migration ran successfully']
    });

  } catch (error) {
    console.error('Test error:', error);
    return NextResponse.json(
      { error: 'Failed to run system tests' },
      { status: 500 }
    );
  }
} 