import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface IncomePattern {
  source_name: string;
  pattern: string;
  frequency: 'weekly' | 'bi-weekly' | 'bi-monthly' | 'monthly' | 'irregular';
  expected_amount: number;
  confidence_score: number;
  intervals: number[];
  dates: string[];
  amounts: number[];
  account_id: string;
}

export async function POST(request: NextRequest) {
  try {
    const { user_id, patterns, replace_existing = false } = await request.json();
    
    if (!user_id || !patterns || !Array.isArray(patterns)) {
      return NextResponse.json({ 
        success: false, 
        error: 'user_id and patterns array are required' 
      }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // If replace_existing is true, deactivate all existing patterns for this user
    if (replace_existing) {
      await supabase
        .from('tagged_income_sources')
        .update({ is_active: false })
        .eq('user_id', user_id);
    }
    
    const savedPatterns = [];
    
    for (const pattern of patterns) {
      // Calculate next predicted date based on frequency and last income date
      const nextPredictedDate = calculateNextIncomeDate(pattern);
      
      // Prepare pattern analysis metadata
      const patternAnalysis = {
        intervals: pattern.intervals,
        dates: pattern.dates,
        amounts: pattern.amounts,
        avg_interval: pattern.intervals.reduce((sum: number, int: number) => sum + int, 0) / pattern.intervals.length,
        amount_variance: calculateVariance(pattern.amounts),
        detection_method: 'automatic',
        last_analysis_date: new Date().toISOString()
      };
      
      // Check if this pattern already exists for the user
      const { data: existingPattern } = await supabase
        .from('tagged_income_sources')
        .select('id')
        .eq('user_id', user_id)
        .eq('income_source_name', pattern.source_name)
        .single();
      
      if (existingPattern) {
        // Update existing pattern
        const { data: updatedPattern, error: updateError } = await supabase
          .from('tagged_income_sources')
          .update({
            expected_amount: pattern.expected_amount,
            frequency: pattern.frequency,
            confidence_score: pattern.confidence_score,
            next_predicted_date: nextPredictedDate,
            pattern_analysis: patternAnalysis,
            account_identifier: pattern.account_id,
            is_active: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingPattern.id)
          .select()
          .single();
        
        if (updateError) {
          console.error(`❌ Error updating pattern ${pattern.source_name}:`, updateError);
          continue;
        }
        
        savedPatterns.push(updatedPattern);
      } else {
        // Create new pattern
        const { data: newPattern, error: insertError } = await supabase
          .from('tagged_income_sources')
          .insert({
            user_id,
            income_source_name: pattern.source_name,
            income_pattern: pattern.pattern,
            expected_amount: pattern.expected_amount,
            frequency: pattern.frequency,
            confidence_score: pattern.confidence_score,
            last_income_date: pattern.dates[pattern.dates.length - 1], // Most recent date
            next_predicted_date: nextPredictedDate,
            pattern_analysis: patternAnalysis,
            account_identifier: pattern.account_id,
            auto_detected: true,
            is_active: true,
            type: determineIncomeType(pattern.source_name)
          })
          .select()
          .single();
        
        if (insertError) {
          console.error(`❌ Error inserting pattern ${pattern.source_name}:`, insertError);
          continue;
        }
        
        savedPatterns.push(newPattern);
      }
    }
    
    return NextResponse.json({
      success: true,
      patterns_saved: savedPatterns.length,
      patterns: savedPatterns
    });
    
  } catch (error) {
    console.error('❌ Error saving income patterns:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

function calculateNextIncomeDate(pattern: IncomePattern): string {
  const lastDate = new Date(pattern.dates[pattern.dates.length - 1]);
  let daysToAdd = 30; // Default fallback
  
  switch (pattern.frequency) {
    case 'weekly':
      daysToAdd = 7;
      break;
    case 'bi-weekly':
      daysToAdd = 14;
      break;
    case 'bi-monthly':
      daysToAdd = 15;
      break;
    case 'monthly':
      daysToAdd = 30;
      break;
    case 'irregular':
      // Use average interval from historical data
      daysToAdd = Math.round(pattern.intervals.reduce((sum, int) => sum + int, 0) / pattern.intervals.length);
      break;
  }
  
  const nextDate = new Date(lastDate);
  nextDate.setDate(lastDate.getDate() + daysToAdd);
  
  return nextDate.toISOString().split('T')[0];
}

function calculateVariance(numbers: number[]): number {
  const mean = numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
  const squaredDiffs = numbers.map(num => Math.pow(num - mean, 2));
  return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / numbers.length;
}

function determineIncomeType(sourceName: string): string {
  const name = sourceName.toLowerCase();
  
  if (name.includes('salary') || name.includes('payroll') || name.includes('wage')) {
    return 'salary';
  } else if (name.includes('freelance') || name.includes('contractor') || name.includes('1099')) {
    return 'freelance';
  } else if (name.includes('social security') || name.includes('unemployment') || name.includes('benefit')) {
    return 'benefits';
  } else if (name.includes('dividend') || name.includes('interest') || name.includes('investment')) {
    return 'investment';
  } else {
    return 'other';
  }
} 