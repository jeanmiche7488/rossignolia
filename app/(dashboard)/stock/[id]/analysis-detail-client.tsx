'use client';

import { AnalysisStepper } from '@/components/analysis/analysis-stepper';
import { useRouter } from 'next/navigation';

interface AnalysisDetailClientProps {
  analysisId: string;
  analysisStatus: string;
  hasStockEntries: boolean;
  hasRecommendations: boolean;
}

export function AnalysisDetailClient({
  analysisId,
  analysisStatus,
  hasStockEntries,
  hasRecommendations,
}: AnalysisDetailClientProps) {
  const router = useRouter();

  // Determine step statuses based on analysis state
  const getStepStatus = (stepId: string): 'pending' | 'in_progress' | 'completed' | 'failed' => {
    if (stepId === 'upload') {
      return 'completed'; // Upload is always completed if we're viewing the analysis
    }
    
    if (stepId === 'mapping') {
      if (analysisStatus === 'mapping_in_progress') return 'in_progress';
      if (analysisStatus === 'mapping_pending') return 'in_progress';
      if (analysisStatus !== 'mapping_in_progress' && analysisStatus !== 'mapping_pending') return 'completed';
      return 'pending';
    }
    
    if (stepId === 'cleaning') {
      if (analysisStatus === 'cleaning_in_progress') return 'in_progress';
      if (analysisStatus === 'ready_for_cleaning') return 'in_progress';
      if (analysisStatus === 'ready_for_analysis' || hasStockEntries) return 'completed';
      if (analysisStatus === 'mapping_pending' || analysisStatus === 'mapping_in_progress') return 'pending';
      return 'pending';
    }
    
    if (stepId === 'analysis') {
      if (hasRecommendations) return 'completed';
      if (analysisStatus === 'analysis_in_progress') return 'in_progress';
      if (analysisStatus === 'ready_for_analysis' || (hasStockEntries && !hasRecommendations)) return 'in_progress';
      return 'pending';
    }
    
    return 'pending';
  };

  const steps = [
    {
      id: 'upload',
      label: 'Upload',
      path: `/stock/${analysisId}`,
      status: getStepStatus('upload'),
    },
    {
      id: 'mapping',
      label: 'Mapping',
      path: `/stock/${analysisId}/mapping`,
      status: getStepStatus('mapping'),
    },
    {
      id: 'cleaning',
      label: 'Cleaning',
      path: `/stock/${analysisId}/cleaning`,
      status: getStepStatus('cleaning'),
    },
    {
      id: 'analysis',
      label: 'Analyse',
      path: `/stock/${analysisId}/analysis`,
      status: getStepStatus('analysis'),
    },
  ];

  // Determine current step
  const getCurrentStep = () => {
    if (analysisStatus === 'mapping_in_progress' || analysisStatus === 'mapping_pending') return 'mapping';
    if (analysisStatus === 'ready_for_cleaning' || analysisStatus === 'cleaning_in_progress') return 'cleaning';
    if (analysisStatus === 'ready_for_analysis' || hasStockEntries) return 'analysis';
    return 'upload';
  };

  return (
    <AnalysisStepper
      analysisId={analysisId}
      currentStep={getCurrentStep()}
      steps={steps}
      onClose={() => router.push('/stock')}
    />
  );
}
