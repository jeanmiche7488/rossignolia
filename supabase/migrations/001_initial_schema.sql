-- ============================================
-- ROSSIGNOLIA - Initial Schema
-- Multi-Tenant SaaS Platform for Logistics Intelligence
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- SYSTEM LAYER
-- ============================================

-- Tenants table (organizations)
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Modules table (available modules: stock, demand-planning, transport, supplier-risk)
CREATE TABLE modules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL, -- 'stock', 'demand-planning', etc.
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tenant modules (which modules are enabled for each tenant)
CREATE TABLE tenant_modules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, module_id)
);

-- Profiles (extends Supabase auth.users)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'USER', -- 'SUPER_ADMIN', 'ADMIN', 'USER'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- System prompts (AI prompts stored in DB for flexibility)
CREATE TABLE system_prompts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, -- NULL = global prompt
    module_code TEXT NOT NULL, -- 'stock', etc.
    prompt_type TEXT NOT NULL, -- 'mapping', 'cleaning', 'advisor'
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    config JSONB DEFAULT '{}'::jsonb, -- temperature, topK, etc.
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- STOCK HEALTH MODULE
-- ============================================

-- Analyses (main analysis records)
CREATE TABLE analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    file_name TEXT,
    file_type TEXT, -- 'csv', 'xlsx', etc.
    original_columns JSONB, -- Original column names from file
    mapped_columns JSONB, -- Mapped columns after AI mapping
    metadata JSONB DEFAULT '{}'::jsonb, -- Additional metadata
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stock entries (individual stock items from uploaded files)
CREATE TABLE stock_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    analysis_id UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
    sku TEXT,
    product_name TEXT,
    quantity NUMERIC,
    unit_cost NUMERIC,
    total_value NUMERIC,
    location TEXT,
    category TEXT,
    supplier TEXT,
    last_movement_date DATE,
    days_since_last_movement INTEGER,
    attributes JSONB DEFAULT '{}'::jsonb, -- Unmapped columns preserved here
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recommendations (AI-generated recommendations)
CREATE TABLE recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    analysis_id UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'dormant', 'slow-moving', 'overstock', 'understock', etc.
    priority TEXT NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    action_items JSONB DEFAULT '[]'::jsonb, -- Array of action items
    affected_skus JSONB DEFAULT '[]'::jsonb, -- Array of SKUs affected
    estimated_impact JSONB DEFAULT '{}'::jsonb, -- Financial impact, etc.
    python_code TEXT, -- White box: Python code that generated this recommendation
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'in-progress', 'completed', 'dismissed'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

-- Tenant isolation indexes
CREATE INDEX idx_tenant_modules_tenant_id ON tenant_modules(tenant_id);
CREATE INDEX idx_profiles_tenant_id ON profiles(tenant_id);
CREATE INDEX idx_analyses_tenant_id ON analyses(tenant_id);
CREATE INDEX idx_stock_entries_tenant_id ON stock_entries(tenant_id);
CREATE INDEX idx_stock_entries_analysis_id ON stock_entries(analysis_id);
CREATE INDEX idx_recommendations_tenant_id ON recommendations(tenant_id);
CREATE INDEX idx_recommendations_analysis_id ON recommendations(analysis_id);
CREATE INDEX idx_system_prompts_tenant_id ON system_prompts(tenant_id);

-- Performance indexes
CREATE INDEX idx_analyses_status ON analyses(status);
CREATE INDEX idx_stock_entries_sku ON stock_entries(sku);
CREATE INDEX idx_recommendations_type ON recommendations(type);
CREATE INDEX idx_recommendations_status ON recommendations(status);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Helper function to get current user's tenant_id
CREATE OR REPLACE FUNCTION get_user_tenant_id()
RETURNS UUID AS $$
    SELECT tenant_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper function to check if user is SUPER_ADMIN
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
    SELECT role = 'SUPER_ADMIN' FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- TENANTS policies
-- SUPER_ADMIN can see all tenants
CREATE POLICY "Super admins can view all tenants"
    ON tenants FOR SELECT
    USING (is_super_admin());

-- Users can only see their own tenant
CREATE POLICY "Users can view their own tenant"
    ON tenants FOR SELECT
    USING (id = get_user_tenant_id());

-- SUPER_ADMIN can insert tenants
CREATE POLICY "Super admins can insert tenants"
    ON tenants FOR INSERT
    WITH CHECK (is_super_admin());

-- SUPER_ADMIN can update tenants
CREATE POLICY "Super admins can update tenants"
    ON tenants FOR UPDATE
    USING (is_super_admin());

-- MODULES policies (read-only for all authenticated users)
CREATE POLICY "Authenticated users can view modules"
    ON modules FOR SELECT
    USING (auth.role() = 'authenticated');

-- TENANT_MODULES policies
CREATE POLICY "Users can view their tenant modules"
    ON tenant_modules FOR SELECT
    USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Super admins can manage tenant modules"
    ON tenant_modules FOR ALL
    USING (is_super_admin());

-- PROFILES policies
CREATE POLICY "Users can view profiles in their tenant"
    ON profiles FOR SELECT
    USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update their own profile"
    ON profiles FOR UPDATE
    USING (id = auth.uid() AND tenant_id = get_user_tenant_id());

CREATE POLICY "Super admins can manage all profiles"
    ON profiles FOR ALL
    USING (is_super_admin());

-- SYSTEM_PROMPTS policies
CREATE POLICY "Users can view global and tenant prompts"
    ON system_prompts FOR SELECT
    USING (
        tenant_id IS NULL OR 
        tenant_id = get_user_tenant_id() OR
        is_super_admin()
    );

CREATE POLICY "Super admins can manage prompts"
    ON system_prompts FOR ALL
    USING (is_super_admin());

-- ANALYSES policies
CREATE POLICY "Users can view analyses in their tenant"
    ON analyses FOR SELECT
    USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create analyses in their tenant"
    ON analyses FOR INSERT
    WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update analyses in their tenant"
    ON analyses FOR UPDATE
    USING (tenant_id = get_user_tenant_id());

-- STOCK_ENTRIES policies
CREATE POLICY "Users can view stock entries in their tenant"
    ON stock_entries FOR SELECT
    USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create stock entries in their tenant"
    ON stock_entries FOR INSERT
    WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update stock entries in their tenant"
    ON stock_entries FOR UPDATE
    USING (tenant_id = get_user_tenant_id());

-- RECOMMENDATIONS policies
CREATE POLICY "Users can view recommendations in their tenant"
    ON recommendations FOR SELECT
    USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create recommendations in their tenant"
    ON recommendations FOR INSERT
    WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update recommendations in their tenant"
    ON recommendations FOR UPDATE
    USING (tenant_id = get_user_tenant_id());

-- ============================================
-- TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_prompts_updated_at BEFORE UPDATE ON system_prompts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_analyses_updated_at BEFORE UPDATE ON analyses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recommendations_updated_at BEFORE UPDATE ON recommendations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
