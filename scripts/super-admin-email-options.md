# Options pour le SUPER_ADMIN - Email pierre.servant@rossignolia.com

## Situation Actuelle

Vous avez déjà un utilisateur `pierre.servant@ogf.fr` qui a été modifié depuis `pierre.servant@rossignolia.com`. 

## Options Disponibles

### Option 1 : Utiliser l'utilisateur existant (RECOMMANDÉ)

**Avantage :** Plus simple, pas besoin de créer un nouvel utilisateur

**Étapes :**

1. Vérifiez que l'utilisateur `pierre.servant@ogf.fr` est bien SUPER_ADMIN :

```sql
SELECT email, role, tenant_id 
FROM profiles 
WHERE email = 'pierre.servant@ogf.fr';
```

2. Si ce n'est pas le cas, mettez à jour :

```sql
UPDATE profiles
SET 
  role = 'SUPER_ADMIN',
  tenant_id = NULL
WHERE email = 'pierre.servant@ogf.fr';
```

3. Connectez-vous avec `pierre.servant@ogf.fr` et vous serez redirigé vers `/admin`

### Option 2 : Changer l'email de l'utilisateur existant

**Avantage :** Vous gardez le même utilisateur mais avec l'email souhaité

**Étapes :**

1. Dans Supabase Authentication, trouvez l'utilisateur `pierre.servant@ogf.fr`
2. Modifiez l'email en `pierre.servant@rossignolia.com` (si possible via l'interface)
3. Ou via SQL (nécessite service role) :

```sql
-- Mettre à jour l'email dans auth.users (nécessite service role)
UPDATE auth.users
SET email = 'pierre.servant@rossignolia.com'
WHERE email = 'pierre.servant@ogf.fr';

-- Mettre à jour le profil
UPDATE profiles
SET email = 'pierre.servant@rossignolia.com'
WHERE email = 'pierre.servant@ogf.fr';
```

### Option 3 : Créer un nouvel utilisateur avec un autre email

**Avantage :** Garde l'ancien utilisateur intact

**Étapes :**

1. Choisissez un autre email, par exemple :
   - `admin@rossignolia.com`
   - `pierre.admin@rossignolia.com`
   - `superadmin@rossignolia.com`

2. Suivez les instructions dans `scripts/connecter-super-admin.md` avec le nouvel email

### Option 4 : Supprimer l'ancien et créer le nouveau

**⚠️ Attention :** Cela supprimera toutes les données associées à l'ancien utilisateur

**Étapes :**

1. Supprimez l'utilisateur dans Supabase Authentication :
   - Authentication > Users > Trouvez `pierre.servant@ogf.fr` > Delete

2. Créez le nouvel utilisateur :
   - Authentication > Users > Add user
   - Email : `pierre.servant@rossignolia.com`
   - Password : Votre mot de passe
   - Auto Confirm User : ✅

3. Créez le profil SUPER_ADMIN :

```sql
-- Récupérer l'ID du nouvel utilisateur
SELECT id, email FROM auth.users WHERE email = 'pierre.servant@rossignolia.com';

-- Créer le profil (remplacez USER_ID)
INSERT INTO profiles (
  id,
  tenant_id,
  email,
  full_name,
  role
)
VALUES (
  'USER_ID',  -- UUID du nouvel utilisateur
  NULL,       -- NULL pour SUPER_ADMIN
  'pierre.servant@rossignolia.com',
  'Pierre Servant',
  'SUPER_ADMIN'
);
```

## Recommandation

Je recommande l'**Option 1** : utiliser `pierre.servant@ogf.fr` comme SUPER_ADMIN. C'est le plus simple et vous évite de gérer plusieurs comptes.

Si vous préférez vraiment avoir `pierre.servant@rossignolia.com`, utilisez l'**Option 3** avec un email légèrement différent comme `admin@rossignolia.com` ou `pierre.admin@rossignolia.com`.
