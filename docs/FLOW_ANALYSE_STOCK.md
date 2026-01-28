# Flow d'analyse Stock Health — Documentation complète

## Vue d'ensemble

Le flow d'analyse Stock Health suit ces étapes :

1. **Upload multi-fichiers** → Enregistrement des fichiers et métadonnées
2. **Démarrage** → Lancement du mapping (API map)
3. **Mapping automatique** (Gemini) → Proposition de mapping ; **toujours** en attente de confirmation utilisateur
4. **Confirmation mapping** (page `/stock/[id]/mapping`) → Modification possible, puis validation
5. **Cleaning** (page `/stock/[id]/cleaning` → clic « Lancer ») → Nettoyage Gemini + insertion dans `stock_entries`
6. **Analyse** (page `/stock/[id]/analysis`) → Génération du script Python (codegen) → Exécution → Génération des recommandations à partir des **facts** (reco depuis facts)
7. **Recommandations** → Stockées dans `recommendations` ; statut analyse → `completed`

Aucun enchaînement automatique cleaning → recommend : l’utilisateur va à l’étape Analyse, édite éventuellement le prompt, génère le Python, exécute, puis génère les recommandations.

---

## Statuts de l’analyse (`analyses.status`)

| Statut | Signification |
|--------|----------------|
| `pending` | Analyse créée, pas encore de démarrage |
| `mapping_in_progress` | Mapping Gemini en cours (redirection vers `/stock/[id]/mapping/loading`) |
| `mapping_pending` | Mapping proposé, en attente de confirmation utilisateur sur `/stock/[id]/mapping` |
| `ready_for_cleaning` | Mapping confirmé ; l’utilisateur peut lancer le cleaning depuis `/stock/[id]/cleaning` |
| `ready_for_analysis` | Cleaning terminé, `stock_entries` remplie ; l’utilisateur peut aller sur `/stock/[id]/analysis` |
| `completed` | Analyse terminée (recommandations générées) |
| `failed` | Erreur à une étape |

---

## Objets et tables utilisés par phase

### Phase 1 — Création et upload

**Tables / objets :**
- **`analyses`** : une ligne par analyse (`id`, `tenant_id`, `name`, `status` = `pending`, `metadata` = {})
- **`analysis_files`** : une ligne par fichier uploadé (`analysis_id`, `file_name`, `file_path`, `source_type`, `original_columns`, `row_count`, etc.)
- **Supabase Storage** : bucket `analysis-files`, chemin `{tenant_id}/{analysis_id}/{filename}`

**API :**
- `POST /api/upload` : body `analysisId`, `sourceType`, `description` + fichier ; upload Storage + insert `analysis_files`.

---

### Phase 2 — Démarrage et mapping (API)

**Entrée :** `POST /api/analyze/start` avec `analysisId`.

**Objet en entrée :**
- `analyses` (ligne de l’analyse)
- `analysis_files` (tous les fichiers de l’analyse)

**Traitement :**
1. Mise à jour `analyses.status` = `mapping_in_progress`.
2. Appel interne à `POST /api/analyze/map` (body `analysisId`).

**API map — Objets utilisés :**
- Lecture : `analyses`, `analysis_files`, fichiers binaires depuis Storage.
- Agrégation en mémoire : `allRawData` (lignes avec `_source_file`, `_source_type`), `allColumns`, `columnSources` (colonne → liste de noms de fichiers), `fileMetadata` (file_name, source_type, row_count).
- Appel Gemini : `mapColumns({ columns, sampleData, context }, { tenantId, useDbPrompt })` ; prompt type `mapping` depuis `system_prompts`.
- Écriture : `analyses.original_columns`, `analyses.mapped_columns` (mapping proposé), `analyses.status` = `mapping_pending`, `analyses.metadata.mapping` (confidence, reasoning, proposed_mapping, column_sources), `analyses.metadata.files` = fileMetadata.

**Sortie :** L’utilisateur est redirigé vers `/stock/[id]/mapping` (ou reste sur loading si encore `mapping_in_progress`).

---

### Phase 3 — Confirmation du mapping (page)

**Page :** `/stock/[id]/mapping` (statut attendu : `mapping_pending`).

