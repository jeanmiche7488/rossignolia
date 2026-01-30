import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Gemini AI Service
 * Configuration déterministe pour mapping, cleaning et advisor
 */

// Initialize Gemini client
const getGeminiClient = () => {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_GEMINI_API_KEY is not set in environment variables");
  }
  return new GoogleGenerativeAI(apiKey);
};

/**
 * Get the Gemini model
 * Using gemini-2.5-flash (latest stable version)
 * If you need to use a different model, change it here
 * Available models: gemini-2.5-flash, gemini-2.5-pro, gemini-2.0-flash, etc.
 */
const getModel = () => {
  const client = getGeminiClient();
  // Use gemini-2.5-flash (stable, fast, and widely available)
  // Alternative: "gemini-2.5-pro" (more powerful), "gemini-2.0-flash" (older stable)
  return client.getGenerativeModel({ model: "gemini-2.5-flash" });
};

/**
 * Configuration déterministe pour mapping et cleaning
 * Selon les règles du projet : temperature: 0.0, topK: 1
 * 
 * Note: Le paramètre `seed` est "best-effort" chez Gemini - pas de garantie absolue
 * de déterminisme, mais améliore significativement la reproductibilité.
 * Voir: https://ai.google.dev/gemini-api/docs/models/generative-models#model-parameters
 */
const DETERMINISTIC_CONFIG = {
  temperature: 0.0,
  topK: 1,
  topP: 1,
  seed: 42, // Seed fixe pour reproductibilité (best-effort)
  maxOutputTokens: 32768, // Augmenté pour éviter les réponses tronquées (32k tokens)
};

/**
 * Configuration pour advisor (peut être moins stricte)
 */
const ADVISOR_CONFIG = {
  temperature: 0.3,
  topK: 40,
  topP: 0.95,
  // Les réponses "advisor" incluent souvent du python + plusieurs recommandations.
  // Augmenté pour éviter les réponses tronquées (cause fréquente de JSON invalide).
  maxOutputTokens: 32768,
};

/**
 * Types for prompt operations
 */
export type PromptType =
  | "mapping"
  | "cleaning"
  // Legacy name kept for backward compatibility (recommendations directly from stock entries)
  | "advisor"
  // New split: python codegen + recommendations from facts
  | "analysis_codegen"
  | "analysis_reco";

export interface MappingInput {
  columns: string[];
  sampleData?: Record<string, unknown>[];
  context?: string;
}

export interface CleaningInput {
  data: Record<string, unknown>[];
  mappedColumns: Record<string, string>;
  issues?: string[];
  tenantId?: string | null;
  useDbPrompt?: boolean;
}

export interface AdvisorInput {
  stockEntries: Record<string, unknown>[];
  analysisMetadata?: Record<string, unknown>;
  tenantId?: string | null;
  useDbPrompt?: boolean;
}

export interface AnalysisCodegenInput {
  datasetProfile: Record<string, unknown>;
  prompt: string;
  tenantId?: string | null;
  useDbPrompt?: boolean;
}

export interface AnalysisRecoFromFactsInput {
  facts: Record<string, unknown>;
  prompt: string;
  analysisMetadata?: Record<string, unknown>;
  tenantId?: string | null;
  useDbPrompt?: boolean;
}

/**
 * Mapping Prompt
 * Maps CSV/Excel columns to our schema fields
 */
export interface MapColumnsOptions {
  tenantId?: string | null;
  useDbPrompt?: boolean;
}

