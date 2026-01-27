# Configuration du Use Case Stock Health

## 📋 Prérequis

### 1. Installer la dépendance xlsx

Pour parser les fichiers Excel, vous devez installer le package `xlsx` :

```bash
npm install xlsx
npm install --save-dev @types/xlsx
```

### 2. Configurer Supabase Storage

#### Créer le bucket

1. Allez dans **Supabase Dashboard** → **Storage**
2. Cliquez sur **"New bucket"**
3. Configurez le bucket :
   - **Name**: `analysis-files`
   - **Public**: `false` (privé)
   - **File size limit**: `10485760` (10MB)
   - **Allowed MIME types**: 
     - `text/csv`
     - `application/vnd.ms-excel`
     - `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

#### Configurer les politiques RLS

Exécutez la migration SQL `010_create_storage_bucket.sql` qui configure les politiques RLS pour le storage.

Ou configurez manuellement dans **Storage** → **Policies** :

**Policy 1: Upload**
- Name: "Users can upload files to their tenant folder"
- Operation: INSERT
- Target roles: authenticated
- Policy: `bucket_id = 'analysis-files' AND (storage.foldername(name))[1] = (SELECT tenant_id::text FROM profiles WHERE id = auth.uid())`

**Policy 2: Read**
- Name: "Users can read files from their tenant folder"
- Operation: SELECT
- Target roles: authenticated
- Policy: `bucket_id = 'analysis-files' AND (storage.foldername(name))[1] = (SELECT tenant_id::text FROM profiles WHERE id = auth.uid())`

**Policy 3: Delete**
- Name: "Users can delete files from their tenant folder"
- Operation: DELETE
- Target roles: authenticated
- Policy: `bucket_id = 'analysis-files' AND (storage.foldername(name))[1] = (SELECT tenant_id::text FROM profiles WHERE id = auth.uid())`

## 🔄 Flow d'Analyse Stock Health

### 1. Upload de Fichier
- **Route**: `/api/upload`
- **Méthode**: POST
- **Action**: 
  - Reçoit le fichier via FormData
  - Upload vers Supabase Storage (`analysis-files/{tenant_id}/{analysis_id}/{filename}`)
  - Met à jour l'analyse avec le chemin du fichier

### 2. Phase Mapping
- **Route**: `/api/analyze/map`
- **Méthode**: POST
- **Action**:
  - Télécharge le fichier depuis Storage
  - Parse le fichier (CSV ou Excel)
  - Appelle Gemini `mapColumns()` pour mapper les colonnes
  - Sauvegarde `original_columns` et `mapped_columns` dans l'analyse
  - Déclenche automatiquement la phase Cleaning

### 3. Phase Cleaning
- **Route**: `/api/analyze/clean`
- **Méthode**: POST
- **Action**:
  - Télécharge le fichier depuis Storage
  - Parse le fichier
  - Appelle Gemini `cleanData()` pour nettoyer les données
  - Insère les données nettoyées dans `stock_entries`
  - Sauvegarde le rapport de nettoyage
  - Déclenche automatiquement la phase Recommendations

### 4. Phase Recommendations
- **Route**: `/api/analyze/recommend`
- **Méthode**: POST
- **Action**:
  - Récupère les `stock_entries` de l'analyse
  - Appelle Gemini `generateRecommendations()` pour générer les recommandations
  - Insère les recommandations dans la DB
  - Met à jour le statut de l'analyse à `completed`

### 5. Affichage des Résultats
- **Page**: `/stock/[id]`
- **Contenu**:
  - Statistiques du stock (valeur totale, quantité, produits uniques)
  - KPIs (Gain potentiel, Économie potentielle)
  - Liste des entrées de stock
  - Recommandations avec impact estimé, actions, SKUs concernés

## 📝 Notes Techniques

- Les phases sont déclenchées de manière séquentielle via des appels `fetch()` asynchrones
- Pour la production, considérez utiliser un système de queue (BullMQ, Inngest, etc.)
- Les fichiers sont stockés dans Supabase Storage avec isolation par tenant
- Le parsing CSV est basique (split par virgule) - pour des CSV complexes, utilisez une bibliothèque dédiée
- Les fichiers Excel nécessitent le package `xlsx`

## 🐛 Dépannage

### Erreur "xlsx is not defined"
- Installez le package : `npm install xlsx`

### Erreur "Bucket not found"
- Créez le bucket `analysis-files` dans Supabase Dashboard → Storage

### Erreur "Permission denied" lors de l'upload
- Vérifiez les politiques RLS du bucket Storage
- Vérifiez que `SUPABASE_SERVICE_ROLE_KEY` est correctement configuré

### L'analyse reste en "processing"
- Vérifiez les logs du serveur pour voir quelle phase a échoué
- Vérifiez que les routes API sont accessibles
- Vérifiez que `GOOGLE_GEMINI_API_KEY` est configuré
