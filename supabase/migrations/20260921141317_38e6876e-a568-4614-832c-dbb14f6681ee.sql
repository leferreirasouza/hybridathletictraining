-- ============================================================
-- 1) Strava sync + token-encryption support (idempotent replay)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.strava_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  strava_activity_id BIGINT NOT NULL,
  activity_type TEXT,
  sport_type TEXT,
  name TEXT,
  start_date_utc TIMESTAMPTZ,
  start_date_local TIMESTAMPTZ,
  duration_sec INTEGER,
  distance_m NUMERIC,
  avg_hr INTEGER,
  max_hr INTEGER,
  avg_speed_mps NUMERIC,
  avg_pace_min_per_km NUMERIC,
  elevation_gain_m NUMERIC,
  discipline public.discipline,
  completed_session_id UUID REFERENCES public.completed_sessions(id) ON DELETE SET NULL,
  raw JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, strava_activity_id)
);

GRANT SELECT ON public.strava_activities TO authenticated;
GRANT ALL ON public.strava_activities TO service_role;

ALTER TABLE public.strava_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Athletes view own strava activities" ON public.strava_activities;
CREATE POLICY "Athletes view own strava activities" ON public.strava_activities
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_strava_activities_updated_at ON public.strava_activities;
CREATE TRIGGER trg_strava_activities_updated_at BEFORE UPDATE ON public.strava_activities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_strava_activities_user_start
  ON public.strava_activities(user_id, start_date_local DESC);

ALTER TABLE public.completed_sessions
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.completed_sessions'::regclass
      AND conname = 'completed_sessions_source_check'
  ) THEN
    ALTER TABLE public.completed_sessions
      ADD CONSTRAINT completed_sessions_source_check
      CHECK (source IN ('manual', 'garmin', 'strava'));
  END IF;
END $$;

ALTER TABLE public.garmin_connections ADD COLUMN IF NOT EXISTS access_token_hash TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_garmin_connections_access_token_hash
  ON public.garmin_connections(access_token_hash) WHERE access_token_hash IS NOT NULL;

-- ============================================================
-- 2) Org-scoped admin reads (has_role ignored organization)
-- ============================================================
DROP POLICY IF EXISTS "Admins view all parq" ON public.parq_responses;
CREATE POLICY "Admins view org parq" ON public.parq_responses
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'master_admin')
    OR EXISTS (
      SELECT 1 FROM public.user_roles ar
      JOIN public.user_roles tr ON tr.organization_id = ar.organization_id
      WHERE ar.user_id = auth.uid()
        AND ar.role IN ('admin', 'master_admin')
        AND tr.user_id = parq_responses.athlete_id
    )
  );

DROP POLICY IF EXISTS "Admins view all assessments" ON public.fitness_assessments;
CREATE POLICY "Admins view org assessments" ON public.fitness_assessments
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'master_admin')
    OR EXISTS (
      SELECT 1 FROM public.user_roles ar
      JOIN public.user_roles tr ON tr.organization_id = ar.organization_id
      WHERE ar.user_id = auth.uid()
        AND ar.role IN ('admin', 'master_admin')
        AND tr.user_id = fitness_assessments.athlete_id
    )
  );

-- audit_logs has no organization column, so scope by the acting user's org
DROP POLICY IF EXISTS "Admins view audit" ON public.audit_logs;
CREATE POLICY "Admins view org audit" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'master_admin')
    OR (
      audit_logs.user_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.user_roles ar
        JOIN public.user_roles tr ON tr.organization_id = ar.organization_id
        WHERE ar.user_id = auth.uid()
          AND ar.role IN ('admin', 'master_admin')
          AND tr.user_id = audit_logs.user_id
      )
    )
  );

-- ============================================================
-- 3) coach_context: per-user AI coach context, no seeded content
-- ============================================================
CREATE TABLE IF NOT EXISTS public.coach_context (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  context_text TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_context TO authenticated;
GRANT ALL ON public.coach_context TO service_role;

ALTER TABLE public.coach_context ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner manages own coach context" ON public.coach_context;
CREATE POLICY "Owner manages own coach context" ON public.coach_context
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Master admin views all coach context" ON public.coach_context;
CREATE POLICY "Master admin views all coach context" ON public.coach_context
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'master_admin'));

DROP TRIGGER IF EXISTS trg_coach_context_updated_at ON public.coach_context;
CREATE TRIGGER trg_coach_context_updated_at BEFORE UPDATE ON public.coach_context
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();