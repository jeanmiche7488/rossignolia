# Configuration Gemini API

## Vérification de la configuration

### 1. Vérifier votre clé API

Votre clé API doit être dans `.env.local` :
```env
GOOGLE_GEMINI_API_KEY=votre_cle_api_ici
```

**Où trouver votre clé API :**
1. Allez sur [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Connectez-vous avec votre compte Google
3. Cliquez sur "Create API Key" ou utilisez une clé existante
4. Copiez la clé et ajoutez-la dans `.env.local`

### 2. Tester les modèles disponibles

Exécutez le script de test pour voir quels modèles sont disponibles :

```bash
npx tsx scripts/test-gemini-models.ts
```

Ce script va tester plusieurs modèles :
- `gemini-1.5-flash` (recommandé - rapide et disponible)
- `gemini-1.5-pro` (plus puissant mais peut ne pas être disponible partout)
- `gemini-pro` (ancien modèle, généralement disponible)
- `gemini-1.5-pro-latest` (dernière version)

### 3. Changer le modèle utilisé

Si un modèle n'est pas disponible, modifiez `lib/ai/gemini.ts` :

```typescript
const getModel = () => {
  const client = getGeminiClient();
  // Changez le nom du modèle ici
  return client.getGenerativeModel({ model: "gemini-1.5-flash" });
};
```

**Modèles recommandés par ordre de priorité :**
1. `gemini-1.5-flash` - Rapide, disponible, bon pour le mapping/cleaning
2. `gemini-pro` - Ancien mais stable, toujours disponible
3. `gemini-1.5-pro` - Plus puissant mais peut nécessiter un accès spécial

### 4. Problèmes courants

#### Erreur 404 : "model not found"
**Cause :** Le modèle n'est pas disponible pour votre région/compte

**Solution :**
- Utilisez `gemini-1.5-flash` ou `gemini-pro` (plus largement disponibles)
- Vérifiez que votre compte Google a accès à l'API Gemini
- Certains modèles nécessitent un accès payant ou une whitelist

#### Erreur 403 : "API key not valid"
**Cause :** Clé API invalide ou expirée

**Solution :**
- Vérifiez que la clé est correcte dans `.env.local`
- Régénérez une nouvelle clé sur [Google AI Studio](https://aistudio.google.com/app/apikey)
- Redémarrez le serveur Next.js après modification de `.env.local`

#### Erreur 429 : "Rate limit exceeded"
**Cause :** Trop de requêtes

**Solution :**
- Attendez quelques minutes
- Vérifiez les limites de votre compte sur Google AI Studio
- Considérez un upgrade de votre plan si nécessaire

### 5. Vérifier les quotas et limites

1. Allez sur [Google AI Studio](https://aistudio.google.com/)
2. Cliquez sur votre profil → "API Keys"
3. Vérifiez les quotas et limites de votre compte

**Limites par défaut (gratuit) :**
- 15 requêtes par minute (RPM)
- 1 million de tokens par minute (TPM)

### 6. Configuration recommandée

Pour le projet Rossignolia, nous recommandons :

```typescript
// lib/ai/gemini.ts
const getModel = () => {
  const client = getGeminiClient();
  return client.getGenerativeModel({ model: "gemini-1.5-flash" });
};
```

**Pourquoi gemini-1.5-flash ?**
- ✅ Disponible dans toutes les régions
- ✅ Rapide (idéal pour le mapping/cleaning)
- ✅ Gratuit avec quotas généreux
- ✅ Bonne qualité pour les tâches structurées

### 7. Test rapide

Pour tester rapidement si votre configuration fonctionne :

```bash
# Dans le terminal, depuis la racine du projet
node -e "
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: '.env.local' });
const client = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
const model = client.getGenerativeModel({ model: 'gemini-1.5-flash' });
model.generateContent('Test').then(r => console.log('✅ OK')).catch(e => console.log('❌ Erreur:', e.message));
"
```

## Support

Si vous continuez à avoir des problèmes :
1. Vérifiez les logs du serveur Next.js
2. Exécutez le script de test : `npx tsx scripts/test-gemini-models.ts`
3. Vérifiez votre compte sur [Google AI Studio](https://aistudio.google.com/)
