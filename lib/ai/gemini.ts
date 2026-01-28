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
 */
const DETERMINISTIC_CONFIG = {
  temperature: 0.0,
  topK: 1,
  topP: 1,
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
- unit_cost: Coût unitaire (cherche: Cost, Price, Prix, Coste, Unit Cost, Unit Price, etc.)
- currency: Code devise ISO (EUR, USD, etc.) — important si unit_cost peut être en plusieurs devises (cherche: Currency, Devise, Currency Code, etc.)
- total_value: Valeur totale (cherche: Total, Value, Valeur, Total Value, Montant, etc.)
- location: Emplacement/Entrepôt (cherche: Location, Warehouse, Entrepôt, Depot, Almacen, etc.)
- category: Catégorie (cherche: Category, Catégorie, Type, Categoria, etc.)
- supplier: Fournisseur (cherche: Supplier, Fournisseur, Vendor, Proveedor, etc.)
- last_movement_date: Date du dernier mouvement (cherche: Date, Last Movement, Dernier Mouvement, Fecha, etc.)
- days_since_last_movement: Jours depuis dernier mouvement (cherche: Days, Jours, Dias, Age, etc.)

RÈGLES CRITIQUES:
1. Les champs marqués * (sku et quantity) sont OBLIGATOIRES - tu DOIS trouver au moins une colonne correspondante
2. Pour sku: accepte EAN, Code, Référence, Codigo, Article ID, Product Code, etc. - tout identifiant unique de produit
3. Pour quantity: accepte Stock, Qté, Unidades, Amount, Qty, Stock Level, etc. - toute colonne représentant une quantité
4. Si plusieurs colonnes peuvent correspondre à un même champ, choisis la plus pertinente
5. Si une colonne ne correspond clairement à aucun champ, ne l'inclus pas dans mappedColumns

Réponds UNIQUEMENT avec un JSON valide de cette structure:
{
  "mappedColumns": {
    "colonne_source": "champ_cible"
  },
  "confidence": 0.95,
  "reasoning": "Explication du mapping, notamment pour les champs obligatoires"
}

IMPORTANT: 
- Utilise UNIQUEMENT les champs listés ci-dessus
- Les champs sku et quantity DOIVENT être mappés si possible (cherche activement des correspondances)
- Si une colonne ne correspond à aucun champ, ne l'inclus pas dans mappedColumns
- Les colonnes non mappées seront préservées dans le champ "attributes"
- Le JSON doit être valide et parsable
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
6. Si des devises différentes sont détectées pour unit_cost: remplir "currency" (code ISO: EUR, USD, etc.). Si currency est mappé, l'utiliser; sinon inférer si possible. Remplir "unit_cost_eur": si currency = EUR alors unit_cost_eur = unit_cost; sinon laisser null ou convertir si taux connu.
7. Préserver toutes les colonnes non mappées dans "attributes"

Réponds UNIQUEMENT avec un JSON valide de cette structure:
{
  "cleanedData": [
    {
      "sku": "...",
      "product_name": "...",
      "quantity": 123,
      "unit_cost": 45.67,
      "currency": "EUR",
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
    "transformations": ["liste des transformations appliquées"]
  },
  "pythonCode": "Code Python qui justifie le nettoyage (White Box)"
}

IMPORTANT:
- Le JSON doit être valide et parsable
- Toutes les colonnes originales non mappées doivent être dans "attributes"
- Si currency est présent, remplir unit_cost_eur quand currency = EUR (unit_cost_eur = unit_cost)
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

  const defaultPrompt = [
    "Tu es un expert data/analytics en logistique.",
    "Tu dois produire un script Python robuste et efficace.",
    "",
    "CONTEXTE DATASET (profil, pas toutes les lignes):",
    "{datasetProfile}",
    "",
    "CONTRAT D'ENTRÉE:",
    "- Le script lit depuis STDIN un flux JSON Lines (JSONL), 1 ligne = 1 objet stock entry.",
    "- Chaque objet ressemble à une ligne de la table stock_entries (sku, product_name, quantity, unit_cost, currency, unit_cost_eur, total_value, location, category, supplier, last_movement_date, days_since_last_movement, attributes, created_at).",
    "",
    "CONTRAT DE SORTIE (CRITIQUE):",
    "- Le script doit écrire sur STDOUT UNIQUEMENT un JSON valide (pas de markdown, pas de logs).",
    "- Ce JSON s'appelle \"facts\" et doit contenir AU MINIMUM:",
    "  - rowCount",
    "  - skuCount",
    "  - totalQuantity",
    "  - totalValue",
    "  - nullRates (par champ)",
    "  - segments (ex: dormant/overstock/understock) avec pour chaque segment: count + topSkus (max 50)",
    "  - anomalies (liste de strings)",
    "",
    "RÈGLES:",
    "  - Doit supporter des milliers / dizaines de milliers de lignes : traitement streaming (ne pas stocker toutes les lignes).",
    "  - Doit être déterministe.",
    "  - Échapper correctement les guillemets dans les chaînes JSON.",
    "  - Toute erreur doit provoquer un exit non-zero et écrire l'erreur sur STDERR.",
    "",
    "OBJECTIF ANALYSE (prompt utilisateur):",
    "{prompt}",
    "",
    "Réponds UNIQUEMENT avec un JSON valide de cette structure:",
    "{",
    '  "pythonCode": "....",',
    "  \"notes\": \"courtes notes d'implémentation\"",
    "}",
  ].join("\n");

  const template = promptTemplate || defaultPrompt;
  const { replacePromptPlaceholders } = await import('./prompts');

  const promptText = replacePromptPlaceholders(template, {
    datasetProfile: JSON.stringify(input.datasetProfile, null, 2),
    prompt: input.prompt,
  });

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: promptText }] }],
    generationConfig: {
      ...DETERMINISTIC_CONFIG,
      responseMimeType: "application/json",
    },
  });

  const text = result.response.text();
  try {
    const parsed = JSON.parse(text);
    return {
      pythonCode: parsed.pythonCode || "",
      notes: parsed.notes || "",
    };
  } catch (e) {
    throw new Error(`Failed to parse Gemini analysis codegen response: ${e}. First 200 chars: ${text.substring(0, 200)}`);
  }
}

