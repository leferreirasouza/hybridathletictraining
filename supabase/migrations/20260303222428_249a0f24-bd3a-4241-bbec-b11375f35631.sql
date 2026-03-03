
-- 1. profiles: DELETE (master_admin only)
CREATE POLICY "Only admins can delete profiles"
ON public.profiles FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'master_admin'::app_role));

-- 2. organizations: DELETE (master_admin only)
CREATE POLICY "Master admins can delete orgs"
ON public.organizations FOR DELETE TO authenticated
USING (public.has_org_role(auth.uid(), id, 'master_admin'::app_role));

-- 3. training_plans: DELETE
CREATE POLICY "Coaches and admins can delete plans"
ON public.training_plans FOR DELETE TO authenticated
USING (
  public.has_org_role(auth.uid(), organization_id, 'coach'::app_role)
  OR public.has_org_role(auth.uid(), organization_id, 'admin'::app_role)
  OR public.has_org_role(auth.uid(), organization_id, 'master_admin'::app_role)
);

-- 4. coach_athlete_assignments: UPDATE + DELETE
CREATE POLICY "Coaches and admins can update assignments"
ON public.coach_athlete_assignments FOR UPDATE TO authenticated
USING (
  public.has_org_role(auth.uid(), organization_id, 'coach'::app_role)
  OR public.has_org_role(auth.uid(), organization_id, 'admin'::app_role)
  OR public.has_org_role(auth.uid(), organization_id, 'master_admin'::app_role)
);
CREATE POLICY "Coaches and admins can delete assignments"
ON public.coach_athlete_assignments FOR DELETE TO authenticated
USING (
  public.has_org_role(auth.uid(), organization_id, 'coach'::app_role)
  OR public.has_org_role(auth.uid(), organization_id, 'admin'::app_role)
  OR public.has_org_role(auth.uid(), organization_id, 'master_admin'::app_role)
);

-- 5. plan_versions: UPDATE + DELETE
CREATE POLICY "Coaches and admins can update versions"
ON public.plan_versions FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM training_plans tp WHERE tp.id = plan_versions.plan_id AND (public.has_org_role(auth.uid(), tp.organization_id, 'coach'::app_role) OR public.has_org_role(auth.uid(), tp.organization_id, 'admin'::app_role) OR public.has_org_role(auth.uid(), tp.organization_id, 'master_admin'::app_role))));
CREATE POLICY "Coaches and admins can delete versions"
ON public.plan_versions FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM training_plans tp WHERE tp.id = plan_versions.plan_id AND (public.has_org_role(auth.uid(), tp.organization_id, 'coach'::app_role) OR public.has_org_role(auth.uid(), tp.organization_id, 'admin'::app_role) OR public.has_org_role(auth.uid(), tp.organization_id, 'master_admin'::app_role))));

-- 6. targets: UPDATE + DELETE
CREATE POLICY "Coaches and admins can update targets"
ON public.targets FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM plan_versions pv JOIN training_plans tp ON tp.id = pv.plan_id WHERE pv.id = targets.plan_version_id AND (public.has_org_role(auth.uid(), tp.organization_id, 'coach'::app_role) OR public.has_org_role(auth.uid(), tp.organization_id, 'admin'::app_role) OR public.has_org_role(auth.uid(), tp.organization_id, 'master_admin'::app_role))));
CREATE POLICY "Coaches and admins can delete targets"
ON public.targets FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM plan_versions pv JOIN training_plans tp ON tp.id = pv.plan_id WHERE pv.id = targets.plan_version_id AND (public.has_org_role(auth.uid(), tp.organization_id, 'coach'::app_role) OR public.has_org_role(auth.uid(), tp.organization_id, 'admin'::app_role) OR public.has_org_role(auth.uid(), tp.organization_id, 'master_admin'::app_role))));

-- 7. garmin_workouts: UPDATE + DELETE
CREATE POLICY "Coaches and admins can update garmin workouts"
ON public.garmin_workouts FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM plan_versions pv JOIN training_plans tp ON tp.id = pv.plan_id WHERE pv.id = garmin_workouts.plan_version_id AND (public.has_org_role(auth.uid(), tp.organization_id, 'coach'::app_role) OR public.has_org_role(auth.uid(), tp.organization_id, 'admin'::app_role) OR public.has_org_role(auth.uid(), tp.organization_id, 'master_admin'::app_role))));
CREATE POLICY "Coaches and admins can delete garmin workouts"
ON public.garmin_workouts FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM plan_versions pv JOIN training_plans tp ON tp.id = pv.plan_id WHERE pv.id = garmin_workouts.plan_version_id AND (public.has_org_role(auth.uid(), tp.organization_id, 'coach'::app_role) OR public.has_org_role(auth.uid(), tp.organization_id, 'admin'::app_role) OR public.has_org_role(auth.uid(), tp.organization_id, 'master_admin'::app_role))));

-- 8. weekly_summaries: UPDATE + DELETE
CREATE POLICY "Coaches and admins can update weekly summaries"
ON public.weekly_summaries FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM plan_versions pv JOIN training_plans tp ON tp.id = pv.plan_id WHERE pv.id = weekly_summaries.plan_version_id AND (public.has_org_role(auth.uid(), tp.organization_id, 'coach'::app_role) OR public.has_org_role(auth.uid(), tp.organization_id, 'admin'::app_role) OR public.has_org_role(auth.uid(), tp.organization_id, 'master_admin'::app_role))));
CREATE POLICY "Coaches and admins can delete weekly summaries"
ON public.weekly_summaries FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM plan_versions pv JOIN training_plans tp ON tp.id = pv.plan_id WHERE pv.id = weekly_summaries.plan_version_id AND (public.has_org_role(auth.uid(), tp.organization_id, 'coach'::app_role) OR public.has_org_role(auth.uid(), tp.organization_id, 'admin'::app_role) OR public.has_org_role(auth.uid(), tp.organization_id, 'master_admin'::app_role))));

-- 9. direct_messages: DELETE for senders (GDPR)
CREATE POLICY "Senders can delete own messages"
ON public.direct_messages FOR DELETE TO authenticated
USING (sender_id = auth.uid());
