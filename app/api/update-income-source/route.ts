import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Update income source request:', body);

    const { sourceId, updatedSource } = body;

    if (!sourceId || !updatedSource) {
      return NextResponse.json({ 
        error: 'Missing sourceId or updatedSource data' 
      }, { status: 400 });
    }

    // Get authorization token from header
    const authorization = request.headers.get('Authorization');
    if (!authorization) {
      return NextResponse.json({ error: 'No authorization header' }, { status: 401 });
    }
    const token = authorization.replace('Bearer ', '');

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Get current user with token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error('Auth error:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('User authenticated:', user.id);

    // Create service role client for database operations
    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get existing income profile
    const { data: existingProfile, error: profileError } = await serviceSupabase
      .from('user_income_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching income profile:', profileError);
      return NextResponse.json({ 
        error: 'Failed to fetch income profile', 
        details: profileError.message 
      }, { status: 500 });
    }

    if (!existingProfile?.profile_data?.income_sources) {
      return NextResponse.json({ 
        error: 'No income profile found' 
      }, { status: 404 });
    }

    // Update the specific income source
    const currentSources = existingProfile.profile_data.income_sources;
    console.log('Current sources in database:', currentSources.map((s: { id?: string; source_name?: string; expected_amount?: number; amount?: number }, i: number) => ({
      id: s.id || `source_${i}`,
      source_name: s.source_name,
      expected_amount: s.expected_amount || s.amount
    })));
    console.log('Looking for sourceId:', sourceId);
    
    const updatedSources = currentSources.map((source: { id?: string; source_name?: string; expected_amount?: number; frequency?: string; next_predicted_date?: string }, index: number) => {
      // Use the same ID generation logic as the frontend
      const currentSourceId = source.id || `source_${source.source_name?.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      console.log(`Checking source ${index}: currentSourceId="${currentSourceId}" vs targetId="${sourceId}"`);
      console.log(`Source name: "${source.source_name}"`);
      
      if (currentSourceId === sourceId) {
        console.log('MATCH FOUND! Updating source:', source.source_name);
        // Update the source with new values
        return {
          ...source,
          source_name: updatedSource.source_name,
          expected_amount: parseFloat(updatedSource.expected_amount),
          frequency: updatedSource.frequency,
          next_predicted_date: updatedSource.next_predicted_date || null,
          // Keep existing data like dates, amounts, etc.
          last_updated: new Date().toISOString()
        };
      }
      return source;
    });

    const updatedProfileData = {
      ...existingProfile.profile_data,
      income_sources: updatedSources,
      last_updated: new Date().toISOString()
    };

    console.log('Updating income source:', sourceId, 'with data:', updatedSource);

    // Save to database
    const { error: updateError } = await serviceSupabase
      .from('user_income_profiles')
      .update({
        profile_data: updatedProfileData,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error updating income profile:', updateError);
      return NextResponse.json({ 
        error: 'Failed to update income profile', 
        details: updateError.message 
      }, { status: 500 });
    }

    console.log('Income source updated successfully');

    return NextResponse.json({
      success: true,
      message: 'Income source updated successfully',
      updatedProfile: updatedProfileData
    });

  } catch (error) {
    console.error('Error in update-income-source:', error);
    return NextResponse.json({
      error: 'Failed to update income source',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
