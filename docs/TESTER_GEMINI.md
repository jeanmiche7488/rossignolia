# Comment tester votre configuration Gemini

## Méthode 1 : Script de test (Recommandé)

### Étape 1 : Ouvrir un terminal

Ouvrez un terminal dans le dossier du projet (`C:\Users\pierr\Documents\Cursor\Logi`)

### Étape 2 : Exécuter le script

```bash
node scripts/test-gemini-simple.js
```

### Résultat attendu

Le script va :
1. ✅ Charger votre clé API depuis `.env.local`
2. ✅ Tester les modèles disponibles (`gemini-1.5-flash`, `gemini-pro`, etc.)
3. ✅ Vous indiquer quel modèle fonctionne

**Exemple de sortie réussie :**
```
🔑 Clé API trouvée
📋 Test des modèles Gemini...

🧪 Test de gemini-1.5-flash...
✅ gemini-1.5-flash - DISPONIBLE ET FONCTIONNEL

💡 Utilisez ce modèle dans lib/ai/gemini.ts ligne 26
   return client.getGenerativeModel({ model: "gemini-1.5-flash" });
```

## Méthode 2 : Test manuel dans le code

Si le script ne fonctionne pas, vous pouvez tester directement dans votre application :

1. **Redémarrez votre serveur Next.js** (si il tourne)
2. **Essayez de créer une analyse** avec vos fichiers CSV
3. **Regardez les logs** dans le terminal pour voir l'erreur exacte

## Dépannage

### Erreur : "Cannot find module '@google/generative-ai'"

**Solution :** Installez les dépendances
```bash
npm install
```

### Erreur : "Fichier .env.local non trouvé"

**Solution :** Vérifiez que le fichier `.env.local` existe à la racine du projet avec :
```
GOOGLE_GEMINI_API_KEY=votre_cle_ici
```

### Erreur : "API key not valid" (403)

**Solution :**
1. Vérifiez votre clé sur [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Régénérez une nouvelle clé si nécessaire
3. Mettez à jour `.env.local`
4. Redémarrez le serveur

### Erreur : "model not found" (404)

**Solution :**
1. Le script vous indiquera quel modèle fonctionne
2. Modifiez `lib/ai/gemini.ts` ligne 26 avec le modèle qui fonctionne
3. Redémarrez le serveur

## Commandes utiles

```bash
# Tester Gemini
node scripts/test-gemini-simple.js

# Vérifier que Node.js est installé
node --version

# Vérifier que les dépendances sont installées
npm list @google/generative-ai
```

## Prochaines étapes

Une fois que vous savez quel modèle fonctionne :
1. Modifiez `lib/ai/gemini.ts` si nécessaire
2. Redémarrez le serveur Next.js
3. Réessayez de créer une analyse
