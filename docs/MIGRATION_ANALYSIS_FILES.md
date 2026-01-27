# Migration : Table analysis_files

## Problème
La table `analysis_files` n'existe pas dans votre base de données Supabase, ce qui empêche le système multi-fichiers de fonctionner.

## Solution
Vous devez exécuter la migration SQL `011_add_analysis_files.sql` dans Supabase.

## Étapes

1. **Ouvrez Supabase Dashboard**
   - Allez sur https://supabase.com/dashboard
   - Sélectionnez votre projet

2. **Accédez à l'éditeur SQL**
   - Dans le menu de gauche, cliquez sur "SQL Editor"
   - Cliquez sur "New query"

3. **Copiez-collez le contenu de la migration**
   - Ouvrez le fichier `supabase/migrations/011_add_analysis_files.sql`
   - Copiez tout le contenu
   - Collez-le dans l'éditeur SQL de Supabase

4. **Exécutez la migration**
   - Cliquez sur "Run" ou appuyez sur `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)
   - Vérifiez qu'il n'y a pas d'erreur

5. **Vérifiez que la table existe**
   - Dans Supabase Dashboard, allez dans "Table Editor"
   - Vous devriez voir la table `analysis_files` dans la liste

## Vérification

Exécutez cette requête SQL pour vérifier :

```sql
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'analysis_files'
ORDER BY ordinal_position;
```

Vous devriez voir les colonnes : `id`, `analysis_id`, `tenant_id`, `file_name`, `file_type`, `file_path`, etc.

## Après la migration

Une fois la migration exécutée :
1. Redémarrez votre serveur Next.js (`npm run dev`)
2. Réessayez de créer une analyse avec plusieurs fichiers
3. Le système devrait maintenant fonctionner correctement
