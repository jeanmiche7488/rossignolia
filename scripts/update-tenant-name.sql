-- ============================================
-- UPDATE TENANT NAME TO "OGF"
-- ============================================
-- 
-- Ce script met à jour le nom du tenant pour l'utilisateur actuel
-- Remplacez 'VOTRE_TENANT_ID' par l'ID réel de votre tenant
--
-- Pour trouver votre tenant_id :
-- SELECT tenant_id FROM profiles WHERE email = 'votre-email@example.com';
--
-- ============================================

-- Option 1 : Mettre à jour tous les tenants (si vous n'avez qu'un seul tenant)
UPDATE tenants
SET name = 'OGF'
WHERE id IN (
  SELECT DISTINCT tenant_id 
  FROM profiles 
  WHERE tenant_id IS NOT NULL
);

-- Option 2 : Mettre à jour un tenant spécifique (recommandé)
-- Remplacez 'VOTRE_TENANT_ID' par l'ID réel
-- UPDATE tenants
-- SET name = 'OGF'
-- WHERE id = 'VOTRE_TENANT_ID';

-- Vérification
SELECT id, name, slug FROM tenants;
