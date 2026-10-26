-- Plan visibility + account deletion (2026-10-26, hand-coded).
--
-- 1. Visibility. The SELECT policies on training_plans / plan_versions /
--    weekly_summaries / planned_sessions / session_blocks let any member of
--    an organization read every athlete's assigned sessions and plan names.
--    Members now see: their own sessions; unassigned (athlete_id IS NULL)
--    sessions of plans they can see; plans they created, plans with their
--    sessions, templates, unassigned/empty plans of their org (the
--    org-wide "team plan" case useScheduleData.ts already shows). Coaches,
--    admins and master_admins of the org keep full access (their existing
--    ALL policies are unchanged).
--
-- 2. Account deletion. planned_sessions.athlete_id, training_plans.created_by,
--    plan_versions.created_by and audit_logs.user_id referenced auth.users
--    with NO ACTION, so deleting anyone who owned sessions or created a plan
--    failed. completed_sessions.planned_session_id was NO ACTION too, so a
--    plan whose sessions had been completed couldn't be deleted at all.

-- ---------------------------------------------------------------------------
-- Visibility helper. SECURITY DEFINER so the training_plans policy can look
-- at planned_sessions without recursing into planned_sessions' own policy
-- (which looks back at training_plans).
CREATE OR REPLACE FUNCTION public.can_view_plan(_user_id uuid, _plan_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT _user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.training_plans tp
    WHERE tp.id = _plan_id
      AND (
        tp.created_by = _user_id
        OR public.is_org_staff(_user_id, tp.organization_id)
        OR EXISTS (
          SELECT 1 FROM public.plan_versions pv
          JOIN public.planned_sessions ps ON ps.plan_version_id = pv.id
          WHERE pv.plan_id = tp.id AND ps.athlete_id = _user_id
        )
        OR (
          EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = _user_id AND ur.organization_id = tp.organization_id
          )
          AND (
            tp.is_template
            OR EXISTS (
              SELECT 1 FROM public.plan_versions pv
              JOIN public.planned_sessions ps ON ps.plan_version_id = pv.id
              WHERE pv.plan_id = tp.id AND ps.athlete_id IS NULL
            )
            OR NOT EXISTS (
              SELECT 1 FROM public.plan_versions pv
              JOIN public.planned_sessions ps ON ps.plan_version_id = pv.id
              WHERE pv.plan_id = tp.id
            )
          )
        )
      )
  )
$$;

REVOKE ALL ON FUNCTION public.can_view_plan(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_plan(uuid, uuid) TO authenticated, service_role;

-- training_plans
DROP POLICY IF EXISTS "Org members can view plans" ON public.training_plans;
CREATE POLICY "View visible plans" ON public.training_plans
  FOR SELECT TO authenticated
  USING (public.can_view_plan(auth.uid(), id));

-- plan_versions
DROP POLICY IF EXISTS "Org members can view versions" ON public.plan_versions;
CREATE POLICY "View versions of visible plans" ON public.plan_versions
  FOR SELECT TO authenticated
  USING (public.can_view_plan(auth.uid(), plan_id));

-- weekly_summaries: visible when the version is (plan_versions' RLS applies
-- inside the subquery).
DROP POLICY IF EXISTS "Org members view weekly summaries" ON public.weekly_summaries;
CREATE POLICY "View summaries of visible plans" ON public.weekly_summaries
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.plan_versions pv WHERE pv.id = weekly_summaries.plan_version_id));

-- planned_sessions: own sessions, or unassigned sessions of a visible plan.
DROP POLICY IF EXISTS "Org members can view sessions" ON public.planned_sessions;
CREATE POLICY "View own or unassigned sessions" ON public.planned_sessions
  FOR SELECT TO authenticated
  USING (
    athlete_id = auth.uid()
    OR (
      athlete_id IS NULL
      AND EXISTS (
        SELECT 1 FROM public.plan_versions pv
        WHERE pv.id = planned_sessions.plan_version_id
          AND public.can_view_plan(auth.uid(), pv.plan_id)
      )
    )
  );

-- session_blocks: visible when the session is (planned_sessions' RLS applies
-- inside the subquery).
DROP POLICY IF EXISTS "View session blocks" ON public.session_blocks;
CREATE POLICY "View blocks of visible sessions" ON public.session_blocks
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.planned_sessions ps WHERE ps.id = session_blocks.session_id));

-- ---------------------------------------------------------------------------
-- Deletion-safe foreign keys.

-- An athlete's planned sessions go with the athlete.
ALTER TABLE public.planned_sessions DROP CONSTRAINT planned_sessions_athlete_id_fkey;
ALTER TABLE public.planned_sessions
  ADD CONSTRAINT planned_sessions_athlete_id_fkey
  FOREIGN KEY (athlete_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- A coach leaving must not delete the plans their athletes train on.
ALTER TABLE public.training_plans ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.training_plans DROP CONSTRAINT training_plans_created_by_fkey;
ALTER TABLE public.training_plans
  ADD CONSTRAINT training_plans_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.plan_versions ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.plan_versions DROP CONSTRAINT plan_versions_created_by_fkey;
ALTER TABLE public.plan_versions
  ADD CONSTRAINT plan_versions_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- The audit trail stays, without the person.
ALTER TABLE public.audit_logs DROP CONSTRAINT audit_logs_user_id_fkey;
ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Deleting a planned session keeps the logged workout (it becomes unplanned).
ALTER TABLE public.completed_sessions DROP CONSTRAINT completed_sessions_planned_session_id_fkey;
ALTER TABLE public.completed_sessions
  ADD CONSTRAINT completed_sessions_planned_session_id_fkey
  FOREIGN KEY (planned_session_id) REFERENCES public.planned_sessions(id) ON DELETE SET NULL;
