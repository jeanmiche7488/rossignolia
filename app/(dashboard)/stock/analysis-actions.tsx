'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
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
import { Trash2, RotateCcw, Loader2 } from 'lucide-react';

interface AnalysisActionsProps {
  analysisId: string;
  analysisName: string;
  hasWritePermission: boolean;
}

export function AnalysisActions({ analysisId, analysisName, hasWritePermission }: AnalysisActionsProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [restarting, setRestarting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/analyze/delete?analysisId=${analysisId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors de la suppression');
      }

      // Refresh the page to update the list
      router.refresh();
    } catch (error) {
      console.error('Delete error:', error);
      alert(error instanceof Error ? error.message : 'Erreur lors de la suppression');
    } finally {
      setDeleting(false);
    }
  };

  const handleRestart = async () => {
    setRestarting(true);
    try {
      const response = await fetch('/api/analyze/restart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ analysisId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors de la relance');
      }

      const data = await response.json();
      
      // If mapping confirmation is required, redirect to mapping page
      if (data.requiresMappingConfirmation) {
        router.push(`/stock/${analysisId}/mapping`);
      } else {
        router.push(`/stock/${analysisId}`);
      }
    } catch (error) {
      console.error('Restart error:', error);
      alert(error instanceof Error ? error.message : 'Erreur lors de la relance');
      setRestarting(false);
    }
  };

  if (!hasWritePermission) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 justify-end">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
            disabled={deleting || restarting}
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l'analyse</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer l'analyse <strong>"{analysisName}"</strong> ?
              Cette action est irréversible et supprimera également tous les fichiers et résultats associés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Suppression...
                </>
              ) : (
                'Supprimer'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Button
        variant="ghost"
        size="sm"
        onClick={handleRestart}
        disabled={deleting || restarting}
        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
        title="Reprendre/Relancer l'analyse"
      >
        {restarting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RotateCcw className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