export async function mapColumns(
  input: MappingInput,
  options: MapColumnsOptions = {}
): Promise<{
  mappedColumns: Record<string, string>;
  confidence: number;
  reasoning: string;
}> {
  const model = getModel();

  // Try to get prompt from DB, fallback to default
  let promptTemplate: string | null = null;
  if (options.useDbPrompt !== false && options.tenantId !== undefined) {
    promptTemplate = await getPromptFromDB(options.tenantId, 'stock', 'mapping');
  }

  // Default prompt if not found in DB
  const defaultPrompt = `
Tu es un expert en mapping de données logistiques. 
Analyse les colonnes suivantes et mappe-les vers notre schéma de stock.

Colonnes à mapper: {columns}

{sampleData}

{context}

Schéma cible (CHAMPS OBLIGATOIRES marqués d'un *):
- sku*: Code SKU/Article/Produit (OBLIGATOIRE - cherche: SKU, EAN, Code, Référence, Codigo, Article, Product ID, Item ID, etc.)
- product_name: Nom du produit (cherche: Product Name, Nom, Désignation, Description, Item, Article Name, etc.)
- quantity*: Quantité en stock (OBLIGATOIRE - cherche: Quantity, Stock, Qté, Unidades, Amount, Qty, Stock Level, etc.)
- unit_cost: Coût unitaire en devise locale (cherche: Cost, Price, Prix, Coste, Unit Cost, Unit Price, etc.)
- local_currency: Code devise ISO (EUR, USD, etc.) — peut être mappé OU inféré depuis le nom de colonne (ex: "Cost USD" → USD). (cherche: Currency, Devise, Currency Code, ou infère depuis le nom de la colonne de coût)
- total_value: Valeur totale (cherche: Total, Value, Valeur, Total Value, Montant, etc.)
- location: Emplacement/Entrepôt (cherche: Location, Warehouse, Entrepôt, Depot, Almacen, etc.)
- category: Catégorie (cherche: Category, Catégorie, Type, Categoria, etc.)
- supplier: Fournisseur (cherche: Supplier, Fournisseur, Vendor, Proveedor, etc.)
- last_movement_date: Date du dernier mouvement (cherche: Date, Last Movement, Dernier Mouvement, Fecha, etc.)
- days_since_last_movement: Jours depuis dernier mouvement (cherche: Days, Jours, Dias, Age, etc.)

NOTE SUR LES DEVISES:
- Si une colonne contient une devise dans son nom (ex: "Cost USD", "Prix EUR", "Unit Cost $"), note-le dans le reasoning avec la devise détectée
- Le champ unit_cost_eur est CALCULÉ automatiquement, NE PAS le mapper
- Le champ local_currency peut être mappé depuis une colonne OU sera inféré par le système de nettoyage

RÈGLES CRITIQUES:
1. Les champs marqués * (sku et quantity) sont OBLIGATOIRES - tu DOIS trouver au moins une colonne correspondante
2. Pour sku: accepte EAN, Code, Référence, Codigo, Article ID, Product Code, SKU, Item Number, etc. - tout identifiant unique de produit
3. Pour quantity: accepte Stock, Qté, Unidades, Amount, Qty, Stock Level, On Hand, Available, etc. - toute colonne représentant une quantité
4. MULTI-FICHIERS: Si les données proviennent de plusieurs fichiers, CHAQUE fichier peut avoir sa propre colonne SKU/Quantity avec un nom différent. Tu DOIS mapper TOUTES les colonnes pertinentes de TOUS les fichiers.
5. Si plusieurs colonnes de différents fichiers représentent le même type de donnée (ex: "SKU" du fichier A et "Product Code" du fichier B), mappe LES DEUX vers le même champ cible.
6. Si une colonne ne correspond clairement à aucun champ, ne l'inclus pas dans mappedColumns.

Réponds UNIQUEMENT avec un JSON valide de cette structure:
{
  "mappedColumns": {
    "colonne_source_1": "champ_cible",
    "colonne_source_2": "champ_cible"
  },
  "confidence": 0.95,
  "reasoning": "Explication détaillée du mapping, fichier par fichier si multi-fichiers"
}

IMPORTANT: 
- Utilise UNIQUEMENT les champs listés ci-dessus
- Les champs sku et quantity DOIVENT être mappés pour CHAQUE fichier si possible
- Plusieurs colonnes sources peuvent être mappées vers le même champ cible (ex: "SKU" et "Product Code" → sku)
- Si une colonne ne correspond à aucun champ, ne l'inclus pas dans mappedColumns
- Les colonnes non mappées seront préservées dans le champ "attributes"
- Le JSON doit être valide et parsable
- Sois DÉTERMINISTE: avec les mêmes colonnes, produis toujours le même mapping
`;

  const template = promptTemplate || defaultPrompt;
  const { replacePromptPlaceholders } = await import('./prompts');
  
  const prompt = replacePromptPlaceholders(template, {
    columns: input.columns.join(", "),
    sampleData: input.sampleData 
      ? `Données d'exemple (premières lignes):\n${JSON.stringify(input.sampleData.slice(0, 3), null, 2)}`
      : "",
    context: input.context || "",
  });

  console.log('[Gemini Map] Appel à Gemini avec prompt (longueur:', prompt.length, 'caractères)');
  
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      ...DETERMINISTIC_CONFIG,
      responseMimeType: "application/json",
    },
  });

  const response = result.response;
  const text = response.text();
  
  console.log('[Gemini Map] Réponse reçue de Gemini');
  console.log('[Gemini Map] Longueur de la réponse:', text.length, 'caractères');
  
  try {
    const parsed = JSON.parse(text);
    console.log('[Gemini Map] JSON parsé avec succès');
    console.log('[Gemini Map] Confiance:', parsed.confidence);
    console.log('[Gemini Map] Nombre de colonnes mappées:', Object.keys(parsed.mappedColumns || {}).length);
    
    return {
      mappedColumns: parsed.mappedColumns || {},
      confidence: parsed.confidence || 0.5,
      reasoning: parsed.reasoning || "",
    };
  } catch (error) {
    console.error('[Gemini Map] ERREUR de parsing JSON');
    console.error('[Gemini Map] Erreur:', error);
    console.error('[Gemini Map] Réponse complète:', text);
    throw new Error(`Failed to parse Gemini mapping response: ${error}`);
  }
}

