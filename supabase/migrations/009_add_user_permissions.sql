-- ============================================
-- Add permissions field to profiles
-- ============================================

-- Add permissions JSONB field to profiles
-- Structure: { "modules": { "stock": { "read": true, "write": true }, ... } }
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'::jsonb;

-- Create index for permissions queries
CREATE INDEX IF NOT EXISTS idx_profiles_permissions ON profiles USING GIN (permissions);

-- Add comment
COMMENT ON COLUMN profiles.permissions IS 'User permissions per module: { "modules": { "module_code": { "read": boolean, "write": boolean } } }';
