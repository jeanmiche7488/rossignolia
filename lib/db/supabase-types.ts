// Types for our database schema
export type Database = {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string;
          name: string;
          slug: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          tenant_id: string;
          email: string;
          full_name: string | null;
          role: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          tenant_id: string;
          email: string;
          full_name?: string | null;
          role?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          email?: string;
          full_name?: string | null;
          role?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      analyses: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          status: string;
          file_name: string | null;
          file_type: string | null;
          original_columns: Record<string, unknown> | null;
          mapped_columns: Record<string, unknown> | null;
          metadata: Record<string, unknown>;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          status?: string;
          file_name?: string | null;
          file_type?: string | null;
          original_columns?: Record<string, unknown> | null;
          mapped_columns?: Record<string, unknown> | null;
          metadata?: Record<string, unknown>;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          name?: string;
          status?: string;
          file_name?: string | null;
          file_type?: string | null;
          original_columns?: Record<string, unknown> | null;
          mapped_columns?: Record<string, unknown> | null;
          metadata?: Record<string, unknown>;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      stock_entries: {
        Row: {
          id: string;
          tenant_id: string;
          analysis_id: string;
          sku: string | null;
          product_name: string | null;
          quantity: number | null;
          unit_cost: number | null;
          total_value: number | null;
          location: string | null;
          category: string | null;
          supplier: string | null;
          last_movement_date: string | null;
          days_since_last_movement: number | null;
          attributes: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          analysis_id: string;
          sku?: string | null;
          product_name?: string | null;
          quantity?: number | null;
          unit_cost?: number | null;
          total_value?: number | null;
          location?: string | null;
          category?: string | null;
          supplier?: string | null;
          last_movement_date?: string | null;
          days_since_last_movement?: number | null;
          attributes?: Record<string, unknown>;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          analysis_id?: string;
          sku?: string | null;
          product_name?: string | null;
          quantity?: number | null;
          unit_cost?: number | null;
          total_value?: number | null;
          location?: string | null;
          category?: string | null;
          supplier?: string | null;
          last_movement_date?: string | null;
          days_since_last_movement?: number | null;
          attributes?: Record<string, unknown>;
          created_at?: string;
        };
      };
      recommendations: {
        Row: {
          id: string;
          tenant_id: string;
          analysis_id: string;
          type: string;
          priority: string;
          title: string;
          description: string;
          action_items: unknown[];
          affected_skus: unknown[];
          estimated_impact: Record<string, unknown>;
          python_code: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          analysis_id: string;
          type: string;
          priority?: string;
          title: string;
          description: string;
          action_items?: unknown[];
          affected_skus?: unknown[];
          estimated_impact?: Record<string, unknown>;
          python_code?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          analysis_id?: string;
          type?: string;
          priority?: string;
          title?: string;
          description?: string;
          action_items?: unknown[];
          affected_skus?: unknown[];
          estimated_impact?: Record<string, unknown>;
          python_code?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
};