/**
 * Analysis Reco Prompt
 * Generates recommendations from a JSON "facts" object (output of the python execution).
 */
export async function generateRecommendationsFromFacts(input: AnalysisRecoFromFactsInput): Promise<{
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

  // Try to get prompt from DB, fallback to provided prompt
  let promptTemplate: string | null = null;
  if (input.useDbPrompt !== false && input.tenantId !== undefined) {
    promptTemplate = await getPromptFromDB(input.tenantId, 'stock', 'analysis_reco');
  }

  const defaultPrompt = `
Tu es un expert en analyse logistique et gestion de stock.
Tu ne dois PAS recalculer à partir des lignes brutes. Tu dois uniquement te baser sur les FACTS JSON ci-dessous (sortie d'un script Python exécuté).

FACTS:
{facts}

{analysisMetadata}

OBJECTIF (prompt utilisateur):
{prompt}

Réponds UNIQUEMENT avec un JSON valide de cette structure:
{
  "recommendations": [
    {
      "type": "dormant|slow-moving|overstock|understock|obsolete|high-value|low-rotation|other",
      "priority": "low|medium|high|critical",
      "title": "Titre",
      "description": "Description",
      "actionItems": [{"title":"string","description":"string","priority":"low|medium|high"}],
      "affectedSkus": ["string"],
      "estimatedImpact": {"financialImpact": number, "currency": "string", "potentialSavings": number, "riskLevel": "low|medium|high", "timeframe":"string"},
      "pythonCode": "Rappelle le python (ou un extrait) qui justifie les facts utilisés"
    }
  ]
}
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
