-- ============================================
-- DÉSACTIVER LE PROMPT ADVISOR (LEGACY)
-- Le flux utilise désormais analysis_codegen + analysis_reco.
-- ============================================

UPDATE system_prompts
SET is_active = false
WHERE module_code = 'stock'
  AND prompt_type = 'advisor';
