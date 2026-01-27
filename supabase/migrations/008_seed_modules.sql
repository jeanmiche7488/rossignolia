-- ============================================
-- Seed Modules
-- ============================================

-- Insert available modules
INSERT INTO modules (code, name, description) VALUES
  ('stock', 'Stock Health', 'Audit dormant, rotation, couverture'),
  ('demand-planning', 'Demand Planning', 'Prévisions de ventes, saisonnalité'),
  ('transport', 'Transport Control', 'Analyse des coûts de fret, optimisation chargement'),
  ('supplier-risk', 'Supplier Risk', 'Analyse fiabilité fournisseurs, délais')
ON CONFLICT (code) DO NOTHING;
