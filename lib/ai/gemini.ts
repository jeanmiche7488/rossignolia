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
 * Get the Gemini model (1.5 Pro)
 */
const getModel = () => {
  const client = getGeminiClient();
  return client.getGenerativeModel({ model: "gemini-1.5-pro" });
};

/**
 * Configuration déterministe pour mapping et cleaning
 * Selon les règles du projet : temperature: 0.0, topK: 1
 */
const DETERMINISTIC_CONFIG = {
  temperature: 0.0,
  topK: 1,
  topP: 1,
  maxOutputTokens: 8192,
};

/**
 * Configuration pour advisor (peut être moins stricte)
 */
const ADVISOR_CONFIG = {
  temperature: 0.3,
  topK: 40,
  topP: 0.95,
  maxOutputTokens: 8192,
};

/**
 * Types for prompt operations
 */
export type PromptType = "mapping" | "cleaning" | "advisor";

export interface MappingInput {
  columns: string[];
  sampleData?: Record<string, unknown>[];
  context?: string;
}

export interface CleaningInput {
  data: Record<string, unknown>[];
  mappedColumns: Record<string, string>;
  issues?: string[];
}

export interface AdvisorInput {
  stockEntries: Record<string, unknown>[];
  analysisMetadata?: Record<string, unknown>;
}

/**
 * Mapping Prompt
 * Maps CSV/Excel columns to our schema fields
 */
export async function mapColumns(input: MappingInput): Promise<{
  mappedColumns: Record<string, string>;
  confidence: number;
  reasoning: string;
}> {
  const model = getModel();

  const prompt = `
Tu es un expert en mapping de données logistiques. 
Analyse les colonnes suivantes et mappe-les vers notre schéma de stock.

Colonnes à mapper: ${input.columns.join(", ")}

${input.sampleData ? `Données d'exemple (premières lignes):\n${JSON.stringify(input.sampleData.slice(0, 3), null, 2)}` : ""}

${input.context ? `Contexte: ${input.context}` : ""}

Schéma cible:
- sku: Code SKU/Article
- product_name: Nom du produit
- quantity: Quantité en stock
- unit_cost: Coût unitaire
- total_value: Valeur totale
- location: Emplacement/Entrepôt
- category: Catégorie
- supplier: Fournisseur
- last_movement_date: Date du dernier mouvement
- days_since_last_movement: Jours depuis dernier mouvement

Réponds UNIQUEMENT avec un JSON valide de cette structure:
{
  "mappedColumns": {
    "colonne_source": "champ_cible"
  },
  "confidence": 0.95,
  "reasoning": "Explication du mapping"
}

IMPORTANT: 
- Utilise UNIQUEMENT les champs listés ci-dessus
- Si une colonne ne correspond à aucun champ, ne l'inclus pas dans mappedColumns
- Les colonnes non mappées seront préservées dans le champ "attributes"
- Le JSON doit être valide et parsable
`;

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      ...DETERMINISTIC_CONFIG,
      responseMimeType: "application/json",
    },
  });

  const response = result.response;
  const text = response.text();
  
  try {
    const parsed = JSON.parse(text);
    return {
      mappedColumns: parsed.mappedColumns || {},
      confidence: parsed.confidence || 0.5,
      reasoning: parsed.reasoning || "",
    };
  } catch (error) {
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

  const prompt = `
Tu es un expert en nettoyage de données logistiques.
Nettoie et normalise les données suivantes selon le mapping fourni.

Données à nettoyer (${input.data.length} lignes):
${JSON.stringify(input.data.slice(0, 10), null, 2)}
${input.data.length > 10 ? `... (${input.data.length - 10} lignes supplémentaires)` : ""}

Mapping:
${JSON.stringify(input.mappedColumns, null, 2)}

${input.issues ? `Problèmes identifiés:\n${input.issues.join("\n")}` : ""}

Règles de nettoyage:
1. Normaliser les formats de dates (ISO 8601: YYYY-MM-DD)
2. Convertir les nombres (quantité, coûts) en format numérique
3. Nettoyer les chaînes (trim, normaliser les espaces)
4. Valider les SKUs (format cohérent)
5. Calculer les valeurs manquantes si possible (total_value = quantity * unit_cost)
6. Préserver toutes les colonnes non mappées dans "attributes"

Réponds UNIQUEMENT avec un JSON valide de cette structure:
{
  "cleanedData": [
    {
      "sku": "...",
      "product_name": "...",
      "quantity": 123,
      "unit_cost": 45.67,
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
- Le pythonCode doit être du code Python valide et exécutable
`;

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      ...DETERMINISTIC_CONFIG,
      responseMimeType: "application/json",
    },
  });

  const response = result.response;
  const text = response.text();
  
  try {
    const parsed = JSON.parse(text);
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
    throw new Error(`Failed to parse Gemini cleaning response: ${error}`);
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

  const prompt = `
Tu es un expert en analyse logistique et gestion de stock.
Analyse les données de stock suivantes et génère des recommandations actionnables.

Données de stock (${input.stockEntries.length} entrées):
${JSON.stringify(input.stockEntries.slice(0, 20), null, 2)}
${input.stockEntries.length > 20 ? `... (${input.stockEntries.length - 20} entrées supplémentaires)` : ""}

${input.analysisMetadata ? `Métadonnées de l'analyse:\n${JSON.stringify(input.analysisMetadata, null, 2)}` : ""}

Types de recommandations possibles:
- dormant: Stock dormant (pas de mouvement depuis longtemps)
- slow-moving: Rotation lente
- overstock: Surstockage
- understock: Sous-stockage
- obsolete: Stock obsolète
- high-value: Stock à haute valeur
- low-rotation: Faible rotation

Pour chaque recommandation, fournis:
1. Un titre clair et actionnable
2. Une description détaillée
3. Des actions concrètes à entreprendre
4. Les SKUs concernés
5. L'impact financier estimé
6. Le code Python qui justifie l'analyse (White Box)

Réponds UNIQUEMENT avec un JSON valide de cette structure:
{
  "recommendations": [
    {
      "type": "dormant",
      "priority": "high",
      "title": "Titre de la recommandation",
      "description": "Description détaillée",
      "actionItems": [
        {
          "title": "Action 1",
          "description": "Description de l'action",
          "priority": "high"
        }
      ],
      "affectedSkus": ["SKU1", "SKU2"],
      "estimatedImpact": {
        "financialImpact": 10000,
        "currency": "EUR",
        "potentialSavings": 5000,
        "riskLevel": "medium",
        "timeframe": "3 mois"
      },
      "pythonCode": "Code Python qui justifie la recommandation"
    }
  ]
}

IMPORTANT:
- Le JSON doit être valide et parsable
- Le pythonCode doit être du code Python valide et exécutable
- Priorise les recommandations par impact (critical > high > medium > low)
- Sois concret et actionnable
`;

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      ...ADVISOR_CONFIG,
      responseMimeType: "application/json",
    },
  });

  const response = result.response;
  const text = response.text();
  
  try {
    const parsed = JSON.parse(text);
    return {
      recommendations: parsed.recommendations || [],
    };
  } catch (error) {
    throw new Error(`Failed to parse Gemini advisor response: ${error}`);
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
): Promise<string> {
  // This will be implemented when we have the DB connection
  // For now, return empty string (will use inline prompts)
  return "";
}
