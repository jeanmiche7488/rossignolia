# Flow d'analyse Stock Health - Documentation complète

## Vue d'ensemble

Le flow d'analyse Stock Health suit ces étapes :
1. **Upload multi-fichiers** → Agrégation des données
2. **Mapping automatique** (Gemini) → Si confiance < 0.8, demande confirmation utilisateur
3. **Validation utilisateur** → Confirmation/modification du mapping
4. **Génération stock_entries** → Données nettoyées et normalisées
5. **Nettoyage** (Gemini) → Normalisation des données
6. **Analyse/Recommandations** (Gemini) → Génération des recommandations

## Architecture des données

### Table `analysis_files`
Stocke les métadonnées de chaque fichier uploadé :
- `id`, `analysis_id`, `tenant_id`
- `file_name`, `file_type`, `file_path` (dans Supabase Storage)
- `source_type`, `description` (saisis par l'utilisateur)
- `original_columns` (JSONB), `row_count`

### Table `analyses`
Stocke l'analyse globale :
- `original_columns` : toutes les colonnes trouvées (agrégées)
- `mapped_columns` : mapping proposé par Gemini (puis confirmé par l'utilisateur)
- `status` : `pending` → `mapping_pending` → `processing` → `completed`
- `metadata.files` : liste des fichiers avec leurs métadonnées
- `metadata.mapping.confidence` : niveau de confiance du mapping (0-1)
- `metadata.mapping.requires_confirmation` : booléen

### Table `stock_entries`
Données nettoyées et normalisées après validation du mapping :
- Champs mappés : `sku`, `product_name`, `quantity`, `unit_cost`, etc.
- `attributes` (JSONB) : colonnes non mappées préservées

### Table `recommendations`
Recommandations générées par Gemini après analyse des `stock_entries`

## Flow détaillé

### 1. Upload (`/api/upload`)

**Input** : Fichier CSV/Excel + `analysisId` + `sourceType` + `description`

**Actions** :
- Upload vers Supabase Storage : `analysis-files/{tenant_id}/{analysis_id}/{filename}`
- Parse header CSV pour extraire `original_columns`
- Insert dans `analysis_files` avec toutes les métadonnées

**Output** : `fileId` de l'enregistrement créé

### 2. Démarrage (`/api/analyze/start`)

**Input** : `analysisId`

**Actions** :
- Vérifie que l'analyse existe
- Déclenche `/api/analyze/map` de manière asynchrone (via `fetch`)

**Output** : `{ success: true, requiresMappingConfirmation: true }`

### 3. Mapping (`/api/analyze/map`)

**Input** : `analysisId` (appel interne depuis `/api/analyze/start`)

**Actions** :
1. Récupère **tous** les fichiers depuis `analysis_files` pour cet `analysisId`
2. Pour chaque fichier :
   - Télécharge depuis Storage
   - Parse (CSV ou Excel avec `xlsx`)
   - Agrège dans `allRawData` avec métadonnées `_source_file` et `_source_type`
3. Combine toutes les colonnes uniques dans `allColumns`
4. Appelle Gemini `mapColumns()` avec :
   - Colonnes agrégées
   - Échantillon de données (5 premières lignes)
   - Contexte sur les fichiers sources
   - Prompt depuis `system_prompts` (type: 'mapping')
5. Détermine si confirmation nécessaire (`confidence < 0.8`)
6. Met à jour `analyses` :
   - `original_columns` : toutes les colonnes trouvées
   - `mapped_columns` : mapping proposé
   - `status` : `mapping_pending` si besoin de confirmation, sinon `processing`
   - `metadata.mapping` : confidence, reasoning, proposed_mapping
7. Si confiance élevée (≥ 0.8) : déclenche automatiquement `/api/analyze/clean`
8. Si confiance faible (< 0.8) : attend confirmation utilisateur

**Output** : `{ success: true, requiresConfirmation: boolean }`

### 4. Confirmation utilisateur (`/stock/[id]/mapping`)

**Page client** qui :
- Charge l'analyse avec `mapped_columns` proposé
- Affiche toutes les colonnes sources avec dropdown pour mapper vers champs cibles
- Valide que les champs requis (SKU, quantity) sont mappés
- Permet modification du mapping proposé
- Au clic sur "Confirmer" :
  - Met à jour `analyses.mapped_columns` avec le mapping confirmé
  - Met `status` à `processing`
  - Déclenche `/api/analyze/clean`

### 5. Nettoyage (`/api/analyze/clean`)

**Input** : `analysisId` (appel interne depuis `/api/analyze/map` ou depuis page mapping)

**Actions** :
1. Récupère `mapped_columns` depuis `analyses`
2. Récupère **tous** les fichiers depuis `analysis_files`
3. Agrège à nouveau tous les fichiers (même logique que mapping)
4. Appelle Gemini `cleanData()` avec :
   - Données agrégées
   - `mapped_columns` confirmés
   - Prompt depuis `system_prompts` (type: 'cleaning')
5. Insère les données nettoyées dans `stock_entries` (par batch de 1000)
6. Met à jour `analyses.metadata.cleaning` avec le rapport
7. Déclenche `/api/analyze/recommend`

**Output** : `{ success: true }`

### 6. Recommandations (`/api/analyze/recommend`)

**Input** : `analysisId` (appel interne depuis `/api/analyze/clean`)

**Actions** :
1. Récupère toutes les `stock_entries` pour cette analyse
2. Appelle Gemini `generateRecommendations()` avec :
   - Toutes les entrées de stock
   - Métadonnées de l'analyse
   - Prompt depuis `system_prompts` (type: 'advisor')
3. Insère les recommandations dans `recommendations`
4. Met `analyses.status` à `completed`

**Output** : `{ success: true }`

## Points importants

### Agrégation multi-fichiers
- Tous les fichiers sont téléchargés et parsés
- Les données sont agrégées dans un seul tableau `allRawData`
- Chaque ligne garde `_source_file` et `_source_type` pour traçabilité
- Les colonnes sont combinées (union de toutes les colonnes uniques)

### Mapping avec Gemini
- Utilise le prompt depuis `system_prompts` (tenant-specific ou global)
- Placeholders remplacés : `{columns}`, `{sampleData}`, `{context}`
- Retourne `confidence` (0-1) pour décider si confirmation nécessaire
- Si `confidence < 0.8` : toujours demander confirmation utilisateur

### Validation utilisateur
- L'utilisateur peut modifier le mapping proposé
- Validation que les champs requis sont mappés (SKU, quantity)
- Une fois confirmé, le mapping est définitif et utilisé pour le nettoyage

### Génération stock_entries
- Se fait **après** validation du mapping
- Utilise les `mapped_columns` confirmés
- Les colonnes non mappées sont préservées dans `attributes` (JSONB)

### Prompts système
- Stockés dans `system_prompts`
- Priorité : tenant-specific > global (tenant_id = NULL)
- Éditables via `/admin/prompts`
- Versioning automatique lors de modification

## Problèmes courants

### Table `analysis_files` manquante
**Symptôme** : `Could not find the table 'public.analysis_files'`

**Solution** : Exécuter la migration `011_add_analysis_files.sql` dans Supabase SQL Editor

### Erreur 401 sur `/api/analyze/map`
**Symptôme** : `Non authentifié` lors de l'appel interne

**Solution** : Les routes acceptent maintenant les appels internes via header `X-Internal-Call: true`

### Package `xlsx` manquant
**Symptôme** : `Module not found: Can't resolve 'xlsx'`

**Solution** : `npm install xlsx` (voir `docs/INSTALL_XLSX.md`)

## Vérification du flow

Pour vérifier que tout fonctionne :

1. **Vérifier la table** :
   ```sql
   SELECT COUNT(*) FROM analysis_files;
   ```

2. **Vérifier les prompts** :
   ```sql
   SELECT prompt_type, COUNT(*) FROM system_prompts WHERE is_active = true GROUP BY prompt_type;
   ```
   Devrait retourner : mapping, cleaning, advisor

3. **Tester le flow complet** :
   - Upload 2-3 fichiers CSV
   - Vérifier qu'ils apparaissent dans `analysis_files`
   - Vérifier que le mapping est proposé
   - Confirmer le mapping
   - Vérifier que `stock_entries` est généré
   - Vérifier que `recommendations` est généré
