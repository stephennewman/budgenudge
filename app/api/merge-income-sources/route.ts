import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Merge request body:', body);
    
    const { mergedSource, removedSourceIds } = body;
    
    if (!mergedSource || !removedSourceIds) {
      console.error('Missing required data:', { mergedSource: !!mergedSource, removedSourceIds: !!removedSourceIds });
      return NextResponse.json({ error: 'Missing merged source or removed source IDs' }, { status: 400 });
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

    // Get existing income profile using service role client (for proper permissions)
    const { data: existingProfile, error: profileError } = await serviceSupabase
      .from('user_income_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Error fetching income profile:', profileError);
      return NextResponse.json({ error: 'Failed to fetch income profile', details: profileError.message }, { status: 500 });
    }
    
    console.log('Existing profile:', existingProfile ? 'found' : 'not found');

    let updatedProfileData;
    
    if (existingProfile?.profile_data?.income_sources) {
      // Update existing profile
      const currentSources = existingProfile.profile_data.income_sources;
      
      // Remove the sources that were merged
      const filteredSources = currentSources.filter((source: { id?: string }) => {
        const sourceId = source.id || `source_${currentSources.indexOf(source)}`;
        return !removedSourceIds.includes(sourceId);
      });
      
      // Add the merged source
      filteredSources.push(mergedSource);
      
      updatedProfileData = {
        ...existingProfile.profile_data,
        income_sources: filteredSources,
        last_updated: new Date().toISOString()
      };
    } else {
      // Create new profile with just the merged source
      updatedProfileData = {
        income_sources: [mergedSource],
        analysis_date: new Date().toISOString(),
        last_updated: new Date().toISOString()
      };
    }

    console.log('Updated profile data:', JSON.stringify(updatedProfileData, null, 2));

    // Save to database
    if (existingProfile) {
      // Update existing profile
      console.log('Updating existing profile...');
      const { error: updateError } = await serviceSupabase
        .from('user_income_profiles')
        .update({
          profile_data: updatedProfileData,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (updateError) {
        console.error('Error updating income profile:', updateError);
        return NextResponse.json({ error: 'Failed to update income profile', details: updateError.message }, { status: 500 });
      }
      console.log('Profile updated successfully');
    } else {
      // Create new profile
      console.log('Creating new profile...');
      const { error: insertError } = await serviceSupabase
        .from('user_income_profiles')
        .insert({
          user_id: user.id,
          profile_data: updatedProfileData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (insertError) {
        console.error('Error creating income profile:', insertError);
        return NextResponse.json({ error: 'Failed to create income profile', details: insertError.message }, { status: 500 });
      }
      console.log('Profile created successfully');
    }

    return NextResponse.json({
      success: true,
      message: 'Income sources merged successfully',
      updatedProfile: updatedProfileData
    });

  } catch (error) {
    console.error('Error in merge-income-sources:', error);
    return NextResponse.json({ 
      error: 'Failed to merge income sources',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
