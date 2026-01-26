# Créer un Utilisateur USER de Test (Email Fictif)

## Étapes Rapides

### Étape 1 : Créer l'utilisateur dans Authentication

1. Allez sur https://supabase.com/dashboard/project/fgtmekgftjqszfozsmgx
2. **Authentication** > **Users** > **Add user**
3. Remplissez :
   - **Email** : `user.test@example.com` (ou tout autre email fictif)
   - **Password** : `Test123456!` (ou votre mot de passe de test)
   - **Auto Confirm User** : ✅ **Cochez cette case**
4. Cliquez sur **Create user**
5. **Copiez l'ID de l'utilisateur** (UUID) - vous en aurez besoin

### Étape 2 : Récupérer le tenant_id

Exécutez cette requête pour récupérer un tenant_id existant (ou créez-en un nouveau) :

```sql
-- Option A : Utiliser un tenant existant
SELECT id, name FROM tenants LIMIT 1;

-- Option B : Créer un nouveau tenant de test
INSERT INTO tenants (name, slug)
VALUES ('Entreprise Test', 'test-company')
RETURNING id, name;
```

Notez l'ID du tenant.

### Étape 3 : Créer le Profil USER

Exécutez cette requête en remplaçant les valeurs :

```sql
INSERT INTO profiles (
  id,                    -- ID de l'utilisateur créé à l'étape 1
  tenant_id,             -- ID du tenant de l'étape 2
  email,                 -- Email fictif (même que dans Authentication)
  full_name,
  role
)
VALUES (
  'VOTRE_USER_ID_ICI',   -- UUID de l'utilisateur (étape 1)
  'VOTRE_TENANT_ID_ICI', -- UUID du tenant (étape 2)
  'user.test@example.com', -- Email fictif
  'Utilisateur Test',
  'USER'                 -- ⚠️ Important : USER (pas SUPER_ADMIN)
);
```

### Étape 4 : Se connecter

1. Déconnectez-vous si vous êtes connecté en tant qu'admin
2. Connectez-vous avec :
   - **Email** : `user.test@example.com`
   - **Password** : Le mot de passe que vous avez défini
3. Vous serez redirigé vers `/stock` (page utilisateur)

## Vérification

Pour vérifier que tout est correct :

```sql
SELECT 
  p.email,
  p.role,
  p.tenant_id,
  t.name as tenant_name
FROM profiles p
LEFT JOIN tenants t ON p.tenant_id = t.id
WHERE p.email = 'user.test@example.com';
```

Vous devriez voir :
- `role` = `USER`
- `tenant_id` = L'ID du tenant
- `tenant_name` = Le nom du tenant
