# Mettre à jour le nom du tenant en "OGF"

## Méthode 1 : Via SQL Editor (Recommandé)

1. Allez sur https://supabase.com/dashboard/project/fgtmekgftjqszfozsmgx
2. Cliquez sur **SQL Editor** > **New query**
3. Exécutez cette requête pour trouver votre tenant_id :

```sql
SELECT 
  p.email,
  p.tenant_id,
  t.name as tenant_name
FROM profiles p
LEFT JOIN tenants t ON p.tenant_id = t.id
WHERE p.email = 'votre-email@example.com';
```

4. Notez le `tenant_id` retourné
5. Exécutez cette requête en remplaçant `VOTRE_TENANT_ID` :

```sql
UPDATE tenants
SET name = 'OGF'
WHERE id = 'VOTRE_TENANT_ID';
```

6. Vérifiez le résultat :

```sql
SELECT id, name, slug FROM tenants WHERE name = 'OGF';
```

## Méthode 2 : Mise à jour automatique

Si vous n'avez qu'un seul tenant (autre que celui du SUPER_ADMIN), exécutez simplement :

```sql
UPDATE tenants
SET name = 'OGF'
WHERE id IN (
  SELECT DISTINCT tenant_id 
  FROM profiles 
  WHERE tenant_id IS NOT NULL
);
```

## Vérification

Après la mise à jour, déconnectez-vous et reconnectez-vous. Le nom "OGF" devrait apparaître dans le header.
