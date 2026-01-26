# Créer un Utilisateur pour un Tenant

## Architecture Correcte

- **SUPER_ADMIN** : Pas de tenant_id (NULL), gère tous les tenants
- **USER** : Appartient à un tenant spécifique, voit uniquement les données de son tenant

## Créer un Tenant et un Utilisateur

### Étape 1 : Créer le Tenant (via Admin ou SQL)

Si vous êtes SUPER_ADMIN, vous pouvez créer un tenant via l'interface admin (quand elle sera prête) ou via SQL :

```sql
-- Créer un nouveau tenant
INSERT INTO tenants (name, slug)
VALUES ('Entreprise Client A', 'client-a')
RETURNING id;
```

Notez l'ID du tenant créé (ex: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`).

### Étape 2 : Créer l'utilisateur dans Authentication

1. Allez sur https://supabase.com/dashboard/project/fgtmekgftjqszfozsmgx
2. Authentication > Users > Add user
3. Remplissez :
   - **Email** : `user@client-a.com` (ou tout email fictif pour les tests)
   - **Password** : Votre mot de passe
   - **Auto Confirm User** : ✅ **Important : cochez cette case**
4. Créez l'utilisateur et copiez son ID

**Note :** L'email peut être fictif (ex: `test@example.com`), Supabase l'accepte pour les tests.

### Étape 3 : Créer le Profil USER

Exécutez cette requête en remplaçant les valeurs entre `<>` :

```sql
INSERT INTO profiles (
  id,                    -- ID de l'utilisateur créé à l'étape 2
  tenant_id,             -- ID du tenant créé à l'étape 1
  email,                 -- Email de l'utilisateur (même que dans Authentication)
  full_name,             -- Nom complet de l'utilisateur (affiché dans l'interface)
  role                   -- Rôle : 'USER' pour utilisateur normal, 'SUPER_ADMIN' pour admin
)
VALUES (
  '<ID_UTILISATEUR>',           -- ⚠️ Remplacez par l'UUID de l'utilisateur (étape 2)
  '<ID_TENANT>',                -- ⚠️ Remplacez par l'UUID du tenant (étape 1)
  'user@client-a.com',          -- Email (même que dans Authentication)
  'Utilisateur Client A',       -- Nom complet (vous pouvez mettre ce que vous voulez)
  'USER'                        -- ⚠️ Important : 'USER' (pas 'SUPER_ADMIN')
);
```

**Exemple concret :**

Si vous avez :
- Tenant ID : `a1b2c3d4-e5f6-7890-abcd-ef1234567890`
- User ID : `f9e8d7c6-b5a4-3210-9876-fedcba098765`

La requête devient :

```sql
INSERT INTO profiles (
  id,
  tenant_id,
  email,
  full_name,
  role
)
VALUES (
  'f9e8d7c6-b5a4-3210-9876-fedcba098765',  -- ID utilisateur
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',  -- ID tenant
  'user@client-a.com',                     -- Email
  'Jean Dupont',                           -- Nom complet (vous pouvez mettre votre nom)
  'USER'                                   -- Rôle USER
);
```

### Explication des champs

- **`id`** : UUID de l'utilisateur créé dans Authentication (étape 2)
- **`tenant_id`** : UUID du tenant créé (étape 1)
- **`email`** : Email de l'utilisateur (doit correspondre à celui dans Authentication)
- **`full_name`** : Nom complet affiché dans l'interface (ex: "Jean Dupont", "Utilisateur Test", etc.)
- **`role`** : 
  - `'USER'` = Utilisateur normal (voit uniquement les données de son tenant)
  - `'SUPER_ADMIN'` = Administrateur (gère tous les tenants, pas de tenant_id)

### Étape 4 : Se connecter

1. Déconnectez-vous si vous êtes connecté
2. Connectez-vous avec l'email/mot de passe de l'utilisateur USER
3. Vous serez redirigé vers `/stock` (page utilisateur)
4. Vous ne verrez que les données de votre tenant

## Vérification

Pour vérifier que tout est correct :

```sql
-- Voir tous les utilisateurs et leurs tenants
SELECT 
  p.email,
  p.full_name,
  p.role,
  p.tenant_id,
  t.name as tenant_name
FROM profiles p
LEFT JOIN tenants t ON p.tenant_id = t.id
ORDER BY p.role, t.name;
```

Vous devriez voir :
- `role` = `USER`
- `tenant_id` = L'ID du tenant
- `tenant_name` = Le nom du tenant
