/**
 * Script pour tester les modèles Gemini disponibles
 * Usage: npx tsx scripts/test-gemini-models.ts
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

async function testGeminiModels() {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  
  if (!apiKey) {
    console.error("❌ GOOGLE_GEMINI_API_KEY n'est pas défini dans .env.local");
    process.exit(1);
  }

  console.log("🔑 Clé API trouvée (longueur:", apiKey.length, "caractères)");
  console.log("📋 Test des modèles Gemini disponibles...\n");

  const client = new GoogleGenerativeAI(apiKey);
  
  // Liste des modèles à tester
  const modelsToTest = [
    "gemini-1.5-flash",
    "gemini-1.5-pro",
    "gemini-1.5-pro-latest",
    "gemini-pro",
    "gemini-1.0-pro",
  ];

  const availableModels: string[] = [];
  const unavailableModels: string[] = [];

  for (const modelName of modelsToTest) {
    try {
      console.log(`🧪 Test de ${modelName}...`);
      const model = client.getGenerativeModel({ model: modelName });
      
      // Test simple avec un prompt minimal
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: "Test" }] }],
        generationConfig: {
          maxOutputTokens: 10,
        },
      });

      if (result.response) {
        console.log(`✅ ${modelName} - DISPONIBLE\n`);
        availableModels.push(modelName);
      }
    } catch (error: any) {
      const errorMessage = error.message || String(error);
      console.log(`❌ ${modelName} - NON DISPONIBLE`);
      console.log(`   Erreur: ${errorMessage.substring(0, 100)}...\n`);
      unavailableModels.push(modelName);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("📊 RÉSUMÉ");
  console.log("=".repeat(60));
  console.log(`✅ Modèles disponibles (${availableModels.length}):`);
  availableModels.forEach((model) => console.log(`   - ${model}`));
  
  if (unavailableModels.length > 0) {
    console.log(`\n❌ Modèles non disponibles (${unavailableModels.length}):`);
    unavailableModels.forEach((model) => console.log(`   - ${model}`));
  }

  console.log("\n💡 Recommandation:");
  if (availableModels.length > 0) {
    console.log(`   Utilisez: ${availableModels[0]}`);
    console.log(`   (Modifiez lib/ai/gemini.ts ligne 25)`);
  } else {
    console.log("   ⚠️  Aucun modèle disponible. Vérifiez:");
    console.log("   1. Votre clé API Gemini est valide");
    console.log("   2. Votre compte a accès à l'API Gemini");
    console.log("   3. Votre région/zone permet l'accès à Gemini");
  }
}

testGeminiModels().catch(console.error);
