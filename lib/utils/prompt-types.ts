/**
 * Libellés et descriptions des types de prompts système (admin + flow analyse).
 * Une seule source de vérité pour l'interface admin.
 */

export const PROMPT_TYPE_LABELS: Record<string, string> = {
  mapping: 'Mapping colonnes',
  cleaning: 'Nettoyage des données',
  analysis_codegen: 'Analyse / Génération du code Python',
  analysis_reco: 'Analyse / Recommandations depuis facts',
};

export const PROMPT_TYPE_DESCRIPTIONS: Record<string, string> = {
  mapping:
    "Utilisé après l'upload des fichiers : l'IA propose une correspondance entre les colonnes sources (CSV/Excel) et les champs cibles du schéma stock (sku, quantity, etc.). L'utilisateur peut valider ou modifier avant de passer au nettoyage.",

  cleaning:
    "Utilisé après la validation du mapping : l'IA nettoie et normalise les données (dates ISO, nombres, chaînes, calcul de total_value, etc.) et produit les entrées prêtes pour stock_entries. Les colonnes non mappées sont conservées dans attributes.",

  analysis_codegen:
    "Utilisé à l'étape « Préparer l'analyse » : l'IA génère un script Python à partir d'un profil du dataset (nombre de lignes, champs, échantillon) et du prompt utilisateur. Ce script lit des lignes JSONL sur stdin et écrit un JSON « facts » sur stdout (KPI, segments, anomalies). Il est conçu pour traiter des milliers de lignes en streaming.",

  analysis_reco:
    "Utilisé après l'exécution du Python : l'IA ne reçoit pas les lignes brutes mais uniquement le JSON « facts » produit par le script. Elle en déduit des recommandations actionnables (titres, priorités, SKUs concernés, impact estimé). Cela évite d'envoyer des milliers de lignes à l'IA et rend les résultats reproductibles.",
};

export const PROMPT_TYPE_VARIABLES: Record<string, string[]> = {
  mapping: ['columns', 'sampleData', 'context'],
  cleaning: ['data', 'mappedColumns', 'issues'],
  analysis_codegen: ['datasetProfile', 'prompt'],
  analysis_reco: ['facts', 'analysisMetadata', 'prompt'],
};

export function getPromptTypeLabel(type: string): string {
  return PROMPT_TYPE_LABELS[type] ?? type;
}

export function getPromptTypeDescription(type: string): string {
  return PROMPT_TYPE_DESCRIPTIONS[type] ?? '';
}

export function getPromptTypeVariables(type: string): string[] {
  return PROMPT_TYPE_VARIABLES[type] ?? [];
}
