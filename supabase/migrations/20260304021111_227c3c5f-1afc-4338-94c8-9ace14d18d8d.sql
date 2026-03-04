-- 1. Remove the overly permissive org listing policy (any authenticated user can see ALL orgs)
DROP POLICY IF EXISTS "Authenticated users can list orgs" ON public.organizations;

-- 2. Remove the dangerous self-role-assignment policy (users can give themselves any role)
DROP POLICY IF EXISTS "Users can insert own role" ON public.user_roles;