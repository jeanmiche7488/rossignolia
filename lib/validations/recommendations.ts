import { z } from "zod";

/**
 * Schema for recommendations table
 * Represents AI-generated recommendations for stock management
 */
export const recommendationSchema = z.object({
  id: z.string().uuid().optional(),
  tenant_id: z.string().uuid(),
  analysis_id: z.string().uuid(),
  type: z.enum([
    "dormant",
    "slow-moving",
    "overstock",
    "understock",
    "obsolete",
    "high-value",
    "low-rotation",
  ]),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  title: z.string().min(1, "Le titre est requis"),
  description: z.string().min(1, "La description est requise"),
  action_items: z.array(z.unknown()).default([]),
  affected_skus: z.array(z.unknown()).default([]),
  estimated_impact: z.record(z.unknown()).default({}),
  python_code: z.string().nullable().optional(),
  status: z.enum(["pending", "in-progress", "completed", "dismissed"]).default("pending"),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export type Recommendation = z.infer<typeof recommendationSchema>;

/**
 * Schema for creating a new recommendation
 */
export const createRecommendationSchema = recommendationSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type CreateRecommendationInput = z.infer<typeof createRecommendationSchema>;

/**
 * Schema for updating a recommendation
 */
export const updateRecommendationSchema = recommendationSchema.partial().required({
  id: true,
});

export type UpdateRecommendationInput = z.infer<typeof updateRecommendationSchema>;

/**
 * Schema for recommendation action items (more specific)
 */
export const actionItemSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  due_date: z.string().date().optional(),
  assigned_to: z.string().uuid().optional(),
});

export type ActionItem = z.infer<typeof actionItemSchema>;

/**
 * Schema for estimated impact
 */
export const estimatedImpactSchema = z.object({
  financial_impact: z.number().optional(),
  currency: z.string().default("EUR"),
  potential_savings: z.number().optional(),
  risk_level: z.enum(["low", "medium", "high"]).optional(),
  timeframe: z.string().optional(),
});

export type EstimatedImpact = z.infer<typeof estimatedImpactSchema>;
