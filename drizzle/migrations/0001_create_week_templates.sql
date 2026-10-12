CREATE TABLE IF NOT EXISTS public.week_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  name text NOT NULL,
  sessions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.week_templates TO authenticated;
GRANT ALL ON public.week_templates TO service_role;
ALTER TABLE public.week_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org staff read week templates" ON public.week_templates;
CREATE POLICY "Org staff read week templates" ON public.week_templates FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'master_admin')
  OR public.has_org_role(auth.uid(), organization_id, 'admin')
  OR public.has_org_role(auth.uid(), organization_id, 'coach'));

DROP POLICY IF EXISTS "Org staff create week templates" ON public.week_templates;
CREATE POLICY "Org staff create week templates" ON public.week_templates FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() AND (public.has_role(auth.uid(), 'master_admin')
  OR public.has_org_role(auth.uid(), organization_id, 'admin')
  OR public.has_org_role(auth.uid(), organization_id, 'coach')));

DROP POLICY IF EXISTS "Org staff update week templates" ON public.week_templates;
CREATE POLICY "Org staff update week templates" ON public.week_templates FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'master_admin')
  OR public.has_org_role(auth.uid(), organization_id, 'admin')
  OR public.has_org_role(auth.uid(), organization_id, 'coach'));

DROP POLICY IF EXISTS "Org staff delete week templates" ON public.week_templates;
CREATE POLICY "Org staff delete week templates" ON public.week_templates FOR DELETE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'master_admin')
  OR public.has_org_role(auth.uid(), organization_id, 'admin'));

DROP TRIGGER IF EXISTS week_templates_updated_at ON public.week_templates;
CREATE TRIGGER week_templates_updated_at BEFORE UPDATE ON public.week_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();