/**
 * Cleaning Prompt
 * Cleans and normalizes the data according to mapped columns
 */
export async function cleanData(input: CleaningInput): Promise<{
  cleanedData: Record<string, unknown>[];
  cleaningReport: {
    rowsProcessed: number;
    rowsCleaned: number;
    issues: string[];
    transformations: string[];
  };
  pythonCode: string;
}> {
  const model = getModel();

  // Try to get prompt from DB, fallback to default
  let promptTemplate: string | null = null;
  if (input.useDbPrompt !== false && input.tenantId !== undefined) {
    promptTemplate = await getPromptFromDB(input.tenantId, 'stock', 'cleaning');
  }

  // Default prompt if not found in DB
  const defaultPrompt = `
Tu es un expert en nettoyage de données logistiques.
Nettoie et normalise les données suivantes selon le mapping fourni.

Données à nettoyer: {data}

Mapping: {mappedColumns}

{issues}

Règles de nettoyage:
1. Normaliser les formats de dates (ISO 8601: YYYY-MM-DD)
2. Convertir les nombres (quantité, coûts) en format numérique
3. Nettoyer les chaînes (trim, normaliser les espaces)
4. Valider les SKUs (format cohérent)
5. Calculer les valeurs manquantes si possible (total_value = quantity * unit_cost)
6. GESTION DES DEVISES (IMPORTANT):
   - unit_cost = coût unitaire en devise locale (la valeur brute du fichier)
   - local_currency = code ISO de la devise (EUR, USD, GBP, etc.)
   - Si local_currency est mappé depuis une colonne, l'utiliser
   - SINON, INFÉRER la devise depuis le nom de la colonne unit_cost (ex: "Cost USD" → USD, "Prix EUR" → EUR, "Unit Cost $" → USD)
   - Si pas de devise détectable, assumer EUR par défaut
   - unit_cost_eur = CHAMP CALCULÉ (conversion en EUR):
     * Si local_currency = EUR → unit_cost_eur = unit_cost
     * Sinon: laisser null (conversion manuelle nécessaire) ou convertir si taux connu
7. Préserver toutes les colonnes non mappées dans "attributes"

Réponds UNIQUEMENT avec un JSON valide de cette structure:
{
  "cleanedData": [
    {
      "sku": "...",
      "product_name": "...",
      "quantity": 123,
      "unit_cost": 45.67,
      "local_currency": "EUR",
      "unit_cost_eur": 45.67,
      "total_value": 5617.41,
      "attributes": {
        "colonne_non_mappee": "valeur"
      }
    }
  ],
  "cleaningReport": {
    "rowsProcessed": 100,
    "rowsCleaned": 95,
    "issues": ["liste des problèmes"],
    "transformations": ["liste des transformations appliquées"],
    "currencyDetected": "EUR ou autre devise inférée"
  },
  "pythonCode": "Code Python qui justifie le nettoyage (White Box)"
}

IMPORTANT:
- Le JSON doit être valide et parsable
- Toutes les colonnes originales non mappées doivent être dans "attributes"
- Toujours remplir local_currency (mappé, inféré, ou EUR par défaut)
- Si local_currency = EUR, alors unit_cost_eur = unit_cost
- Le pythonCode doit être du code Python valide et exécutable
`;

  const template = promptTemplate || defaultPrompt;
  const { replacePromptPlaceholders } = await import('./prompts');
  
  const prompt = replacePromptPlaceholders(template, {
    data: JSON.stringify(input.data.slice(0, 10), null, 2) + 
          (input.data.length > 10 ? `\n... (${input.data.length - 10} lignes supplémentaires)` : ""),
    mappedColumns: JSON.stringify(input.mappedColumns, null, 2),
    issues: input.issues ? input.issues.join("\n") : "",
  });

  console.log('[Gemini Clean] Appel à Gemini avec prompt (longueur:', prompt.length, 'caractères)');
  
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      ...DETERMINISTIC_CONFIG,
      responseMimeType: "application/json",
    },
  });

  const response = result.response;
  const text = response.text();
  
  console.log('[Gemini Clean] Réponse reçue de Gemini');
  console.log('[Gemini Clean] Longueur de la réponse:', text.length, 'caractères');
  console.log('[Gemini Clean] Premiers 500 caractères:', text.substring(0, 500));
  console.log('[Gemini Clean] Derniers 500 caractères:', text.substring(Math.max(0, text.length - 500)));
  
  try {
    const parsed = JSON.parse(text);
    console.log('[Gemini Clean] JSON parsé avec succès');
    console.log('[Gemini Clean] Nombre d\'entrées nettoyées:', parsed.cleanedData?.length || 0);
    
    return {
      cleanedData: parsed.cleanedData || [],
      cleaningReport: parsed.cleaningReport || {
        rowsProcessed: 0,
        rowsCleaned: 0,
        issues: [],
        transformations: [],
      },
      pythonCode: parsed.pythonCode || "",
    };
  } catch (error) {
    console.error('[Gemini Clean] ERREUR de parsing JSON');
    console.error('[Gemini Clean] Erreur complète:', error);
    console.error('[Gemini Clean] Position de l\'erreur:', (error as any).message);
    
    // Essayer d'extraire le JSON même s'il y a du texte autour ou s'il est tronqué
    try {
      console.log('[Gemini Clean] Tentative d\'extraction/réparation du JSON...');
      
      // Si la réponse se termine par une virgule ou un objet incomplet, essayer de la compléter
      let repairedText = text.trim();
      
      // Si ça se termine par une virgule, c'est probablement tronqué
      if (repairedText.endsWith(',') || !repairedText.endsWith('}')) {
        console.log('[Gemini Clean] JSON semble tronqué, tentative de réparation...');
        
        // Compter les accolades ouvertes/fermées
        const openBraces = (repairedText.match(/\{/g) || []).length;
        const closeBraces = (repairedText.match(/\}/g) || []).length;
        
        // Si on a plus d'accolades ouvertes que fermées, fermer les structures
        if (openBraces > closeBraces) {
          // Retirer la dernière virgule si présente
          repairedText = repairedText.replace(/,\s*$/, '');
          
          // Fermer les tableaux et objets manquants
          const missingCloses = openBraces - closeBraces;
          for (let i = 0; i < missingCloses; i++) {
            repairedText += ']';
          }
          for (let i = 0; i < missingCloses; i++) {
            repairedText += '}';
          }
          
          console.log('[Gemini Clean] JSON réparé, tentative de parsing...');
        }
      }
      
      // Chercher un objet JSON dans la réponse
      const jsonMatch = repairedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const extractedJson = jsonMatch[0];
        const parsed = JSON.parse(extractedJson);
        console.log('[Gemini Clean] JSON extrait/réparé et parsé avec succès');
        console.log('[Gemini Clean] Nombre d\'entrées nettoyées:', parsed.cleanedData?.length || 0);
        
        return {
          cleanedData: parsed.cleanedData || [],
          cleaningReport: parsed.cleaningReport || {
            rowsProcessed: parsed.cleanedData?.length || 0,
            rowsCleaned: parsed.cleanedData?.length || 0,
            issues: [],
            transformations: [],
          },
          pythonCode: parsed.pythonCode || "",
        };
      }
    } catch (extractError) {
      console.error('[Gemini Clean] Échec de l\'extraction/réparation:', extractError);
    }
    
    // Sauvegarder la réponse complète pour debug
    console.error('[Gemini Clean] Réponse complète de Gemini:');
    console.error(text);
    
    throw new Error(`Failed to parse Gemini cleaning response: ${error}. Response length: ${text.length}, First 200 chars: ${text.substring(0, 200)}`);
  }
}