**Objets chargés :**
- `analyses` : `original_columns`, `mapped_columns`, `metadata.mapping.column_sources`, `metadata.files`.
- État local : `mapping` (proposition), `initialMapping` (copie au chargement), `columnSources`, `files` (liste des fichiers).

**Comportement :**
- Un bloc par champ cible (SKU, Quantity, Unit Cost, **Currency**, Total Value, Location, etc.).
- Dans chaque bloc : **une ligne par fichier** avec un **dropdown** pour choisir la colonne source (ou « No data »). Modification directe dans cette vue (pas de liste séparée « Mapped columns »).
- Si une colonne était mappée au champ A et est réaffectée au champ B : bloc A = ligne en **rouge** + texte « « colonne » désaffecté (mapping modifié) » ; bloc B = ligne en **vert** + « « colonne » réaffecté ici ».
- Champs requis (SKU, Quantity) : doivent être mappés ou marqués « Non disponible ».
- Au clic « Confirmer » : mise à jour `analyses.mapped_columns` (mapping confirmé), `analyses.status` = `ready_for_cleaning`, `metadata.mapping.confirmed_mapping`, `confirmed_at`, `not_available_fields` ; redirection vers `/stock/[id]/cleaning`.

---

### Phase 4 — Cleaning

**Page :** `/stock/[id]/cleaning` (statut `ready_for_cleaning`). Résumé des actions de cleaning (après exécution) ; bouton « Lancer le cleaning » appelle `POST /api/analyze/clean`.

**API clean — Objets utilisés :**
- Lecture : `analyses` (mapped_columns), `analysis_files`, fichiers depuis Storage.
- Agrégation : même logique que map (allRawData, colonnes, etc.).
- Appel Gemini : `cleanData({ data, mappedColumns, issues, tenantId, useDbPrompt })` ; prompt type `cleaning`. Réponse : `cleanedData` (tableau d’objets avec champs mappés + `currency`, `unit_cost_eur` + `attributes`), `cleaningReport`, `pythonCode`.
- Écriture : **`stock_entries`** (insert par batch) : `tenant_id`, `analysis_id`, `sku`, `product_name`, `quantity`, `unit_cost`, **`currency`**, **`unit_cost_eur`**, `total_value`, `location`, `category`, `supplier`, `last_movement_date`, `days_since_last_movement`, `attributes`.
- Mise à jour : `analyses.metadata.cleaning` (report, pythonCode), `analyses.status` = `ready_for_analysis`.

**Pas d’appel automatique à recommend** : l’utilisateur va manuellement à l’étape Analyse.

---

### Phase 5 — Analyse (codegen + exécution + reco)

**Page :** `/stock/[id]/analysis` (statut `ready_for_analysis`).

**Sous-étapes :**
1. **Codegen** : `POST /api/analyze/codegen` avec `analysisId`. Lit un profil du dataset (stock_entries), appelle Gemini `generateAnalysisPython` (prompt `analysis_codegen`). Réponse : `pythonCode`, `notes`. Sauvegarde optionnelle dans `analyses.metadata` ou config.
2. **Exécution** : `POST /api/analyze/execute` avec `analysisId`. Lit `stock_entries` en flux (pagination), exécute le script Python (stdin = JSONL), récupère le JSON **facts** sur stdout, stocke dans `analyses.metadata.facts_json` (ou champ dédié).
3. **Recommandations depuis facts** : `POST /api/analyze/recommend` avec `analysisId`. Utilise `generateRecommendationsFromFacts` (prompt `analysis_reco`) avec `facts` + metadata + prompt utilisateur. Insère dans `recommendations`, met `analyses.status` = `completed`.

**Objets utilisés :**
- **Codegen** : `stock_entries` (profil / échantillon), `system_prompts` (type `analysis_codegen`).
- **Execute** : `stock_entries` (lecture paginée), script Python, sortie → `facts` (JSON).
- **Recommend** : `analyses.metadata.facts_json` (ou équivalent), `system_prompts` (type `analysis_reco`), table `recommendations` (insert).

