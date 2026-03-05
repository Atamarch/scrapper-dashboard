import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { templateId } = await request.json();

    if (!templateId) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      );
    }

    // Use service role key for server-side operations
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch leads for this template
    const { data: leads, error } = await supabase
      .from('leads_list')
      .select('id, profile_data, scoring_data, score')
      .eq('template_id', templateId);

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch leads' },
        { status: 500 }
      );
    }

    const total = leads?.length || 0;
    let complete = 0;
    let needProcessing = 0;

    leads?.forEach(lead => {
      const hasProfile = lead.profile_data && 
        lead.profile_data !== null && 
        typeof lead.profile_data === 'object' &&
        Object.keys(lead.profile_data).length > 0;
      
      const hasScoring = lead.scoring_data && 
        lead.scoring_data !== null && 
        typeof lead.scoring_data === 'object' &&
        Object.keys(lead.scoring_data).length > 0;
      
      const hasValidScore = lead.score && lead.score > 0;

      if (hasProfile && hasScoring && hasValidScore) {
        complete++;
      } else {
        needProcessing++;
      }
    });

    const completionRate = total > 0 ? (complete / total) * 100 : 0;

    return NextResponse.json({
      total,
      complete,
      needProcessing,
      completionRate
    });

  } catch (error) {
    console.error('Error analyzing leads:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}