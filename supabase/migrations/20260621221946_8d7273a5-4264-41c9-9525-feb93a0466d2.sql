
-- 1. Fix mutable search_path on session_trimp
ALTER FUNCTION public.session_trimp(numeric, integer, integer, integer, integer) SET search_path = public;

-- 2. Revoke anon EXECUTE on SECURITY DEFINER RPCs (keep authenticated where needed)
REVOKE EXECUTE ON FUNCTION public.admin_delete_athlete(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_get_cron_jobs() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_get_cron_runs(text, integer) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.assign_onboarding_role(uuid, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.list_active_organizations() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, app_role) FROM anon, PUBLIC;

-- Internal helpers — not callable from API
REVOKE EXECUTE ON FUNCTION public.recompute_training_load(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_recompute_training_load() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_delete_athlete(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_cron_jobs() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_cron_runs(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_onboarding_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_active_organizations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, app_role) TO authenticated;

-- 3. Fix privilege escalation on user_roles: only admin/master_admin may insert,
--    and coaches/admins cannot create master_admin assignments
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  (
    has_org_role(auth.uid(), organization_id, 'master_admin'::app_role)
  )
  OR (
    has_org_role(auth.uid(), organization_id, 'admin'::app_role)
    AND role IN ('coach'::app_role, 'athlete'::app_role)
  )
);

-- 4. Avatars: remove broad listing policy. Files remain accessible via public bucket URLs;
--    only listing/metadata enumeration is removed.
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
