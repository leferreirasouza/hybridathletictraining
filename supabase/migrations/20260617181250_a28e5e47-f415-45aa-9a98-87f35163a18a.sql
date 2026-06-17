
-- Garmin Health API ingestion tables
-- 1) Raw activities
CREATE TABLE public.garmin_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  summary_id TEXT NOT NULL,
  activity_id TEXT,
  activity_type TEXT,
  start_time_utc TIMESTAMPTZ,
  start_time_local TIMESTAMPTZ,
  duration_sec INTEGER,
  distance_m NUMERIC,
  avg_hr INTEGER,
  max_hr INTEGER,
  avg_speed_mps NUMERIC,
  avg_pace_min_per_km NUMERIC,
  calories INTEGER,
  steps INTEGER,
  elevation_gain_m NUMERIC,
  training_load NUMERIC,
  device_name TEXT,
  discipline public.discipline,
  completed_session_id UUID REFERENCES public.completed_sessions(id) ON DELETE SET NULL,
  raw JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, summary_id)
);
GRANT SELECT ON public.garmin_activities TO authenticated;
GRANT ALL ON public.garmin_activities TO service_role;
ALTER TABLE public.garmin_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Athletes view own garmin activities" ON public.garmin_activities
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_garmin_activities_updated_at BEFORE UPDATE ON public.garmin_activities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_garmin_activities_user_start ON public.garmin_activities(user_id, start_time_local DESC);

-- 2) Daily summaries (HealthKit-compatible fields)
CREATE TABLE public.garmin_dailies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  summary_id TEXT NOT NULL,
  calendar_date DATE NOT NULL,
  steps INTEGER,
  distance_m NUMERIC,
  active_kilocalories INTEGER,
  bmr_kilocalories INTEGER,
  floors_climbed INTEGER,
  active_time_sec INTEGER,
  moderate_intensity_sec INTEGER,
  vigorous_intensity_sec INTEGER,
  resting_hr INTEGER,
  min_hr INTEGER,
  max_hr INTEGER,
  avg_hr INTEGER,
  avg_stress INTEGER,
  max_stress INTEGER,
  body_battery_charged INTEGER,
  body_battery_drained INTEGER,
  hrv_ms NUMERIC,
  spo2_avg INTEGER,
  respiration_avg NUMERIC,
  raw JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, calendar_date)
);
GRANT SELECT ON public.garmin_dailies TO authenticated;
GRANT ALL ON public.garmin_dailies TO service_role;
ALTER TABLE public.garmin_dailies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Athletes view own garmin dailies" ON public.garmin_dailies
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_garmin_dailies_updated_at BEFORE UPDATE ON public.garmin_dailies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_garmin_dailies_user_date ON public.garmin_dailies(user_id, calendar_date DESC);

-- 3) Sleep summaries
CREATE TABLE public.garmin_sleep (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  summary_id TEXT NOT NULL,
  calendar_date DATE NOT NULL,
  start_time_utc TIMESTAMPTZ,
  end_time_utc TIMESTAMPTZ,
  duration_sec INTEGER,
  deep_sleep_sec INTEGER,
  light_sleep_sec INTEGER,
  rem_sleep_sec INTEGER,
  awake_sec INTEGER,
  sleep_score INTEGER,
  avg_hrv_ms NUMERIC,
  avg_respiration NUMERIC,
  avg_spo2 INTEGER,
  raw JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, calendar_date)
);
GRANT SELECT ON public.garmin_sleep TO authenticated;
GRANT ALL ON public.garmin_sleep TO service_role;
ALTER TABLE public.garmin_sleep ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Athletes view own garmin sleep" ON public.garmin_sleep
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_garmin_sleep_updated_at BEFORE UPDATE ON public.garmin_sleep
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_garmin_sleep_user_date ON public.garmin_sleep(user_id, calendar_date DESC);
