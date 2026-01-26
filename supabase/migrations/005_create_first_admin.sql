-- ============================================
-- CREATE FIRST ADMIN USER
-- Script pour créer le premier tenant et utilisateur SUPER_ADMIN
-- ============================================
-- 
-- INSTRUCTIONS :
-- 1. Créez d'abord un utilisateur dans Supabase Dashboard > Authentication > Users
-- 2. Notez l'ID de l'utilisateur créé
-- 3. Remplacez 'USER_ID_FROM_SUPABASE_AUTH' ci-dessous par l'ID réel
-- 4. Exécutez ce script dans Supabase SQL Editor
--
-- ============================================

-- Étape 1 : Créer le premier tenant (organisation)
INSERT INTO tenants (name, slug)
VALUES (
  'Organisation Principale',
  'main-org'
)
ON CONFLICT (slug) DO NOTHING
RETURNING id;

-- Note: Copiez l'ID du tenant créé ci-dessus

-- Étape 2 : Créer le profil SUPER_ADMIN
-- ⚠️ REMPLACEZ 'USER_ID_FROM_SUPABASE_AUTH' par l'ID de l'utilisateur créé dans Authentication
-- ⚠️ REMPLACEZ 'TENANT_ID_FROM_STEP_1' par l'ID du tenant créé à l'étape 1
-- ⚠️ REMPLACEZ 'admin@example.com' par l'email de l'utilisateur

INSERT INTO profiles (
  id,
  tenant_id,
  email,
  full_name,
  role
)
VALUES (
  'USER_ID_FROM_SUPABASE_AUTH',  -- ⚠️ À REMPLACER
  'TENANT_ID_FROM_STEP_1',        -- ⚠️ À REMPLACER
  'admin@example.com',            -- ⚠️ À REMPLACER
  'Administrateur Principal',
  'SUPER_ADMIN'
)
ON CONFLICT (id) DO UPDATE
SET role = 'SUPER_ADMIN';

-- ============================================
-- VÉRIFICATION
-- ============================================
-- Exécutez cette requête pour vérifier que tout est correct :
-- 
-- SELECT 
--   p.id,
--   p.email,
--   p.full_name,
--   p.role,
--   t.name as tenant_name
-- FROM profiles p
-- JOIN tenants t ON p.tenant_id = t.id
-- WHERE p.role = 'SUPER_ADMIN';