/**
 * Cleaning Plan - Structure for actions
 */
export interface CleaningAction {
  id: string;
  description: string;
  enabled: boolean;
  category: 'format' | 'validation' | 'calculation' | 'normalization' | 'inference';
  affectedFields: string[];
  pythonSnippet: string;
}

export interface CleaningPlan {
  actions: CleaningAction[];
  pythonCode: string;
  summary: {
    totalRows: number;
    estimatedChanges: number;
    warnings: string[];
  };
}

/**
 * Prepare Cleaning Plan
 * Generates a cleaning plan with individual actions that can be toggled
 * Does NOT execute the cleaning, only prepares the plan
 */
export async function prepareCleaningPlan(input: {
  data: Record<string, unknown>[];
  mappedColumns: Record<string, string>;
  tenantId?: string | null;
}): Promise<CleaningPlan> {
  const model = getModel();

  // Note: This function always uses the built-in prompt because it requires
  // a specific structured output format (actions array) that differs from
  // the standard cleaning prompt. A future "cleaning_plan" prompt type could
  // be added to system_prompts if tenant customization is needed.

  const defaultPrompt = `
Tu es un expert en nettoyage de données logistiques.
Analyse les données suivantes et génère un PLAN DE NETTOYAGE DÉTAILLÉ.

IMPORTANT: Tu dois générer un plan avec des actions concrètes, PAS exécuter le nettoyage.

Données à analyser (échantillon): {data}

Mapping appliqué: {mappedColumns}

GÉNÈRE OBLIGATOIREMENT des actions pour:
1. Normalisation des chaînes (trim, espaces multiples)
2. Conversion des nombres (quantity, unit_cost en numériques)
3. Formatage des dates (ISO 8601 si colonne date détectée)
4. Calcul de total_value si quantity et unit_cost présents
5. Inférence de local_currency depuis le nom de colonne unit_cost
6. Calcul de unit_cost_eur si local_currency détectable
7. Validation des SKU (format cohérent)

Tu dois retourner un JSON avec:
1. "actions": liste d'actions de nettoyage (MINIMUM 3 actions, même pour des données simples)
2. "pythonCode": code Python complet qui applique toutes les actions activées
3. "summary": résumé avec estimations

Format de chaque action:
{
  "id": "action_001",
  "description": "Description claire et actionnable",
  "enabled": true,
  "category": "format|validation|calculation|normalization|inference",
  "affectedFields": ["field1"],
  "pythonSnippet": "df['field'] = df['field'].str.strip()"
}

Catégories:
- format: Formatage (dates ISO, nombres)
- validation: Validation (SKU, nulls)
- calculation: Calculs (total_value, unit_cost_eur)
- normalization: Normalisation (trim, casse)
- inference: Inférence (local_currency)

RÈGLES DEVISES:
- local_currency: inférer depuis nom colonne unit_cost (ex: "Cost USD" → USD, sinon EUR)
- unit_cost_eur: = unit_cost si EUR, sinon null

Réponds UNIQUEMENT avec un JSON valide:
{
  "actions": [
    {
      "id": "action_001",
      "description": "Nettoyer les espaces dans les chaînes de caractères",
      "enabled": true,
      "category": "normalization",
      "affectedFields": ["sku", "product_name"],
      "pythonSnippet": "for col in ['sku', 'product_name']:\\n    df[col] = df[col].astype(str).str.strip()"
    },
    {
      "id": "action_002",
      "description": "Convertir quantity en nombre entier",
      "enabled": true,
      "category": "format",
      "affectedFields": ["quantity"],
      "pythonSnippet": "df['quantity'] = pd.to_numeric(df['quantity'], errors='coerce').fillna(0).astype(int)"
    },
    {
      "id": "action_003",
      "description": "Convertir unit_cost en nombre décimal",
      "enabled": true,
      "category": "format",
      "affectedFields": ["unit_cost"],
      "pythonSnippet": "df['unit_cost'] = pd.to_numeric(df['unit_cost'], errors='coerce')"
    },
    {
      "id": "action_004",
      "description": "Calculer total_value = quantity × unit_cost",
      "enabled": true,
      "category": "calculation",
      "affectedFields": ["total_value"],
      "pythonSnippet": "df['total_value'] = df['quantity'] * df['unit_cost']"
    },
    {
      "id": "action_005",
      "description": "Inférer local_currency (défaut: EUR)",
      "enabled": true,
      "category": "inference",
      "affectedFields": ["local_currency"],
      "pythonSnippet": "df['local_currency'] = 'EUR'  # À adapter selon nom colonne"
    },
    {
      "id": "action_006",
      "description": "Calculer unit_cost_eur (= unit_cost si EUR)",
      "enabled": true,
      "category": "calculation",
      "affectedFields": ["unit_cost_eur"],
      "pythonSnippet": "df['unit_cost_eur'] = df.apply(lambda r: r['unit_cost'] if r['local_currency'] == 'EUR' else None, axis=1)"
    }
  ],
  "pythonCode": "import pandas as pd\\n\\n# Code complet ici...",
  "summary": {
    "totalRows": 1234,
    "estimatedChanges": 567,
    "warnings": ["Liste des avertissements"]
  }
}
`;

  const { replacePromptPlaceholders } = await import('./prompts');

  const prompt = replacePromptPlaceholders(defaultPrompt, {
    data:
      JSON.stringify(input.data.slice(0, 10), null, 2) +
      (input.data.length > 10 ? `\n... (${input.data.length - 10} lignes supplémentaires, total: ${input.data.length})` : ''),
    mappedColumns: JSON.stringify(input.mappedColumns, null, 2),
  });

  console.log('[Gemini PrepareClean] Appel à Gemini...');

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      ...DETERMINISTIC_CONFIG,
      responseMimeType: 'application/json',
    },
  });

  const text = result.response.text();
  console.log('[Gemini PrepareClean] Réponse reçue, longueur:', text.length);

  try {
    const parsed = JSON.parse(text);
    return {
      actions: parsed.actions || [],
      pythonCode: parsed.pythonCode || '',
      summary: parsed.summary || { totalRows: input.data.length, estimatedChanges: 0, warnings: [] },
    };
  } catch (error) {
    console.error('[Gemini PrepareClean] Erreur de parsing:', error);
    console.error('[Gemini PrepareClean] Réponse:', text.substring(0, 500));
    throw new Error(`Failed to parse cleaning plan: ${error}`);
  }
}

