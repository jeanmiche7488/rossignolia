/**
 * Script pour tester uniquement la validité de la clé API Gemini
 * Usage: node scripts/test-gemini-api-key.js
 */

const fs = require('fs');
const path = require('path');

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

console.log("🔍 Diagnostic de la clé API Gemini\n");
console.log("📋 Informations sur la clé:");
console.log(`   Longueur: ${apiKey.length} caractères`);
console.log(`   Préfixe: ${apiKey.substring(0, 10)}...`);
console.log(`   Format: ${apiKey.startsWith('AIza') ? '✅ Format correct (commence par AIza)' : '⚠️  Format inhabituel'}\n`);

// Test avec une requête HTTP directe pour voir l'erreur exacte
console.log("🧪 Test de connexion directe à l'API Gemini...\n");

const https = require('https');

const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;

const postData = JSON.stringify({
  contents: [{
    parts: [{
      text: "Test"
    }]
  }],
  generationConfig: {
    maxOutputTokens: 10
  }
});

const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': postData.length
  }
};

const req = https.request(testUrl, options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log("✅ Clé API valide ! L'API répond correctement.\n");
      console.log("💡 Le problème vient peut-être des noms de modèles.");
      console.log("   Essayez de modifier lib/ai/gemini.ts avec un autre nom de modèle.\n");
    } else {
      console.log(`❌ Erreur HTTP ${res.statusCode}`);
      try {
        const errorData = JSON.parse(data);
        console.log("   Message:", errorData.error?.message || data);
        console.log("   Détails:", JSON.stringify(errorData, null, 2));
      } catch (e) {
        console.log("   Réponse:", data);
      }
      
      if (res.statusCode === 404) {
        console.log("\n💡 Erreur 404: Le modèle 'gemini-pro' n'est peut-être pas disponible.");
        console.log("   Essayez d'autres noms de modèles dans lib/ai/gemini.ts");
      } else if (res.statusCode === 403) {
        console.log("\n💡 Erreur 403: Vérifiez que votre clé API est valide sur:");
        console.log("   https://aistudio.google.com/app/apikey");
      } else if (res.statusCode === 401) {
        console.log("\n💡 Erreur 401: Clé API invalide ou expirée.");
        console.log("   Régénérez une nouvelle clé sur https://aistudio.google.com/app/apikey");
      }
    }
  });
});

req.on('error', (error) => {
  console.log("❌ Erreur de connexion:", error.message);
});

req.write(postData);
req.end();
