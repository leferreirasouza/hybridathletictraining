
-- Allow coaches/admins to insert targets
CREATE POLICY "Coaches can insert targets"
ON public.targets
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM plan_versions pv
    JOIN training_plans tp ON tp.id = pv.plan_id
    WHERE pv.id = targets.plan_version_id
    AND (
      has_org_role(auth.uid(), tp.organization_id, 'coach'::app_role)
      OR has_org_role(auth.uid(), tp.organization_id, 'master_admin'::app_role)
    )
  )
);

-- Allow coaches/admins to insert garmin workouts
CREATE POLICY "Coaches can insert garmin workouts"
ON public.garmin_workouts
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM plan_versions pv
    JOIN training_plans tp ON tp.id = pv.plan_id
    WHERE pv.id = garmin_workouts.plan_version_id
    AND (
      has_org_role(auth.uid(), tp.organization_id, 'coach'::app_role)
      OR has_org_role(auth.uid(), tp.organization_id, 'master_admin'::app_role)
    )
  )
);

-- Create weekly_summaries table for imported weekly aggregate data
CREATE TABLE public.weekly_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_version_id UUID NOT NULL REFERENCES public.plan_versions(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL DEFAULT 1,
  week_start DATE,
  week_end DATE,
  run_km_target NUMERIC,
  run_days TEXT,
  bike_z2_min_target NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.weekly_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view weekly summaries"
ON public.weekly_summaries
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM plan_versions pv
    JOIN training_plans tp ON tp.id = pv.plan_id
    JOIN user_roles ur ON ur.organization_id = tp.organization_id
    WHERE pv.id = weekly_summaries.plan_version_id
    AND ur.user_id = auth.uid()
  )
);

CREATE POLICY "Coaches can insert weekly summaries"
ON public.weekly_summaries
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM plan_versions pv
    JOIN training_plans tp ON tp.id = pv.plan_id
    WHERE pv.id = weekly_summaries.plan_version_id
    AND (
      has_org_role(auth.uid(), tp.organization_id, 'coach'::app_role)
      OR has_org_role(auth.uid(), tp.organization_id, 'master_admin'::app_role)
    )
  )
);