/**
 * Advisor Prompt
 * Generates recommendations based on stock analysis
 */
export async function generateRecommendations(input: AdvisorInput): Promise<{
  recommendations: Array<{
    type: string;
    priority: "low" | "medium" | "high" | "critical";
    title: string;
    description: string;
    actionItems: Array<{
      title: string;
      description?: string;
      priority?: "low" | "medium" | "high";
    }>;
    affectedSkus: string[];
    estimatedImpact: {
      financialImpact?: number;
      currency?: string;
      potentialSavings?: number;
      riskLevel?: "low" | "medium" | "high";
      timeframe?: string;
    };
    pythonCode: string;
  }>;
}> {
  const model = getModel();

  // Try to get prompt from DB, fallback to default
  let promptTemplate: string | null = null;
  if (input.useDbPrompt !== false && input.tenantId !== undefined) {
    promptTemplate = await getPromptFromDB(input.tenantId, 'stock', 'advisor');
  }

  // Default prompt if not found in DB (array join to avoid template literal parsing issues)
  const defaultPrompt = [
    "Tu es un expert en analyse logistique et gestion de stock.",
    "Analyse les données de stock suivantes et génère des recommandations actionnables.",
    "",
    "Données de stock: {stockEntries}",
    "",
    "{analysisMetadata}",
    "",
    "Types de recommandations possibles:",
    "- dormant: Stock dormant (pas de mouvement depuis longtemps)",
    "- slow-moving: Rotation lente",
    "- overstock: Surstockage",
    "- understock: Sous-stockage",
    "- obsolete: Stock obsolète",
    "- high-value: Stock à haute valeur",
    "- low-rotation: Faible rotation",
    "",
    "Pour chaque recommandation, fournis:",
    "1. Un titre clair et actionnable",
    "2. Une description détaillée",
    "3. Des actions concrètes à entreprendre",
    "4. Les SKUs concernés",
    "5. L'impact financier estimé",
    "6. Le code Python qui justifie l'analyse (White Box)",
    "",
    "Réponds UNIQUEMENT avec un JSON valide de cette structure:",
    "{",
    '  "recommendations": [',
    "    {",
    '      "type": "dormant",',
    '      "priority": "high",',
    '      "title": "Titre de la recommandation",',
    '      "description": "Description détaillée",',
    '      "actionItems": [',
    "        {",
    '          "title": "Action 1",',
    '          "description": "Description de l\'action",',
    '          "priority": "high"',
    "        }",
    "      ],",
    '      "affectedSkus": ["SKU1", "SKU2"],',
    '      "estimatedImpact": {',
    '        "financialImpact": 10000,',
    '        "currency": "EUR",',
    '        "potentialSavings": 5000,',
    '        "riskLevel": "medium",',
    '        "timeframe": "3 mois"',
    "      },",
    '      "pythonCode": "Code Python qui justifie la recommandation"',
    "    }",
    "  ]",
    "}",
  ].join("\n");

  const template = promptTemplate || defaultPrompt;
  const { replacePromptPlaceholders } = await import('./prompts');
  const prompt = replacePromptPlaceholders(template, {
    stockEntries: JSON.stringify(input.stockEntries.slice(0, 20), null, 2) +
      (input.stockEntries.length > 20 ? `\n... (${input.stockEntries.length - 20} entrées supplémentaires)` : ""),
    analysisMetadata: input.analysisMetadata ? JSON.stringify(input.analysisMetadata, null, 2) : "",
  });

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      ...ADVISOR_CONFIG,
      responseMimeType: "application/json",
    },
  });

  const text = result.response.text();
  const tryParseAdvisor = (raw: string) => {
    let s = raw.trim();
    const jsonBlock = s.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonBlock) s = jsonBlock[1].trim();
    const parsed = JSON.parse(s);
    return { recommendations: parsed.recommendations || [] };
  };

  try {
    return tryParseAdvisor(text);
  } catch (error) {
    try {
      const trimmed = text.trim();
      const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
      if (jsonMatch) return tryParseAdvisor(jsonMatch[0]);
    } catch {
      // ignore
    }
    try {
      const repairPrompt = `
Tu es un validateur/réparateur JSON strict.
Retourne UNIQUEMENT un JSON valide conforme au schéma "recommendations".
Entrée à réparer:
${text}
`;
      const repaired = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: repairPrompt }] }],
        generationConfig: { ...DETERMINISTIC_CONFIG, responseMimeType: "application/json" },
      });
      return tryParseAdvisor(repaired.response.text());
    } catch {
      throw new Error(
        `Failed to parse Gemini advisor response: ${error}. First 200 chars: ${text.substring(0, 200)}`
      );
    }
  }
}

