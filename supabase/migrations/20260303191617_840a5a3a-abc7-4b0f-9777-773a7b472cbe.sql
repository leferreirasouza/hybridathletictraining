-- Add coach_type column to coach_athlete_assignments
ALTER TABLE public.coach_athlete_assignments 
  ADD COLUMN IF NOT EXISTS coach_type text NOT NULL DEFAULT 'primary';

-- Add check constraint via trigger (not CHECK to avoid immutability issues)
CREATE OR REPLACE FUNCTION public.validate_coach_type()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.coach_type NOT IN ('primary', 'secondary') THEN
    RAISE EXCEPTION 'coach_type must be primary or secondary';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_coach_type
  BEFORE INSERT OR UPDATE ON public.coach_athlete_assignments
  FOR EACH ROW EXECUTE FUNCTION public.validate_coach_type();

-- Enforce max 2 coaches per athlete per org, and only 1 primary
CREATE OR REPLACE FUNCTION public.enforce_max_coaches()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF (SELECT count(*) FROM public.coach_athlete_assignments
      WHERE athlete_id = NEW.athlete_id AND organization_id = NEW.organization_id
        AND id IS DISTINCT FROM NEW.id) >= 2 THEN
    RAISE EXCEPTION 'An athlete can have at most 2 coaches per organization';
  END IF;
  IF NEW.coach_type = 'primary' AND EXISTS (
    SELECT 1 FROM public.coach_athlete_assignments
    WHERE athlete_id = NEW.athlete_id AND organization_id = NEW.organization_id 
      AND coach_type = 'primary' AND id IS DISTINCT FROM NEW.id
  ) THEN
    RAISE EXCEPTION 'An athlete can have only one primary coach per organization';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_max_coaches
  BEFORE INSERT OR UPDATE ON public.coach_athlete_assignments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_max_coaches();

-- Update RLS policies to include 'admin' role

-- coach_athlete_assignments
DROP POLICY IF EXISTS "Coaches create assignments" ON public.coach_athlete_assignments;
CREATE POLICY "Coaches and admins create assignments" ON public.coach_athlete_assignments
  FOR INSERT TO authenticated WITH CHECK (
    has_org_role(auth.uid(), organization_id, 'coach'::app_role) 
    OR has_org_role(auth.uid(), organization_id, 'admin'::app_role)
    OR has_org_role(auth.uid(), organization_id, 'master_admin'::app_role)
  );

-- training_plans
DROP POLICY IF EXISTS "Coaches can manage plans" ON public.training_plans;
CREATE POLICY "Coaches and admins can manage plans" ON public.training_plans
  FOR INSERT TO authenticated WITH CHECK (
    has_org_role(auth.uid(), organization_id, 'coach'::app_role) 
    OR has_org_role(auth.uid(), organization_id, 'admin'::app_role)
    OR has_org_role(auth.uid(), organization_id, 'master_admin'::app_role)
  );

DROP POLICY IF EXISTS "Coaches can update plans" ON public.training_plans;
CREATE POLICY "Coaches and admins can update plans" ON public.training_plans
  FOR UPDATE TO authenticated USING (
    has_org_role(auth.uid(), organization_id, 'coach'::app_role) 
    OR has_org_role(auth.uid(), organization_id, 'admin'::app_role)
    OR has_org_role(auth.uid(), organization_id, 'master_admin'::app_role)
  );

-- user_roles
DROP POLICY IF EXISTS "Admins/coaches can view org roles" ON public.user_roles;
CREATE POLICY "Admins coaches can view org roles" ON public.user_roles
  FOR SELECT TO authenticated USING (
    has_org_role(auth.uid(), organization_id, 'coach'::app_role) 
    OR has_org_role(auth.uid(), organization_id, 'admin'::app_role)
    OR has_org_role(auth.uid(), organization_id, 'master_admin'::app_role)
  );

DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (
    has_org_role(auth.uid(), organization_id, 'master_admin'::app_role) 
    OR has_org_role(auth.uid(), organization_id, 'admin'::app_role)
    OR has_org_role(auth.uid(), organization_id, 'coach'::app_role)
  );

-- organizations
DROP POLICY IF EXISTS "Admins can update orgs" ON public.organizations;
CREATE POLICY "Admins can update orgs" ON public.organizations
  FOR UPDATE TO authenticated USING (
    has_org_role(auth.uid(), id, 'master_admin'::app_role) 
    OR has_org_role(auth.uid(), id, 'admin'::app_role)
  );

