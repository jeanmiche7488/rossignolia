import { z } from "zod";

/**
 * Schema for stock_entries table
 * Represents individual stock items from uploaded files
 */
export const stockEntrySchema = z.object({
  id: z.string().uuid().optional(),
  tenant_id: z.string().uuid(),
  analysis_id: z.string().uuid(),
  sku: z.string().nullable().optional(),
  product_name: z.string().nullable().optional(),
  quantity: z.number().nullable().optional(),
  unit_cost: z.number().nullable().optional(),
  currency: z.string().nullable().optional(),
  unit_cost_eur: z.number().nullable().optional(),
  total_value: z.number().nullable().optional(),
  location: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  supplier: z.string().nullable().optional(),
  last_movement_date: z.string().date().nullable().optional(),
  days_since_last_movement: z.number().int().nullable().optional(),
  attributes: z.record(z.unknown()).default({}),
  created_at: z.string().datetime().optional(),
});

export type StockEntry = z.infer<typeof stockEntrySchema>;

/**
 * Schema for creating a new stock entry
 */
export const createStockEntrySchema = stockEntrySchema.omit({
  id: true,
  created_at: true,
});

export type CreateStockEntryInput = z.infer<typeof createStockEntrySchema>;

/**
 * Schema for bulk creating stock entries
 */
export const bulkCreateStockEntriesSchema = z.object({
  entries: z.array(createStockEntrySchema).min(1),
});

export type BulkCreateStockEntriesInput = z.infer<typeof bulkCreateStockEntriesSchema>;

/**
 * Schema for updating a stock entry
 */
export const updateStockEntrySchema = stockEntrySchema.partial().required({
  id: true,
});

export type UpdateStockEntryInput = z.infer<typeof updateStockEntrySchema>;