/**
 * Analysis Codegen Prompt
 * Generates a Python script that reads JSONL rows from stdin and prints a JSON facts object to stdout.
 */
export async function generateAnalysisPython(input: AnalysisCodegenInput): Promise<{
  pythonCode: string;
  notes: string;
}> {
  const model = getModel();

  // Try to get prompt from DB, fallback to provided prompt
  let promptTemplate: string | null = null;
  if (input.useDbPrompt !== false && input.tenantId !== undefined) {
    promptTemplate = await getPromptFromDB(input.tenantId, 'stock', 'analysis_codegen');
  }

  const defaultPrompt = `
TÂCHE: Génère un script Python qui analyse des données de stock.

DONNÉES D'ENTRÉE (sample):
{datasetProfile}

INSTRUCTIONS PYTHON:
1. Le script lit STDIN ligne par ligne (format JSONL - une ligne JSON par entrée)
2. Chaque ligne contient: sku, product_name, quantity, unit_cost, total_value, location, category, supplier, last_movement_date, days_since_last_movement, attributes, created_at
3. Le script doit écrire sur STDOUT un seul objet JSON (pas de print, pas de logs)

STRUCTURE JSON DE SORTIE OBLIGATOIRE:
{
  "overview": {
    "totalSkus": int,
    "totalQuantity": int,
    "totalValue": float,
    "avgUnitCost": float,
    "uniqueLocations": int,
    "uniqueSuppliers": int
  },
  "pillars": {
    "dormancy": {
      "score": int (0-100),
      "skusAtRisk": int,
      "valueAtRisk": float,
      "percentOfTotal": float
    },
    "rotation": {
      "score": int (0-100),
      "avgRotation": float,
      "skusLowRotation": int
    },
    "obsolescence": {
      "score": int (0-100),
      "potentialObsolete": int,
      "valueAtRisk": float
    },
    "dataQuality": {
      "score": int (0-100),
      "completeness": float,
      "missingRates": {"field": percent}
    }
  },
  "executiveSummary": {
    "healthScore": int (0-100),
    "mainRisk": "string",
    "quickWin": "string",
    "cashAtRisk": float,
    "potentialSavings": float
  },
  "alerts": [{"type": "critical|warning|info", "message": "string"}]
}

RÈGLES PYTHON:
- Utilise: import sys, json; from datetime import datetime
- Lecture streaming: for line in sys.stdin: row = json.loads(line)
- Dates ISO sans timezone: datetime.fromisoformat(date_str) ou strptime
- Fin: print(json.dumps(result))
- Erreurs: sys.exit(1) avec message sur stderr

DÉFINITIONS MÉTIER:
- Dormant: aucun mouvement > 90 jours (score 100 = 0% dormant)
- Low rotation: rotation estimée < 2 tours/an
- Long tail: SKUs < 5% valeur mais > 50% des références

OBJECTIF UTILISATEUR:
{prompt}

RÉPONSE ATTENDUE (JSON uniquement):
{"pythonCode": "import sys\\nimport json\\n...", "notes": "courte description"}
`;

  const template = promptTemplate || defaultPrompt;
  const { replacePromptPlaceholders } = await import('./prompts');

  const promptText = replacePromptPlaceholders(template, {
    datasetProfile: JSON.stringify(input.datasetProfile, null, 2),
    prompt: input.prompt,
  });

  console.log('[Gemini Codegen] Sending prompt to Gemini, length:', promptText.length);
  
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: promptText }] }],
    generationConfig: {
      ...DETERMINISTIC_CONFIG,
      responseMimeType: "application/json",
    },
  });

  const text = result.response.text();
  console.log('[Gemini Codegen] Response received, length:', text.length);
  console.log('[Gemini Codegen] Response preview:', text.substring(0, 500));
  
  try {
    const parsed = JSON.parse(text);
    console.log('[Gemini Codegen] Parsed keys:', Object.keys(parsed));
    console.log('[Gemini Codegen] pythonCode exists:', !!parsed.pythonCode);
    console.log('[Gemini Codegen] pythonCode length:', parsed.pythonCode?.length || 0);
    
    // Try different possible keys for python code (Gemini sometimes uses different names)
    const pythonCode = parsed.pythonCode || parsed.python_code || parsed.tool_code || parsed.code || "";
    
    if (!pythonCode) {
      console.error('[Gemini Codegen] No python code found in response!');
      console.error('[Gemini Codegen] Full response:', text);
    }
    
    return {
      pythonCode,
      notes: parsed.notes || "",
    };
  } catch (e) {
    console.error('[Gemini Codegen] JSON parse error:', e);
    console.error('[Gemini Codegen] Raw response:', text);
    throw new Error(`Failed to parse Gemini analysis codegen response: ${e}. First 500 chars: ${text.substring(0, 500)}`);
  }
}

