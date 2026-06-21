
-- Fix privilege escalation: prevent admins from upgrading roles to master_admin via UPDATE
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
CREATE POLICY "Admins can update roles" ON public.user_roles
FOR UPDATE
USING (
  has_org_role(auth.uid(), organization_id, 'admin'::app_role)
  OR has_org_role(auth.uid(), organization_id, 'master_admin'::app_role)
)
WITH CHECK (
  has_org_role(auth.uid(), organization_id, 'master_admin'::app_role)
  OR (
    has_org_role(auth.uid(), organization_id, 'admin'::app_role)
    AND role = ANY (ARRAY['coach'::app_role, 'athlete'::app_role])
  )
);

-- Fix audit_logs: prevent forging entries as other users
DROP POLICY IF EXISTS "Authenticated users insert audit" ON public.audit_logs;
CREATE POLICY "Authenticated users insert own audit" ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());
