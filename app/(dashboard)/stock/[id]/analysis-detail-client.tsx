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
      if (analysisStatus === 'processing' || analysisStatus === 'completed') return 'completed';
      return 'pending';
    }
    
    if (stepId === 'cleaning') {
      if (analysisStatus === 'processing' && !hasStockEntries) return 'in_progress';
      if (hasStockEntries) return 'completed';
      if (analysisStatus === 'mapping_pending' || analysisStatus === 'mapping_in_progress') return 'pending';
      return 'pending';
    }
    
    if (stepId === 'analysis') {
      if (hasRecommendations) return 'completed';
      if (hasStockEntries && !hasRecommendations && analysisStatus === 'processing') return 'in_progress';
      if (analysisStatus === 'completed') return 'completed';
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
      path: `/stock/${analysisId}`,
      status: getStepStatus('cleaning'),
    },
    {
      id: 'analysis',
      label: 'Analysis',
      path: `/stock/${analysisId}`,
      status: getStepStatus('analysis'),
    },
  ];

  // Determine current step
  const getCurrentStep = () => {
    if (analysisStatus === 'mapping_in_progress' || analysisStatus === 'mapping_pending') return 'mapping';
    if (analysisStatus === 'processing' && !hasStockEntries) return 'cleaning';
    if (hasStockEntries && !hasRecommendations) return 'analysis';
    if (hasRecommendations) return 'analysis';
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