/**
 * Analysis Reco Prompt
 * Generates recommendations from a JSON "facts" object (output of the python execution).
 */
export async function generateRecommendationsFromFacts(input: AnalysisRecoFromFactsInput): Promise<{
  recommendations: Array<{
    type: string;
    level: "macro" | "micro";
    pillar: "DORMANCY" | "ROTATION" | "OBSOLESCENCE" | "DATA_QUALITY";
    priority: "low" | "medium" | "high" | "critical";
    title: string;
    description: string;
    actionItems: Array<{
      title: string;
      description?: string;
      priority?: "low" | "medium" | "high";
    }>;
    affectedSkus: string[];
    estimatedImpact: {
      financialImpact?: number;
      currency?: string;
      potentialSavings?: number;
      riskLevel?: "low" | "medium" | "high";
      timeframe?: string;
    };
  }>;
}> {
  const model = getModel();

  // Try to get prompt from DB, fallback to provided prompt
  let promptTemplate: string | null = null;
  if (input.useDbPrompt !== false && input.tenantId !== undefined) {
    promptTemplate = await getPromptFromDB(input.tenantId, 'stock', 'analysis_reco');
  }

  const defaultPrompt = `
Tu es un consultant senior en Supply Chain et gestion de stock, présentant à un COMEX (Comité Exécutif).
Tu ne dois PAS recalculer à partir des lignes brutes. Tu dois uniquement te baser sur les FACTS JSON ci-dessous.

FACTS (résultat de l'analyse Python):
{facts}

{analysisMetadata}

OBJECTIF:
{prompt}

EXIGENCES POUR LES RECOMMANDATIONS (NIVEAU COMEX):

1. DEUX NIVEAUX D'ACTIONS
   - MACRO: Décisions stratégiques pour le COMEX (ex: "Revoir la politique d'approvisionnement", "Mettre en place un processus de déstockage")
   - MICRO: Actions opérationnelles détaillées (ex: "Contacter fournisseur X pour retour", "Lancer promo sur SKU Y")

2. GAINS MESURABLES ET CHIFFRÉS
   - Toujours quantifier l'impact financier (€)
   - Économies potentielles, cash libéré, coûts évités
   - Délai de réalisation du gain

3. PRIORISATION CLAIRE
   - "critical": Action immédiate requise (risque majeur ou gain >50k€)
   - "high": À traiter sous 1 mois (gain 10-50k€)
   - "medium": À planifier sous 3 mois (gain 1-10k€)
   - "low": Quick win ou amélioration continue (<1k€)

4. PILIERS D'ANALYSE (basés sur les facts)
   - DORMANCY: Stock sans mouvement (90j, 180j, 365j)
   - ROTATION: Vitesse de rotation du stock
   - OBSOLESCENCE: Long tail, risque de dépréciation
   - DATA_QUALITY: Qualité des données, champs manquants

Réponds UNIQUEMENT avec un JSON valide:
{
  "recommendations": [
    {
      "type": "dormancy|rotation|obsolescence|data_quality|overstock|understock",
      "level": "macro|micro",
      "priority": "low|medium|high|critical",
      "pillar": "DORMANCY|ROTATION|OBSOLESCENCE|DATA_QUALITY",
      "title": "Verbe d'action + bénéfice chiffré",
      "description": "Description concise orientée action et résultat",
      "actionItems": [
        {"title": "Action 1", "description": "Détail avec responsable suggéré", "priority": "high"},
        {"title": "Action 2", "description": "...", "priority": "medium"}
      ],
      "affectedSkus": ["SKU1", "SKU2"],
      "estimatedImpact": {
        "financialImpact": 45000,
        "currency": "EUR",
        "potentialSavings": 45000,
        "riskLevel": "low|medium|high",
        "timeframe": "1-3 mois"
      }
    }
  ]
}

RÈGLES:
- Génère 4 à 8 recommandations: au moins 2 MACRO et 2-4 MICRO
- Chaque pilier (DORMANCY, ROTATION, OBSOLESCENCE, DATA_QUALITY) devrait avoir au moins 1 reco si le score < 80
- Les recos MACRO sont des décisions stratégiques, les MICRO sont des actions opérationnelles concrètes
- Qualité > Quantité
`;

  const template = promptTemplate || defaultPrompt;
  const { replacePromptPlaceholders } = await import('./prompts');

  const promptText = replacePromptPlaceholders(template, {
    facts: JSON.stringify(input.facts, null, 2),
    analysisMetadata: input.analysisMetadata ? JSON.stringify(input.analysisMetadata, null, 2) : "",
    prompt: input.prompt,
  });

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: promptText }] }],
    generationConfig: {
      ...ADVISOR_CONFIG,
      responseMimeType: "application/json",
    },
  });

  const text = result.response.text();

  // Reuse the robust advisor parsing strategy
  const tryParse = (raw: string) => {
    let s = raw.trim();
    const jsonBlock = s.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonBlock) s = jsonBlock[1].trim();
    const parsed = JSON.parse(s);
    return {
      recommendations: parsed.recommendations || [],
    };
  };

  try {
    return tryParse(text);
  } catch (error) {
    // Attempt a deterministic repair pass
    const repairPrompt = `
Tu es un validateur/réparateur JSON strict.
Retourne UNIQUEMENT un JSON valide conforme au schéma "recommendations".

Entrée à réparer:
${text}
`;
    const repaired = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: repairPrompt }] }],
      generationConfig: { ...DETERMINISTIC_CONFIG, responseMimeType: "application/json" },
    });
    const repairedText = repaired.response.text();
    return tryParse(repairedText);
  }
}


/**
 * Helper to get prompt from database
 * Falls back to default prompt if not found
 */
export async function getPromptFromDB(
  tenantId: string | null,
  moduleCode: string,
  promptType: PromptType
): Promise<string | null> {
  const { getSystemPrompt } = await import('./prompts');
  const prompt = await getSystemPrompt(tenantId, moduleCode, promptType);
  return prompt?.content || null;
}
