import { NextResponse } from 'next/server';
import { createServerComponentClient } from '@/lib/db/supabase-server';
import { createClient } from '@supabase/supabase-js';
import { generateRecommendations } from '@/lib/ai/gemini';

export async function POST(request: Request) {
  // Store analysisId early for error handling (body can only be read once)
  let storedAnalysisId: string | null = null;
  
  try {
    // Check if this is an internal server call (from /api/analyze/clean)
    const isInternalCall = request.headers.get('X-Internal-Call') === 'true';
    
    let user;
    if (!isInternalCall) {
      // Normal call from client - check auth
      const supabase = await createServerComponentClient();
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
      }
      user = authUser;
    }

    const body = await request.json();
    const { analysisId } = body;

    // Store for error handling
    storedAnalysisId = analysisId;

    if (!analysisId) {
      return NextResponse.json({ error: 'ID d\'analyse requis' }, { status: 400 });
    }

    // Use service role client
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Get analysis
    const { data: analysis, error: analysisError } = await supabaseAdmin
      .from('analyses')
      .select('*')
      .eq('id', analysisId)
      .single();

    if (analysisError || !analysis) {
      return NextResponse.json({ error: 'Analyse non trouvée' }, { status: 404 });
    }

    // Get stock entries for this analysis
    const { data: stockEntries, error: entriesError } = await supabaseAdmin
      .from('stock_entries')
      .select('*')
      .eq('analysis_id', analysisId)
      .limit(1000); // Limit for Gemini context

    if (entriesError || !stockEntries || stockEntries.length === 0) {
      return NextResponse.json(
        { error: 'Aucune donnée de stock trouvée' },
        { status: 400 }
      );
    }

    // Call Gemini for recommendations
    const recommendationsResult = await generateRecommendations({
      stockEntries: stockEntries.map((entry) => ({
        sku: entry.sku,
        product_name: entry.product_name,
        quantity: entry.quantity,
        unit_cost: entry.unit_cost,
        total_value: entry.total_value,
        location: entry.location,
        category: entry.category,
        supplier: entry.supplier,
        last_movement_date: entry.last_movement_date,
        days_since_last_movement: entry.days_since_last_movement,
      })),
      analysisMetadata: {
        tenant_id: analysis.tenant_id,
        analysis_name: analysis.name,
        total_entries: stockEntries.length,
      },
      tenantId: analysis.tenant_id,
      useDbPrompt: true,
    });

    // Insert recommendations into database
    const recommendations = recommendationsResult.recommendations.map((rec) => ({
      tenant_id: analysis.tenant_id,
      analysis_id: analysisId,
      type: rec.type,
      priority: rec.priority,
      title: rec.title,
      description: rec.description,
      action_items: rec.actionItems,
      affected_skus: rec.affectedSkus,
      estimated_impact: rec.estimatedImpact,
      python_code: rec.pythonCode,
      status: 'pending',
    }));

    if (recommendations.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('recommendations')
        .insert(recommendations);

      if (insertError) {
        throw new Error(`Erreur lors de l'insertion des recommandations: ${insertError.message}`);
      }
    }

    // Update analysis status to completed
    await supabaseAdmin
      .from('analyses')
      .update({ status: 'completed' })
      .eq('id', analysisId);

    return NextResponse.json({
      success: true,
      recommendationsCount: recommendations.length,
    });
  } catch (error) {
    console.error('Recommendations error:', error);
    
    // Update analysis status to failed
    try {
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      );
      
      // Use stored analysisId (body already read)
      if (storedAnalysisId) {
        await supabaseAdmin
          .from('analyses')
          .update({ status: 'failed' })
          .eq('id', storedAnalysisId);
      }
    } catch (updateError) {
      console.error('Failed to update analysis status:', updateError);
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Une erreur est survenue' },
      { status: 500 }
    );
  }
}
