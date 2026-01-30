import { NextResponse } from 'next/server';
import { createServerComponentClient } from '@/lib/db/supabase-server';
import { createClient } from '@supabase/supabase-js';
import { generateRecommendationsFromFacts } from '@/lib/ai/gemini';

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

    // Marquer l'analyse "en cours" (phase analyse)
    await supabaseAdmin.from('analyses').update({ status: 'analysis_in_progress' }).eq('id', analysisId);

    const meta =
      analysis.metadata && typeof analysis.metadata === 'object' && !Array.isArray(analysis.metadata)
        ? (analysis.metadata as Record<string, unknown>)
        : {};
    const analysisMeta = (meta as any).analysis || {};
    const facts = analysisMeta.facts_json;

    if (!facts) {
      return NextResponse.json(
        { error: 'Aucun facts JSON disponible. Exécutez le Python avant de générer les recommandations.' },
        { status: 400 }
      );
    }

    console.log('[Recommend] Analysis found, facts available');
    
    // Use stored prompt or default
    const promptReco = (analysisMeta.prompt_reco_override as string) || 
      'Analyser le stock et fournir des recommandations actionables pour optimiser la gestion des stocks, identifier les risques et les opportunités d\'amélioration.';
    
    console.log('[Recommend] Using prompt:', promptReco.substring(0, 100) + '...');

    // Call Gemini for recommendations FROM FACTS
    console.log('[Recommend] Calling Gemini for recommendations...');
    const recommendationsResult = await generateRecommendationsFromFacts({
      facts,
      prompt: promptReco,
      analysisMetadata: {
        tenant_id: analysis.tenant_id,
        analysis_name: analysis.name,
      },
      tenantId: analysis.tenant_id,
      useDbPrompt: true,
    });

    console.log('[Recommend] Gemini returned', recommendationsResult.recommendations.length, 'recommendations');

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
      estimated_impact: {
        ...rec.estimatedImpact,
        level: rec.level || 'micro',
        pillar: rec.pillar || 'DORMANCY',
      },
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
