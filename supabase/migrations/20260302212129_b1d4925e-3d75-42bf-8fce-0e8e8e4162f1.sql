
-- Fix permissive RLS policies

-- Organizations: only authenticated users can create orgs
DROP POLICY "Admins can create orgs" ON public.organizations;
CREATE POLICY "Authenticated users can create orgs" ON public.organizations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Audit logs: only authenticated users can insert
DROP POLICY "System inserts audit" ON public.audit_logs;
CREATE POLICY "Authenticated users insert audit" ON public.audit_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
