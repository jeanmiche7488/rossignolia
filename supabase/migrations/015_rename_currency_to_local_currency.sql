-- Rename currency to local_currency for clarity
-- local_currency: ISO code of the unit cost currency (EUR, USD, etc.) - can be mapped or inferred from column names
-- unit_cost is now conceptually "Unit Cost Local Currency" (the cost in the original currency)
-- unit_cost_eur is a CALCULATED field (converted to EUR), not mapped

-- Rename the column
ALTER TABLE stock_entries
  RENAME COLUMN currency TO local_currency;

-- Update comments
COMMENT ON COLUMN stock_entries.unit_cost IS 'Unit cost in local currency (the original currency from the source file)';
COMMENT ON COLUMN stock_entries.local_currency IS 'ISO currency code (e.g. EUR, USD). Can be mapped from a column or inferred from column names like "Cost USD".';
COMMENT ON COLUMN stock_entries.unit_cost_eur IS 'Unit cost converted to EUR. This is a CALCULATED field: equals unit_cost when local_currency is EUR; otherwise converted or null.';
