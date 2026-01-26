-- ============================================
-- UPDATE TENANT AND USER TO OGF
-- ============================================
-- 
-- Ce script met à jour :
-- 1. Le nom du tenant en "OGF"
-- 2. L'email de l'utilisateur en "pierre.servant@ogf.fr"
-- 3. Le nom complet de l'utilisateur en "Pierre Servant"
--
-- ============================================

-- Étape 1 : Trouver le tenant_id de l'utilisateur
-- Exécutez d'abord cette requête pour voir votre tenant_id actuel :
-- SELECT tenant_id, email FROM profiles WHERE email LIKE '%test%' OR email LIKE '%user%';

-- Étape 2 : Mettre à jour le nom du tenant
-- Remplacez 'VOTRE_TENANT_ID' par l'ID réel de votre tenant
UPDATE tenants
SET name = 'OGF'
WHERE id IN (
  SELECT DISTINCT tenant_id 
  FROM profiles 
  WHERE tenant_id IS NOT NULL
  LIMIT 1
);

-- Étape 3 : Mettre à jour l'email et le nom de l'utilisateur
-- Remplacez 'VOTRE_USER_EMAIL_ACTUEL' par l'email actuel de votre utilisateur USER
UPDATE profiles
SET 
  email = 'pierre.servant@ogf.fr',
  full_name = 'Pierre Servant'
WHERE email LIKE '%test%' 
   OR email LIKE '%user%'
   OR role = 'USER';

-- Étape 4 : Mettre à jour l'email dans Supabase Authentication
-- ⚠️ IMPORTANT : Cette étape doit être faite manuellement dans Supabase Dashboard
-- 1. Allez sur Authentication > Users
-- 2. Trouvez l'utilisateur avec l'ancien email
-- 3. Cliquez sur "Edit" et changez l'email en "pierre.servant@ogf.fr"
-- 4. Sauvegardez

-- Vérification
SELECT 
  p.id,
  p.email,
  p.full_name,
  p.role,
  t.name as tenant_name
FROM profiles p
LEFT JOIN tenants t ON p.tenant_id = t.id
WHERE p.email = 'pierre.servant@ogf.fr' OR t.name = 'OGF';
