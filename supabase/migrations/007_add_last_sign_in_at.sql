-- ============================================
-- Add last_sign_in_at to profiles via function
-- ============================================

-- Create a function to get last_sign_in_at from auth.users
CREATE OR REPLACE FUNCTION get_user_last_sign_in(user_id UUID)
RETURNS TIMESTAMPTZ AS $$
  SELECT last_sign_in_at FROM auth.users WHERE id = user_id;
$$ LANGUAGE sql STABLE;

-- Add a computed column or use the function directly in queries
-- For now, we'll use the function in queries

-- Create a view that includes last_sign_in_at
CREATE OR REPLACE VIEW profiles_with_last_sign_in AS
SELECT 
  p.*,
  get_user_last_sign_in(p.id) as last_sign_in_at
FROM profiles p;

-- Grant access to the view
GRANT SELECT ON profiles_with_last_sign_in TO authenticated;
