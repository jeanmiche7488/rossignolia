# Créer le Premier Utilisateur Admin

## Méthode 1 : Via Supabase Dashboard (Recommandé)

### Étape 1 : Créer l'utilisateur dans Authentication

1. Allez sur https://supabase.com/dashboard/project/fgtmekgftjqszfozsmgx
2. Cliquez sur **Authentication** dans le menu de gauche
3. Cliquez sur **Users**
4. Cliquez sur **Add user** > **Create new user**
5. Remplissez :
   - **Email** : `admin@rossignolia.com` (ou votre email)
   - **Password** : Choisissez un mot de passe fort
   - **Auto Confirm User** : ✅ Cochez cette case (pour éviter la confirmation par email)
6. Cliquez sur **Create user**
7. **Copiez l'ID de l'utilisateur** (UUID) - vous en aurez besoin

### Étape 2 : Créer le tenant et le profil

1. Allez dans **SQL Editor**
2. Créez une nouvelle query
3. Copiez-collez le script suivant en remplaçant les valeurs :

```sql
-- Créer le tenant
INSERT INTO tenants (name, slug)
VALUES ('Organisation Principale', 'main-org')
RETURNING id;

-- Notez l'ID du tenant créé, puis exécutez :

-- Créer le profil SUPER_ADMIN
-- ⚠️ REMPLACEZ les valeurs ci-dessous :
INSERT INTO profiles (
  id,                    -- ID de l'utilisateur créé à l'étape 1
  tenant_id,             -- ID du tenant créé juste au-dessus
  email,                 -- Email de l'utilisateur
  full_name,
  role
)
VALUES (
  'VOTRE_USER_ID_ICI',   -- UUID de l'utilisateur Authentication
  'VOTRE_TENANT_ID_ICI', -- UUID du tenant
  'admin@rossignolia.com', -- Email
  'Administrateur Principal',
  'SUPER_ADMIN'
);
```

4. Exécutez la requête

### Étape 3 : Vérifier

Exécutez cette requête pour vérifier :

```sql
SELECT 
  p.id,
  p.email,
  p.full_name,
  p.role,
  t.name as tenant_name
FROM profiles p
JOIN tenants t ON p.tenant_id = t.id
WHERE p.role = 'SUPER_ADMIN';
```

Vous devriez voir votre utilisateur avec le rôle SUPER_ADMIN.

## Méthode 2 : Script Automatique (Alternative)

Vous pouvez aussi utiliser le fichier `supabase/migrations/005_create_first_admin.sql` 
en remplaçant les valeurs marquées avec ⚠️.

## Connexion

Une fois créé, vous pouvez vous connecter avec :
- **Email** : L'email que vous avez utilisé
- **Password** : Le mot de passe que vous avez défini

Vous serez automatiquement redirigé vers `/admin` car vous êtes SUPER_ADMIN.
