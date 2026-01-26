# Se Connecter en SUPER_ADMIN

## Architecture du SUPER_ADMIN

**Important :** Le SUPER_ADMIN est différent d'un tenant :
- ❌ Le SUPER_ADMIN n'a **PAS** de `tenant_id` (il est `NULL`)
- ✅ Le SUPER_ADMIN peut voir et gérer **tous les tenants**
- ✅ Le SUPER_ADMIN est redirigé vers `/admin` après connexion
- ✅ Le SUPER_ADMIN n'a pas accès aux pages utilisateur (`/stock`, `/dashboard`)

## Créer le SUPER_ADMIN pierre.servant@rossignolia.com

### Étape 1 : Créer l'utilisateur dans Supabase Authentication

1. Allez sur https://supabase.com/dashboard/project/fgtmekgftjqszfozsmgx
2. Cliquez sur **Authentication** dans le menu de gauche
3. Cliquez sur **Users**
4. Cliquez sur **Add user** > **Create new user**
5. Remplissez :
   - **Email** : `pierre.servant@rossignolia.com`
   - **Password** : Choisissez un mot de passe fort
   - **Auto Confirm User** : ✅ **Cochez cette case** (pour éviter la confirmation par email)
6. Cliquez sur **Create user**
7. **Copiez l'ID de l'utilisateur** (UUID) - vous en aurez besoin à l'étape suivante

### Étape 2 : Créer le profil SUPER_ADMIN

Exécutez cette requête dans Supabase SQL Editor en remplaçant `VOTRE_USER_ID` par l'ID copié à l'étape 1 :

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
  'pierre.servant@rossignolia.com',
  'Pierre Servant',
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
WHERE p.email = 'pierre.servant@rossignolia.com';
```

**Résultat attendu :**
- `email` = `pierre.servant@rossignolia.com`
- `role` = `SUPER_ADMIN`
- `tenant_id` = `NULL` (pas de tenant)
- `status` = `✅ Correct (pas de tenant)`

## Se Connecter

### Méthode 1 : Via l'interface de login

1. Allez sur http://localhost:3000 (ou votre URL de production)
2. Si vous êtes déjà connecté, cliquez sur **"Déconnexion"**
3. Cliquez sur **"Se connecter"**
4. Entrez :
   - **Email** : `pierre.servant@rossignolia.com`
   - **Password** : Le mot de passe que vous avez défini à l'étape 1
5. Cliquez sur **"Se connecter"**
6. Vous devriez être **automatiquement redirigé vers `/admin`**

### Vérifier la redirection

Si vous êtes redirigé vers `/admin`, c'est bon signe ! Vous devriez voir :
- **Sidebar** avec : Dashboard, Tenants, Utilisateurs
- **Page `/admin`** avec les statistiques et la liste des tenants

## Interface Admin Accessible

Une fois connecté en SUPER_ADMIN, vous avez accès à :

1. **`/admin`** - Dashboard admin avec statistiques globales
2. **`/admin/tenants`** - Liste de tous les tenants
3. **`/admin/tenants/new`** - Créer un nouveau tenant
4. **`/admin/users`** - Liste de tous les utilisateurs
5. **`/admin/users/new`** - Créer un nouvel utilisateur

## Dépannage

### Problème : Je suis redirigé vers `/dashboard` au lieu de `/admin`

**Solution :** Vérifiez que votre `tenant_id` est bien `NULL` :

```sql
-- Vérifier
SELECT email, role, tenant_id 
FROM profiles 
WHERE email = 'pierre.servant@rossignolia.com';

-- Corriger si nécessaire
UPDATE profiles 
SET tenant_id = NULL 
WHERE email = 'pierre.servant@rossignolia.com' AND role = 'SUPER_ADMIN';
```

### Problème : Je ne peux pas accéder à `/admin`

**Solution :** Vérifiez que :
1. Votre `role` est bien `SUPER_ADMIN`
2. Votre `tenant_id` est bien `NULL`

```sql
-- Vérifier et corriger
UPDATE profiles 
SET 
  role = 'SUPER_ADMIN',
  tenant_id = NULL
WHERE email = 'pierre.servant@rossignolia.com';
```

### Problème : L'utilisateur n'existe pas dans Authentication

**Solution :** Créez l'utilisateur dans Supabase :
1. **Authentication** > **Users** > **Add user**
2. Email : `pierre.servant@rossignolia.com`
3. Password : Votre mot de passe
4. Auto Confirm User : ✅
5. Créez l'utilisateur
6. Puis exécutez l'étape 2 ci-dessus pour créer le profil

## Vérification Finale

Après connexion, vous devriez voir dans le header :
- **"Administration"** (au lieu du nom du tenant)
- Votre nom "Pierre Servant" ou email
- Le bouton de déconnexion

Dans la sidebar, vous devriez voir :
- Dashboard (actif)
- Tenants
- Utilisateurs

Si tout est correct, vous pouvez maintenant gérer les tenants et utilisateurs depuis l'interface admin !
