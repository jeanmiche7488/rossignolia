'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createBrowserClient } from '@/lib/db/supabase-client';
import { useRouter } from 'next/navigation';
import { useState, useRef } from 'react';
import { Upload, FileText, X, Plus, Info, CheckCircle2, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
// Using native select for now - can be upgraded to Radix UI later if needed

interface NewAnalysisFormProps {
  tenantId: string;
  userId: string;
}

interface FileWithMetadata {
  file: File;
  sourceType: string;
  description: string;
  id: string;
}

// Required fields for Stock Health analysis
const REQUIRED_FIELDS = [
  { name: 'sku', label: 'Code SKU/Article', required: true, description: 'Identifiant unique du produit' },
  { name: 'product_name', label: 'Nom du produit', required: false, description: 'Nom descriptif du produit' },
  { name: 'quantity', label: 'Quantité en stock', required: true, description: 'Nombre d\'unités en stock' },
  { name: 'unit_cost', label: 'Coût unitaire', required: false, description: 'Prix d\'achat unitaire' },
  { name: 'total_value', label: 'Valeur totale', required: false, description: 'Valeur totale du stock (peut être calculé)' },
  { name: 'location', label: 'Emplacement/Entrepôt', required: false, description: 'Lieu de stockage' },
  { name: 'category', label: 'Catégorie', required: false, description: 'Catégorie du produit' },
  { name: 'supplier', label: 'Fournisseur', required: false, description: 'Nom du fournisseur' },
  { name: 'last_movement_date', label: 'Date du dernier mouvement', required: false, description: 'Date du dernier mouvement de stock' },
  { name: 'days_since_last_movement', label: 'Jours depuis dernier mouvement', required: false, description: 'Peut être calculé automatiquement' },
];

const SOURCE_TYPES = [
  { value: 'stock', label: 'Stock actuel', description: 'Fichier contenant l\'état actuel du stock' },
  { value: 'movements', label: 'Mouvements de stock', description: 'Historique des mouvements (entrées/sorties)' },
  { value: 'suppliers', label: 'Données fournisseurs', description: 'Informations sur les fournisseurs et leurs produits' },
  { value: 'sales', label: 'Données de ventes', description: 'Historique des ventes pour calculer la rotation' },
  { value: 'other', label: 'Autre', description: 'Autre source de données' },
];

export function NewAnalysisForm({ tenantId, userId }: NewAnalysisFormProps) {
  const [name, setName] = useState('');
  const [files, setFiles] = useState<FileWithMetadata[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = createBrowserClient();

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files)
        .filter(isValidFile)
        .map((file) => ({
          file,
          sourceType: 'stock',
          description: '',
          id: Math.random().toString(36).substring(7),
        }));
      
      if (newFiles.length > 0) {
        setFiles((prev) => [...prev, ...newFiles]);
        // Auto-fill name if empty
        if (!name.trim() && newFiles.length === 1) {
          const fileName = newFiles[0].file.name.replace(/\.[^/.]+$/, '');
          setName(fileName);
        }
      } else {
        setError('Aucun fichier valide. Formats supportés : CSV, XLS, XLSX');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files)
        .filter(isValidFile)
        .map((file) => ({
          file,
          sourceType: 'stock',
          description: '',
          id: Math.random().toString(36).substring(7),
        }));
      
      if (newFiles.length > 0) {
        setFiles((prev) => [...prev, ...newFiles]);
        // Auto-fill name if empty
        if (!name.trim() && newFiles.length === 1) {
          const fileName = newFiles[0].file.name.replace(/\.[^/.]+$/, '');
          setName(fileName);
        }
      } else {
        setError('Aucun fichier valide sélectionné. Formats supportés : CSV, XLS, XLSX');
      }
    }
    // Reset input to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const isValidFile = (file: File): boolean => {
    const validTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    const validExtensions = ['.csv', '.xls', '.xlsx'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();

    return (
      validTypes.includes(file.type) ||
      validExtensions.includes(fileExtension)
    );
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const updateFileMetadata = (id: string, field: 'sourceType' | 'description', value: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, [field]: value } : f))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Le nom de l\'analyse est requis');
      return;
    }

    if (files.length === 0) {
      setError('Veuillez téléverser au moins un fichier');
      return;
    }

    setLoading(true);

    try {
      // Step 1: Create analysis record
      const { data: analysis, error: analysisError } = await supabase
        .from('analyses')
        .insert({
          tenant_id: tenantId,
          name: name.trim(),
          file_name: files.map((f) => f.file.name).join(', '), // Store all file names
          file_type: 'multiple', // Indicate multiple files
          status: 'pending',
          created_by: userId,
          metadata: {
            file_count: files.length,
            source_types: files.map((f) => f.sourceType),
          },
        })
        .select()
        .single();

      if (analysisError) {
        throw new Error(analysisError.message);
      }

      // Step 2: Upload all files to Supabase Storage
      const uploadPromises = files.map(async (fileWithMeta, index) => {
        const formData = new FormData();
        formData.append('file', fileWithMeta.file);
        formData.append('analysisId', analysis.id);
        formData.append('sourceType', fileWithMeta.sourceType);
        formData.append('description', fileWithMeta.description);
        formData.append('fileIndex', index.toString());

        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!uploadResponse.ok) {
          const uploadError = await uploadResponse.json();
          throw new Error(`Erreur lors de l'upload de ${fileWithMeta.file.name}: ${uploadError.error}`);
        }

        return uploadResponse.json();
      });

      await Promise.all(uploadPromises);

      // Step 3: Trigger analysis processing (mapping phase with aggregation)
      const processResponse = await fetch('/api/analyze/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          analysisId: analysis.id,
        }),
      });

      if (!processResponse.ok) {
        const processError = await processResponse.json();
        throw new Error(processError.error || 'Erreur lors du démarrage du traitement');
      }

      const processData = await processResponse.json();
      
      // If mapping requires confirmation, redirect to loading page first
      if (processData.requiresMappingConfirmation) {
        router.push(`/stock/${analysis.id}/mapping/loading`);
      } else {
        // Otherwise redirect to analysis page
        router.push(`/stock/${analysis.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Guide Section */}
      {showGuide && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="flex items-center gap-2 text-blue-900">
                  <Info className="h-5 w-5" />
                  Données nécessaires pour l'analyse Stock Health
                </CardTitle>
                <CardDescription className="text-blue-700 mt-2">
                  Pour réaliser une analyse complète, vous pouvez fournir plusieurs fichiers provenant de différentes sources.
                  Les données seront agrégées automatiquement.
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowGuide(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold text-sm text-blue-900 mb-2">
                Champs requis (minimum) :
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {REQUIRED_FIELDS.filter((f) => f.required).map((field) => (
                  <div key={field.name} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-medium">{field.label}</span>
                      <span className="text-muted-foreground ml-1">({field.description})</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-sm text-blue-900 mb-2">
                Champs optionnels (recommandés) :
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {REQUIRED_FIELDS.filter((f) => !f.required).map((field) => (
                  <div key={field.name} className="flex items-start gap-2 text-sm">
                    <AlertCircle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-medium">{field.label}</span>
                      <span className="text-muted-foreground ml-1">({field.description})</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="pt-2 border-t border-blue-200">
              <p className="text-xs text-blue-700">
                <strong>Conseil :</strong> Plus vous fournissez de données, plus l'analyse sera précise.
                Vous pouvez combiner plusieurs fichiers (stock actuel, mouvements, fournisseurs, ventes) pour une vue complète.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Informations de l'analyse</CardTitle>
          <CardDescription>
            Donnez un nom à votre analyse pour la retrouver facilement
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="name">Nom de l'analyse</Label>
            <Input
              id="name"
              placeholder="Analyse stock Q1 2024"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={loading}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fichiers de données</CardTitle>
          <CardDescription>
            Téléversez un ou plusieurs fichiers CSV ou Excel. Vous pouvez ajouter plusieurs fichiers pour agréger vos données.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Upload Zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium mb-1">
              Glissez-déposez vos fichiers ici
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              ou cliquez pour sélectionner
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
            >
              <Plus className="h-4 w-4 mr-2" />
              Ajouter des fichiers
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xls,.xlsx"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
            <p className="text-xs text-muted-foreground mt-3">
              Formats supportés : CSV, XLS, XLSX (plusieurs fichiers possibles)
            </p>
          </div>

          {/* Files List */}
          {files.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">
                Fichiers ajoutés ({files.length})
              </h4>
              {files.map((fileWithMeta) => (
                <Card key={fileWithMeta.id} className="border">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <div className="flex-1">
                            <p className="font-medium text-sm">{fileWithMeta.file.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {(fileWithMeta.file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(fileWithMeta.id)}
                          disabled={loading}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor={`source-${fileWithMeta.id}`} className="text-xs">
                            Type de source
                          </Label>
                          <select
                            id={`source-${fileWithMeta.id}`}
                            value={fileWithMeta.sourceType}
                            onChange={(e) =>
                              updateFileMetadata(fileWithMeta.id, 'sourceType', e.target.value)
                            }
                            disabled={loading}
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {SOURCE_TYPES.map((type) => (
                              <option key={type.value} value={type.value}>
                                {type.label}
                              </option>
                            ))}
                          </select>
                          <p className="text-xs text-muted-foreground">
                            {SOURCE_TYPES.find((t) => t.value === fileWithMeta.sourceType)?.description}
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`desc-${fileWithMeta.id}`} className="text-xs">
                            Description (optionnel)
                          </Label>
                          <Textarea
                            id={`desc-${fileWithMeta.id}`}
                            placeholder="Ex: Stock principal au 31/12/2024"
                            value={fileWithMeta.description}
                            onChange={(e) =>
                              updateFileMetadata(fileWithMeta.id, 'description', e.target.value)
                            }
                            disabled={loading}
                            rows={2}
                            className="text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        {/* Validation messages */}
        {(!name.trim() || files.length === 0) && (
          <div className="rounded-lg border border-orange-200 bg-orange-50/50 p-3 text-sm">
            <p className="font-medium text-orange-900 mb-1">Pour créer l'analyse, vous devez :</p>
            <ul className="list-disc list-inside space-y-1 text-orange-800">
              {!name.trim() && <li>Donner un nom à l'analyse</li>}
              {files.length === 0 && <li>Ajouter au moins un fichier</li>}
            </ul>
          </div>
        )}
        
        <div className="flex gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={loading}
          >
            Annuler
          </Button>
          <Button 
            type="submit" 
            disabled={loading || files.length === 0 || !name.trim()}
            className="min-w-[200px]"
          >
            {loading ? (
              'Création en cours...'
            ) : files.length === 0 ? (
              'Ajoutez des fichiers'
            ) : !name.trim() ? (
              'Donnez un nom à l\'analyse'
            ) : (
              `Créer l'analyse (${files.length} fichier${files.length > 1 ? 's' : ''})`
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
