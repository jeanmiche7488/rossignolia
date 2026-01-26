# Mettre à jour le Tenant et l'Utilisateur pour OGF

## Objectif

- **Tenant** : Nom = "OGF"
- **Utilisateur** : Email = "pierre.servant@ogf.fr", Nom = "Pierre Servant"

## Étapes

### 1. Trouver votre tenant_id et user_id

Exécutez cette requête dans Supabase SQL Editor :

```sql
SELECT 
  p.id as user_id,
  p.email,
  p.full_name,
  p.tenant_id,
  t.name as tenant_name
FROM profiles p
LEFT JOIN tenants t ON p.tenant_id = t.id
WHERE p.role = 'USER';
```

Notez :
- Le `tenant_id`
- L'`email` actuel de l'utilisateur

### 2. Mettre à jour le nom du tenant

```sql
UPDATE tenants
SET name = 'OGF'
WHERE id = 'VOTRE_TENANT_ID';  -- Remplacez par le tenant_id noté à l'étape 1
```

### 3. Mettre à jour le profil utilisateur

```sql
UPDATE profiles
SET 
  email = 'pierre.servant@ogf.fr',
  full_name = 'Pierre Servant'
WHERE id = 'VOTRE_USER_ID';  -- Remplacez par le user_id noté à l'étape 1
```

### 4. Mettre à jour l'email dans Authentication (IMPORTANT)

⚠️ **Cette étape doit être faite manuellement dans Supabase Dashboard :**

1. Allez sur https://supabase.com/dashboard/project/fgtmekgftjqszfozsmgx
2. Cliquez sur **Authentication** > **Users**
3. Trouvez l'utilisateur avec l'ancien email
4. Cliquez sur les **3 points** > **Edit user**
5. Changez l'**Email** en `pierre.servant@ogf.fr`
6. Cliquez sur **Save**

### 5. Vérification

Exécutez cette requête pour vérifier :

```sql
SELECT 
  p.email,
  p.full_name,
  p.role,
  t.name as tenant_name
FROM profiles p
LEFT JOIN tenants t ON p.tenant_id = t.id
WHERE p.email = 'pierre.servant@ogf.fr';
```

Vous devriez voir :
- `email` = `pierre.servant@ogf.fr`
- `full_name` = `Pierre Servant`
- `tenant_name` = `OGF`

### 6. Se connecter

1. Déconnectez-vous si vous êtes connecté
2. Connectez-vous avec :
   - **Email** : `pierre.servant@ogf.fr`
   - **Password** : Votre mot de passe actuel
3. Vous devriez voir "OGF" dans le header et "Pierre Servant" dans le header

## Script Complet (Alternative)

Si vous préférez, vous pouvez exécuter le script `update-ogf-tenant-user.sql` qui fait tout automatiquement (sauf l'étape 4 qui doit être faite manuellement).
