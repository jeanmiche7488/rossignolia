import { z } from "zod";

/**
 * Schema for analyses table
 * Represents a stock analysis session
 */
export const analysisSchema = z.object({
  id: z.string().uuid().optional(),
  tenant_id: z.string().uuid(),
  name: z.string().min(1, "Le nom de l'analyse est requis"),
  status: z.enum(["pending", "processing", "completed", "failed"]).default("pending"),
  file_name: z.string().nullable().optional(),
  file_type: z.string().nullable().optional(),
  original_columns: z.record(z.unknown()).nullable().optional(),
  mapped_columns: z.record(z.unknown()).nullable().optional(),
  metadata: z.record(z.unknown()).default({}),
  created_by: z.string().uuid().nullable().optional(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export type Analysis = z.infer<typeof analysisSchema>;

/**
 * Schema for creating a new analysis
 */
export const createAnalysisSchema = analysisSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type CreateAnalysisInput = z.infer<typeof createAnalysisSchema>;

/**
 * Schema for updating an analysis
 */
export const updateAnalysisSchema = analysisSchema.partial().required({
  id: true,
});

export type UpdateAnalysisInput = z.infer<typeof updateAnalysisSchema>;
