-- 1. Function to list active organizations (safe for onboarding, no sensitive data exposed)
CREATE OR REPLACE FUNCTION public.list_active_organizations()
RETURNS TABLE(id uuid, name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name FROM public.organizations WHERE is_active = true ORDER BY name;
$$;

-- 2. Function to safely assign onboarding role (only athlete or coach allowed)
CREATE OR REPLACE FUNCTION public.assign_onboarding_role(_org_id uuid, _role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow athlete or coach roles during onboarding
  IF _role NOT IN ('athlete', 'coach') THEN
    RAISE EXCEPTION 'Invalid role for onboarding';
  END IF;

  -- Verify the organization exists and is active
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = _org_id AND is_active = true) THEN
    RAISE EXCEPTION 'Organization not found or inactive';
  END IF;

  -- Prevent duplicate role assignments
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND organization_id = _org_id) THEN
    RAISE EXCEPTION 'Already assigned to this organization';
  END IF;

  INSERT INTO public.user_roles (user_id, organization_id, role)
  VALUES (auth.uid(), _org_id, _role::app_role);
END;
$$;