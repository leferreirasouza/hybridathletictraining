
CREATE TABLE public.equipment_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  equipment jsonb NOT NULL DEFAULT '{}'::jsonb,
  run_type_weights jsonb NOT NULL DEFAULT '{"easy":0.6,"tempo":0.15,"interval":0.1,"long":0.15,"fartlek":0}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipment_presets TO authenticated;
GRANT ALL ON public.equipment_presets TO service_role;

ALTER TABLE public.equipment_presets ENABLE ROW LEVEL SECURITY;

-- Anyone in the org (athlete/coach/admin/master_admin) can view presets
CREATE POLICY "Org members can view presets" ON public.equipment_presets
  FOR SELECT TO authenticated
  USING (
    has_org_role(auth.uid(), organization_id, 'athlete'::app_role)
    OR has_org_role(auth.uid(), organization_id, 'coach'::app_role)
    OR has_org_role(auth.uid(), organization_id, 'admin'::app_role)
    OR has_org_role(auth.uid(), organization_id, 'master_admin'::app_role)
    OR has_role(auth.uid(), 'master_admin'::app_role)
  );

CREATE POLICY "Coaches and admins can insert presets" ON public.equipment_presets
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND (
      has_org_role(auth.uid(), organization_id, 'coach'::app_role)
      OR has_org_role(auth.uid(), organization_id, 'admin'::app_role)
      OR has_org_role(auth.uid(), organization_id, 'master_admin'::app_role)
      OR has_role(auth.uid(), 'master_admin'::app_role)
    )
  );

CREATE POLICY "Coaches and admins can update presets" ON public.equipment_presets
  FOR UPDATE TO authenticated
  USING (
    has_org_role(auth.uid(), organization_id, 'coach'::app_role)
    OR has_org_role(auth.uid(), organization_id, 'admin'::app_role)
    OR has_org_role(auth.uid(), organization_id, 'master_admin'::app_role)
    OR has_role(auth.uid(), 'master_admin'::app_role)
  );

CREATE POLICY "Coaches and admins can delete presets" ON public.equipment_presets
  FOR DELETE TO authenticated
  USING (
    has_org_role(auth.uid(), organization_id, 'coach'::app_role)
    OR has_org_role(auth.uid(), organization_id, 'admin'::app_role)
    OR has_org_role(auth.uid(), organization_id, 'master_admin'::app_role)
    OR has_role(auth.uid(), 'master_admin'::app_role)
  );

CREATE TRIGGER update_equipment_presets_updated_at
  BEFORE UPDATE ON public.equipment_presets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_equipment_presets_org ON public.equipment_presets(organization_id);
