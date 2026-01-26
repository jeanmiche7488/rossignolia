# Créer un Utilisateur de Test (USER)

## Étapes pour créer un utilisateur normal (non-admin)

### Étape 1 : Créer l'utilisateur dans Authentication

1. Allez sur https://supabase.com/dashboard/project/fgtmekgftjqszfozsmgx
2. Cliquez sur **Authentication** > **Users**
3. Cliquez sur **Add user** > **Create new user**
4. Remplissez :
   - **Email** : `user@test.com` (ou votre email de test)
   - **Password** : Choisissez un mot de passe
   - **Auto Confirm User** : ✅ Cochez cette case
5. Cliquez sur **Create user**
6. **Copiez l'ID de l'utilisateur** (UUID)

### Étape 2 : Vérifier/Créer un tenant

Si vous n'avez pas encore de tenant (autre que celui du SUPER_ADMIN), créez-en un :

```sql
-- Créer un tenant de test
INSERT INTO tenants (name, slug)
VALUES ('Entreprise Test', 'test-company')
RETURNING id;
```

Notez l'ID du tenant créé.

### Étape 3 : Créer le profil USER

Exécutez cette requête dans SQL Editor (remplacez les valeurs) :

```sql
-- Créer le profil USER
INSERT INTO profiles (
  id,                    -- ID de l'utilisateur créé à l'étape 1
  tenant_id,             -- ID du tenant (celui du SUPER_ADMIN ou un nouveau)
  email,                 -- Email de l'utilisateur
  full_name,
  role
)
VALUES (
  'VOTRE_USER_ID_ICI',   -- UUID de l'utilisateur Authentication
  'VOTRE_TENANT_ID_ICI', -- UUID du tenant
  'user@test.com',       -- Email
  'Utilisateur Test',
  'USER'                 -- ⚠️ Important : USER et non SUPER_ADMIN
);
```

### Étape 4 : Se connecter

1. Déconnectez-vous si vous êtes connecté en tant qu'admin
2. Connectez-vous avec l'email/mot de passe de l'utilisateur USER
3. Vous serez redirigé vers `/stock` (page utilisateur)

## Alternative : Utiliser le tenant du SUPER_ADMIN

Si vous voulez utiliser le même tenant que le SUPER_ADMIN, récupérez d'abord son tenant_id :

```sql
-- Récupérer le tenant_id du SUPER_ADMIN
SELECT tenant_id FROM profiles WHERE role = 'SUPER_ADMIN' LIMIT 1;
```

Puis utilisez cet ID dans l'étape 3.
