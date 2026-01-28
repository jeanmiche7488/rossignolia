-- Add currency and unit_cost_eur to stock_entries
-- currency: ISO code of the unit cost (EUR, USD, etc.) when different currencies are present
-- unit_cost_eur: unit cost normalized in EUR (same as unit_cost when currency is EUR, else converted or null)

ALTER TABLE stock_entries
  ADD COLUMN IF NOT EXISTS currency TEXT,
  ADD COLUMN IF NOT EXISTS unit_cost_eur NUMERIC;

COMMENT ON COLUMN stock_entries.currency IS 'ISO currency code of unit_cost (e.g. EUR, USD). Used when multiple currencies are detected.';
COMMENT ON COLUMN stock_entries.unit_cost_eur IS 'Unit cost in EUR. Equal to unit_cost when currency is EUR; otherwise converted or null.';