**Prompts :**
- `analysis_codegen` : génération du script Python (entrée JSONL, sortie JSON « facts »).
- `analysis_reco` : génération des recommandations à partir du JSON facts (pas à partir des lignes brutes).
- `advisor` (legacy) : désactivé en base ; plus utilisé pour le flow principal.

---

## Tables et champs clés

### `analysis_files`
- `id`, `analysis_id`, `tenant_id`, `file_name`, `file_type`, `file_path`, `source_type`, `description`, `original_columns` (JSONB), `row_count`, `uploaded_at`.

### `analyses`
- `id`, `tenant_id`, `name`, `status` (voir statuts ci-dessus).
- `original_columns` (JSONB) : liste des colonnes agrégées.
- `mapped_columns` (JSONB) : mapping colonne source → champ cible (ex. `{ "Col1": "sku", "Col2": "quantity" }`).
- `metadata` (JSONB) : `files` (liste { file_name, source_type, row_count }), `mapping` (confidence, reasoning, column_sources, confirmed_mapping, confirmed_at, not_available_fields), `cleaning` (report, pythonCode), `facts_json` (output du script Python), etc.

### `stock_entries`
- Champs mappés : `sku`, `product_name`, `quantity`, `unit_cost`, **`currency`**, **`unit_cost_eur`**, `total_value`, `location`, `category`, `supplier`, `last_movement_date`, `days_since_last_movement`.
- `attributes` (JSONB) : colonnes non mappées.
- `tenant_id`, `analysis_id`, `created_at`.

### `recommendations`
- `analysis_id`, `tenant_id`, `type`, `priority`, `title`, `description`, `action_items`, `affected_skus`, `estimated_impact`, `python_code`, `status`, etc.

### `system_prompts`
- `tenant_id` (NULL = global), `module_code` = 'stock', `prompt_type` : `mapping`, `cleaning`, `analysis_codegen`, `analysis_reco` ; `advisor` (désactivé).
- Utilisés par : `mapColumns`, `cleanData`, `generateAnalysisPython`, `generateRecommendationsFromFacts`.

---

## Récap séquence des appels

1. **Client** : création analyse → upload un ou plusieurs fichiers (`/api/upload`).
2. **Client** : clic « Démarrer / Lancer le mapping » → `POST /api/analyze/start` → en interne `POST /api/analyze/map`.
3. **Map** : lit fichiers, agrège, appelle Gemini mapping, écrit `analyses` (mapping_pending, mapped_columns, metadata.mapping, metadata.files).
4. **Client** : page Mapping → affiche une ligne par fichier par champ, dropdown pour modifier → Confirmer → PATCH analyses (mapped_columns, status ready_for_cleaning) → redirection cleaning.
5. **Client** : page Cleaning → clic « Lancer le cleaning » → `POST /api/analyze/clean` → Gemini cleanData, insert stock_entries (dont currency, unit_cost_eur), status ready_for_analysis.
6. **Client** : page Analyse → (optionnel) éditer prompt → Codegen → Execute → Recommend → status completed.

---

## Problèmes courants

- **Table `analysis_files` manquante** : exécuter la migration `011_add_analysis_files.sql`.
- **Colonnes `currency` / `unit_cost_eur` manquantes** : exécuter `014_add_currency_unit_cost_eur.sql`.
- **Erreur 401 sur appels internes** : les routes utilisent le header `X-Internal-Call: true` quand appelées depuis le serveur.
- **Package xlsx** : `npm install xlsx` (voir `docs/INSTALL_XLSX.md`).
- **Prompts manquants** : vérifier que les seeds créent bien `mapping`, `cleaning`, `analysis_codegen`, `analysis_reco` ; `advisor` peut être désactivé (`013_deactivate_advisor_prompt.sql`).

---

## Vérification du flow

1. Vérifier les tables : `analysis_files`, `analyses`, `stock_entries`, `recommendations`.
2. Vérifier les prompts actifs :  
   `SELECT prompt_type, COUNT(*) FROM system_prompts WHERE is_active = true AND module_code = 'stock' GROUP BY prompt_type;`
3. Tester : Upload → Mapping (vue par fichier, désaffectation/réaffectation) → Confirmer → Cleaning → Analyse (codegen → execute → reco) → statut `completed`.
