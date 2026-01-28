'use client';

import { CheckCircle2, Circle, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

type AnalysisStep = {
  id: string;
  label: string;
  path: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
};

interface AnalysisStepperProps {
  analysisId: string;
  currentStep: string;
  steps: AnalysisStep[];
  onClose?: () => void;
}

export function AnalysisStepper({ analysisId, currentStep, steps, onClose }: AnalysisStepperProps) {
  const router = useRouter();

  const getStepIcon = (step: AnalysisStep) => {
    if (step.status === 'completed') {
      return <CheckCircle2 className="h-5 w-5 text-green-600" />;
    }
    if (step.status === 'in_progress') {
      // Show a static icon to indicate the current active step
      // without suggesting that a background process is running.
      return <Loader2 className="h-5 w-5 text-blue-600" />;
    }
    if (step.status === 'failed') {
      return <X className="h-5 w-5 text-red-600" />;
    }
    return <Circle className="h-5 w-5 text-slate-400" />;
  };

  const getStepColor = (step: AnalysisStep) => {
    if (step.status === 'completed') {
      return 'text-green-600 border-green-600';
    }
    if (step.status === 'in_progress') {
      return 'text-blue-600 border-blue-600';
    }
    if (step.status === 'failed') {
      return 'text-red-600 border-red-600';
    }
    return 'text-slate-400 border-slate-300';
  };

  const handleStepClick = (step: AnalysisStep) => {
    if (step.status === 'completed' || step.status === 'in_progress') {
      router.push(step.path);
    }
  };

  return (
    <div className="border-b bg-white sticky top-0 z-10 shadow-sm">
      <div className="container mx-auto px-8 py-4">
        <div className="flex items-center justify-between">
          {/* Steps */}
          <div className="flex items-center gap-2 flex-1">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center flex-1">
                <button
                  onClick={() => handleStepClick(step)}
                  disabled={step.status === 'pending'}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${
                    step.id === currentStep
                      ? 'bg-blue-50 border-blue-600 shadow-sm'
                      : step.status === 'completed' || step.status === 'in_progress'
                      ? 'hover:bg-slate-50 cursor-pointer'
                      : 'cursor-not-allowed opacity-50'
                  } ${getStepColor(step)}`}
                >
                  {getStepIcon(step)}
                  <span className="font-medium text-sm whitespace-nowrap">{step.label}</span>
                </button>
                {index < steps.length - 1 && (
                  <div
                    className={`h-0.5 w-8 mx-2 ${
                      step.status === 'completed' ? 'bg-green-600' : 'bg-slate-300'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Close button */}
          {onClose && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="ml-4">
                  <X className="h-4 w-4 mr-2" />
                  Fermer
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Fermer l'analyse ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Vous allez quitter cette analyse. Vous pourrez y revenir plus tard depuis la liste des analyses.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={onClose}>Fermer</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
    </div>
  );
}
