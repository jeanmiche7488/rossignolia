# Comment Éditer un Utilisateur dans Supabase

## Méthode 1 : Via l'Interface Supabase (Recommandé)

1. Allez sur https://supabase.com/dashboard/project/fgtmekgftjqszfozsmgx
2. Cliquez sur **Authentication** dans le menu de gauche
3. Cliquez sur **Users** (vous devriez voir la liste de tous les utilisateurs)
4. **Cliquez sur l'utilisateur** que vous voulez modifier dans la liste
5. Une page de détails s'ouvre avec les informations de l'utilisateur
6. Cliquez sur le bouton **"Edit"** ou **"Edit user"** (généralement en haut à droite ou dans un menu)
7. Modifiez l'**Email** en `pierre.servant@ogf.fr`
8. Cliquez sur **"Save"** ou **"Update"**

## Méthode 2 : Si vous ne voyez pas l'option Edit

Si l'interface a changé, vous pouvez aussi :

1. Dans la liste des utilisateurs, **cliquez directement sur l'email** de l'utilisateur
2. Ou cherchez un **menu à 3 points** (⋮) à droite de chaque utilisateur
3. Ou utilisez la **Méthode 3** ci-dessous (via SQL)

## Méthode 3 : Via SQL (Alternative)

Si vous préférez, vous pouvez mettre à jour l'email directement via SQL :

```sql
-- ⚠️ ATTENTION : Cette méthode met à jour l'email dans auth.users
-- Vous devez d'abord trouver l'ID de l'utilisateur dans auth.users

-- Étape 1 : Trouver l'ID de l'utilisateur dans auth.users
SELECT id, email FROM auth.users WHERE email LIKE '%test%' OR email LIKE '%user%';

-- Étape 2 : Mettre à jour l'email (remplacez 'USER_ID' par l'ID trouvé)
UPDATE auth.users
SET email = 'pierre.servant@ogf.fr',
    email_confirmed_at = NOW()  -- Confirmer automatiquement le nouvel email
WHERE id = 'USER_ID';

-- Étape 3 : Vérifier
SELECT id, email, email_confirmed_at FROM auth.users WHERE email = 'pierre.servant@ogf.fr';
```

## Méthode 4 : Supprimer et Recréer (Si rien ne fonctionne)

Si vous ne pouvez vraiment pas éditer l'utilisateur :

1. **Notez le mot de passe actuel** (ou créez-en un nouveau que vous noterez)
2. **Supprimez l'ancien utilisateur** dans Authentication > Users (menu à 3 points > Delete)
3. **Créez un nouvel utilisateur** avec :
   - Email : `pierre.servant@ogf.fr`
   - Password : Votre mot de passe
   - Auto Confirm User : ✅
4. **Mettez à jour le profil** avec le nouvel ID :

```sql
-- Trouver le nouvel ID
SELECT id, email FROM auth.users WHERE email = 'pierre.servant@ogf.fr';

-- Mettre à jour le profil avec le nouvel ID
UPDATE profiles
SET 
  id = 'NOUVEL_USER_ID',  -- ID du nouvel utilisateur
  email = 'pierre.servant@ogf.fr',
  full_name = 'Pierre Servant'
WHERE email LIKE '%test%' OR email LIKE '%user%';
```

## Vérification Finale

Après avoir mis à jour l'email, vérifiez que tout est correct :

```sql
SELECT 
  p.id,
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
