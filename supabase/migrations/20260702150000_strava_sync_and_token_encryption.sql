-- Strava real-time sync + token-encryption support.
--
-- 1) strava_activities: mirrors garmin_activities' shape/purpose so Strava
--    gets the same persisted-activity + auto-match-to-plan capability Garmin
--    already has. Unique (user_id, strava_activity_id) gives idempotent
--    upserts on webhook retries.
-- 2) completed_sessions.source: tracks provenance (manual/garmin/strava) so
--    auto-imports can be told apart from athlete-entered logs and don't
--    silently double up.
-- 3) garmin_connections.access_token_hash: a non-secret HMAC lookup key so
--    garmin-webhook can resolve which user a payload belongs to without ever
--    comparing plaintext access_token values (which are being encrypted).

CREATE TABLE public.strava_activities (
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

CREATE POLICY "Athletes view own strava activities" ON public.strava_activities
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_strava_activities_updated_at BEFORE UPDATE ON public.strava_activities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_strava_activities_user_start ON public.strava_activities(user_id, start_date_local DESC);

-- ---------------------------------------------------------------------

ALTER TABLE public.completed_sessions
  ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'garmin', 'strava'));

-- ---------------------------------------------------------------------

ALTER TABLE public.garmin_connections ADD COLUMN access_token_hash TEXT;

CREATE UNIQUE INDEX idx_garmin_connections_access_token_hash
  ON public.garmin_connections(access_token_hash) WHERE access_token_hash IS NOT NULL;