-- plan_versions
DROP POLICY IF EXISTS "Coaches can create versions" ON public.plan_versions;
CREATE POLICY "Coaches and admins can create versions" ON public.plan_versions
  FOR INSERT TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM training_plans tp WHERE tp.id = plan_versions.plan_id AND (
      has_org_role(auth.uid(), tp.organization_id, 'coach'::app_role) 
      OR has_org_role(auth.uid(), tp.organization_id, 'admin'::app_role)
      OR has_org_role(auth.uid(), tp.organization_id, 'master_admin'::app_role)
    )
  ));

-- planned_sessions
DROP POLICY IF EXISTS "Coaches can manage sessions" ON public.planned_sessions;
CREATE POLICY "Coaches and admins can manage sessions" ON public.planned_sessions
  FOR ALL TO authenticated USING (EXISTS (
    SELECT 1 FROM plan_versions pv JOIN training_plans tp ON tp.id = pv.plan_id
    WHERE pv.id = planned_sessions.plan_version_id AND (
      has_org_role(auth.uid(), tp.organization_id, 'coach'::app_role) 
      OR has_org_role(auth.uid(), tp.organization_id, 'admin'::app_role)
      OR has_org_role(auth.uid(), tp.organization_id, 'master_admin'::app_role)
    )
  ));

-- session_blocks
DROP POLICY IF EXISTS "Coaches manage blocks" ON public.session_blocks;
CREATE POLICY "Coaches and admins manage blocks" ON public.session_blocks
  FOR ALL TO authenticated USING (EXISTS (
    SELECT 1 FROM planned_sessions ps JOIN plan_versions pv ON pv.id = ps.plan_version_id
    JOIN training_plans tp ON tp.id = pv.plan_id
    WHERE ps.id = session_blocks.session_id AND (
      has_org_role(auth.uid(), tp.organization_id, 'coach'::app_role) 
      OR has_org_role(auth.uid(), tp.organization_id, 'admin'::app_role)
      OR has_org_role(auth.uid(), tp.organization_id, 'master_admin'::app_role)
    )
  ));

-- garmin_workouts
DROP POLICY IF EXISTS "Coaches can insert garmin workouts" ON public.garmin_workouts;
CREATE POLICY "Coaches and admins can insert garmin workouts" ON public.garmin_workouts
  FOR INSERT TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM plan_versions pv JOIN training_plans tp ON tp.id = pv.plan_id
    WHERE pv.id = garmin_workouts.plan_version_id AND (
      has_org_role(auth.uid(), tp.organization_id, 'coach'::app_role) 
      OR has_org_role(auth.uid(), tp.organization_id, 'admin'::app_role)
      OR has_org_role(auth.uid(), tp.organization_id, 'master_admin'::app_role)
    )
  ));

-- targets
DROP POLICY IF EXISTS "Coaches can insert targets" ON public.targets;
CREATE POLICY "Coaches and admins can insert targets" ON public.targets
  FOR INSERT TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM plan_versions pv JOIN training_plans tp ON tp.id = pv.plan_id
    WHERE pv.id = targets.plan_version_id AND (
      has_org_role(auth.uid(), tp.organization_id, 'coach'::app_role) 
      OR has_org_role(auth.uid(), tp.organization_id, 'admin'::app_role)
      OR has_org_role(auth.uid(), tp.organization_id, 'master_admin'::app_role)
    )
  ));

-- weekly_summaries
DROP POLICY IF EXISTS "Coaches can insert weekly summaries" ON public.weekly_summaries;
CREATE POLICY "Coaches and admins can insert weekly summaries" ON public.weekly_summaries
  FOR INSERT TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM plan_versions pv JOIN training_plans tp ON tp.id = pv.plan_id
    WHERE pv.id = weekly_summaries.plan_version_id AND (
      has_org_role(auth.uid(), tp.organization_id, 'coach'::app_role) 
      OR has_org_role(auth.uid(), tp.organization_id, 'admin'::app_role)
      OR has_org_role(auth.uid(), tp.organization_id, 'master_admin'::app_role)
    )
  ));

-- audit_logs: admins can view too
DROP POLICY IF EXISTS "Admins view audit" ON public.audit_logs;
CREATE POLICY "Admins view audit" ON public.audit_logs
  FOR SELECT TO authenticated USING (
    has_role(auth.uid(), 'master_admin'::app_role) 
    OR has_role(auth.uid(), 'admin'::app_role)
  );