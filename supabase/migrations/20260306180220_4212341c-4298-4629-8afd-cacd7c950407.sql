
-- Allow admins/master_admins to view all assignments in their org
CREATE POLICY "Admins view org assignments"
  ON public.coach_athlete_assignments
  FOR SELECT
  USING (
    has_org_role(auth.uid(), organization_id, 'admin'::app_role)
    OR has_org_role(auth.uid(), organization_id, 'master_admin'::app_role)
  );
