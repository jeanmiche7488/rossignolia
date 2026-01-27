/**
 * Script pour lister les modèles Gemini disponibles
 * Usage: node scripts/list-gemini-models.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Lire .env.local
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
const apiKey = env.GOOGLE_GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;

if (!apiKey) {
  console.error("❌ GOOGLE_GEMINI_API_KEY n'est pas défini dans .env.local");
  process.exit(1);
}

console.log("🔍 Liste des modèles Gemini disponibles pour votre compte...\n");

// Appel à l'API pour lister les modèles
const listModelsUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

const options = {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
};

const req = https.request(listModelsUrl, options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    if (res.statusCode === 200) {
      try {
        const response = JSON.parse(data);
        const models = response.models || [];
        
        if (models.length === 0) {
          console.log("⚠️  Aucun modèle trouvé dans la réponse.");
          console.log("Réponse complète:", JSON.stringify(response, null, 2));
          return;
        }
        
        console.log(`✅ ${models.length} modèle(s) disponible(s):\n`);
        
        // Filtrer les modèles qui supportent generateContent
        const usableModels = models.filter(model => {
          const supportedMethods = model.supportedGenerationMethods || [];
          return supportedMethods.includes('generateContent');
        });
        
        if (usableModels.length > 0) {
          console.log("📋 Modèles utilisables (supportent generateContent):\n");
          usableModels.forEach((model, index) => {
            const name = model.name.replace('models/', '');
            console.log(`${index + 1}. ${name}`);
            console.log(`   Description: ${model.displayName || 'N/A'}`);
            console.log(`   Description: ${model.description || 'N/A'}`);
            console.log(`   Méthodes supportées: ${(model.supportedGenerationMethods || []).join(', ')}`);
            console.log('');
          });
          
          // Recommandation
          const recommendedModel = usableModels[0];
          const recommendedName = recommendedModel.name.replace('models/', '');
          console.log("💡 RECOMMANDATION:");
          console.log(`   Utilisez: ${recommendedName}`);
          console.log(`   Modifiez lib/ai/gemini.ts ligne 26:`);
          console.log(`   return client.getGenerativeModel({ model: "${recommendedName}" });\n`);
        } else {
          console.log("⚠️  Aucun modèle ne supporte 'generateContent'.");
          console.log("\nModèles trouvés:");
          models.forEach((model, index) => {
            console.log(`${index + 1}. ${model.name}`);
            console.log(`   Méthodes: ${(model.supportedGenerationMethods || []).join(', ')}`);
          });
        }
        
        // Afficher aussi les modèles non utilisables pour info
        const nonUsableModels = models.filter(model => {
          const supportedMethods = model.supportedGenerationMethods || [];
          return !supportedMethods.includes('generateContent');
        });
        
        if (nonUsableModels.length > 0) {
          console.log(`\n⚠️  ${nonUsableModels.length} modèle(s) ne supportent pas generateContent:`);
          nonUsableModels.forEach(model => {
            console.log(`   - ${model.name.replace('models/', '')}`);
          });
        }
        
      } catch (error) {
        console.log("❌ Erreur lors du parsing de la réponse:", error.message);
        console.log("Réponse brute:", data);
      }
    } else {
      console.log(`❌ Erreur HTTP ${res.statusCode}`);
      try {
        const errorData = JSON.parse(data);
        console.log("Message:", errorData.error?.message || data);
        console.log("Détails:", JSON.stringify(errorData, null, 2));
        
        if (res.statusCode === 403) {
          console.log("\n💡 Erreur 403: Vérifiez que votre clé API a les permissions nécessaires.");
          console.log("   Allez sur https://aistudio.google.com/app/apikey");
        } else if (res.statusCode === 401) {
          console.log("\n💡 Erreur 401: Clé API invalide.");
          console.log("   Régénérez une nouvelle clé sur https://aistudio.google.com/app/apikey");
        }
      } catch (e) {
        console.log("Réponse:", data);
      }
    }
  });
});

req.on('error', (error) => {
  console.log("❌ Erreur de connexion:", error.message);
});

req.end();
