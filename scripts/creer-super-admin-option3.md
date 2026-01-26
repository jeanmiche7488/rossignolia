# Créer un SUPER_ADMIN avec un Nouvel Email (Option 3)

## Email Suggéré

Choisissez un email parmi :
- `admin@rossignolia.com` (recommandé)
- `pierre.admin@rossignolia.com`
- `superadmin@rossignolia.com`

Dans ce guide, nous utiliserons `admin@rossignolia.com` comme exemple.

## Étapes à Suivre

### Étape 1 : Créer l'utilisateur dans Supabase Authentication

1. Allez sur https://supabase.com/dashboard/project/fgtmekgftjqszfozsmgx
2. Cliquez sur **Authentication** dans le menu de gauche
3. Cliquez sur **Users**
4. Cliquez sur **Add user** > **Create new user**
5. Remplissez :
   - **Email** : `admin@rossignolia.com` (ou l'email de votre choix)
   - **Password** : Choisissez un mot de passe fort
   - **Auto Confirm User** : ✅ **Cochez cette case** (important)
6. Cliquez sur **Create user**
7. **Copiez l'ID de l'utilisateur** (UUID) - vous en aurez besoin à l'étape suivante

### Étape 2 : Créer le profil SUPER_ADMIN

1. Allez dans **SQL Editor** dans Supabase
2. Créez une nouvelle query
3. Exécutez cette requête en remplaçant `VOTRE_USER_ID` par l'ID copié à l'étape 1 :

```sql
-- Créer le profil SUPER_ADMIN
-- ⚠️ REMPLACEZ 'VOTRE_USER_ID' par l'ID de l'utilisateur créé à l'étape 1
INSERT INTO profiles (
  id,
  tenant_id,  -- ⚠️ IMPORTANT : NULL pour SUPER_ADMIN
  email,
  full_name,
  role
)
VALUES (
  'VOTRE_USER_ID',  -- UUID de l'utilisateur Authentication
  NULL,             -- ⚠️ NULL car SUPER_ADMIN n'a pas de tenant
  'admin@rossignolia.com',  -- Email (ou celui que vous avez choisi)
  'Administrateur Principal',
  'SUPER_ADMIN'     -- ⚠️ Rôle SUPER_ADMIN
);
```

### Étape 3 : Vérifier la création

Exécutez cette requête pour vérifier :

```sql
SELECT 
  p.id,
  p.email,
  p.full_name,
  p.role,
  p.tenant_id,
  CASE 
    WHEN p.tenant_id IS NULL THEN '✅ Correct (pas de tenant)'
    ELSE '❌ Erreur : devrait être NULL'
  END as status
FROM profiles p
WHERE p.email = 'admin@rossignolia.com';  -- Ou l'email que vous avez choisi
```

**Résultat attendu :**
- `email` = `admin@rossignolia.com` (ou votre email)
- `role` = `SUPER_ADMIN`
- `tenant_id` = `NULL`
- `status` = `✅ Correct (pas de tenant)`

### Étape 4 : Se connecter

1. Allez sur http://localhost:3000 (ou votre URL de production)
2. Si vous êtes déjà connecté, cliquez sur **"Déconnexion"**
3. Cliquez sur **"Se connecter"**
4. Entrez :
   - **Email** : `admin@rossignolia.com` (ou l'email que vous avez choisi)
   - **Password** : Le mot de passe défini à l'étape 1
5. Cliquez sur **"Se connecter"**
6. Vous devriez être **automatiquement redirigé vers `/admin`**

### Étape 5 : Vérifier l'interface admin

Une fois connecté, vous devriez voir :
- **Sidebar** avec : Accueil, Tenants, Utilisateurs
- **Page `/admin`** avec les statistiques et la liste des tenants
- **Header** avec "Administration" (au lieu du nom du tenant)

## Dépannage

### Problème : Je suis redirigé vers `/dashboard` au lieu de `/admin`

**Solution :** Vérifiez que `tenant_id` est bien `NULL` :

```sql
-- Vérifier
SELECT email, role, tenant_id 
FROM profiles 
WHERE email = 'admin@rossignolia.com';

-- Corriger si nécessaire
UPDATE profiles 
SET tenant_id = NULL 
WHERE email = 'admin@rossignolia.com' AND role = 'SUPER_ADMIN';
```

### Problème : Je ne peux pas accéder à `/admin`

**Solution :** Vérifiez que le rôle est bien `SUPER_ADMIN` :

```sql
-- Vérifier et corriger
UPDATE profiles 
SET role = 'SUPER_ADMIN'
WHERE email = 'admin@rossignolia.com';
```

## C'est Prêt !

Vous pouvez maintenant gérer tous les tenants et utilisateurs depuis l'interface admin.
