/**
 * Script simple pour tester Gemini (sans dépendances supplémentaires)
 * Usage: node scripts/test-gemini-simple.js
 */

const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Lire .env.local manuellement (sans dotenv)
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('❌ Fichier .env.local non trouvé');
    process.exit(1);
  }
  
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const envVars = {};
  
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
      }
    }
  });
  
  return envVars;
}

const env = loadEnv();

async function testGemini() {
  const apiKey = env.GOOGLE_GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
  
  if (!apiKey) {
    console.error("❌ GOOGLE_GEMINI_API_KEY n'est pas défini dans .env.local");
    process.exit(1);
  }

  console.log("🔑 Clé API trouvée (longueur:", apiKey.length, "caractères)");
  console.log("📋 Test de connexion à l'API Gemini...\n");

  // Test 1: Vérifier que la clé API est valide en listant les modèles
  try {
    console.log("🔍 Test 1: Vérification de la clé API...");
    const client = new GoogleGenerativeAI(apiKey);
    
    // Essayer de lister les modèles disponibles (si l'API le permet)
    console.log("   ✅ Client Gemini créé avec succès\n");
  } catch (error) {
    console.log("   ❌ Erreur lors de la création du client:", error.message);
    return;
  }

  const client = new GoogleGenerativeAI(apiKey);
  
  console.log("📋 Test des modèles Gemini...\n");
  
  // Liste des modèles à tester (par ordre de priorité)
  // Essayons différentes variantes de noms de modèles
  const modelsToTest = [
    "gemini-1.5-flash",
    "gemini-1.5-flash-latest",
    "gemini-pro",
    "gemini-1.5-pro",
    "gemini-1.5-pro-latest",
    "gemini-1.0-pro",
    "models/gemini-1.5-flash",
    "models/gemini-pro",
  ];

  for (const modelName of modelsToTest) {
    try {
      console.log(`🧪 Test de ${modelName}...`);
      const model = client.getGenerativeModel({ model: modelName });
      
      // Test simple
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: "Test" }] }],
        generationConfig: { maxOutputTokens: 10 },
      });

      if (result.response) {
        console.log(`✅ ${modelName} - DISPONIBLE ET FONCTIONNEL\n`);
        console.log("💡 Utilisez ce modèle dans lib/ai/gemini.ts ligne 26");
        console.log(`   return client.getGenerativeModel({ model: "${modelName}" });\n`);
        return; // On s'arrête au premier qui fonctionne
      }
    } catch (error) {
      const errorMessage = error.message || String(error);
      const errorCode = error.status || error.code || '';
      
      if (errorMessage.includes('404') || errorCode === 404) {
        console.log(`❌ ${modelName} - NON DISPONIBLE (404)\n`);
      } else if (errorMessage.includes('403') || errorCode === 403) {
        console.log(`❌ ${modelName} - ACCÈS REFUSÉ (403) - Vérifiez votre clé API\n`);
        console.log(`   Détails: ${errorMessage.substring(0, 150)}\n`);
      } else if (errorMessage.includes('401') || errorCode === 401) {
        console.log(`❌ ${modelName} - NON AUTORISÉ (401) - Clé API invalide\n`);
        console.log(`   Détails: ${errorMessage.substring(0, 150)}\n`);
      } else {
        console.log(`❌ ${modelName} - ERREUR: ${errorMessage.substring(0, 150)}...\n`);
        // Afficher plus de détails pour le premier modèle pour debug
        if (modelName === modelsToTest[0]) {
          console.log(`   Code d'erreur: ${errorCode}`);
          console.log(`   Message complet: ${errorMessage}\n`);
        }
      }
    }
  }

  console.log("\n⚠️  Aucun modèle n'a fonctionné. Vérifiez:");
  console.log("   1. Votre clé API est valide sur https://aistudio.google.com/app/apikey");
  console.log("   2. Votre compte a accès à l'API Gemini");
  console.log("   3. Votre région permet l'accès à Gemini");
}

testGemini().catch(console.error);
