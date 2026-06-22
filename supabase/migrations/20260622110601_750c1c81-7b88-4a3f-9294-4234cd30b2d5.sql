CREATE TABLE public.training_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  available_days int[] NOT NULL DEFAULT '{1,3,5}',
  session_length_min int NOT NULL DEFAULT 60,
  run_type_weights jsonb NOT NULL DEFAULT '{"easy":0.6,"tempo":0.15,"interval":0.1,"long":0.15,"fartlek":0}',
  strength_sessions_per_week int NOT NULL DEFAULT 2,
  muscle_focus text[] NOT NULL DEFAULT '{}',
  mobility_technique_sessions_per_week int NOT NULL DEFAULT 1,
  equipment jsonb NOT NULL DEFAULT '{"gym_access":true,"sled":true,"rower":true,"skierg":true}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_preferences TO authenticated;
GRANT ALL ON public.training_preferences TO service_role;

ALTER TABLE public.training_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Athletes manage own training preferences"
  ON public.training_preferences FOR ALL
  TO authenticated
  USING (athlete_id = auth.uid())
  WITH CHECK (athlete_id = auth.uid());

CREATE POLICY "Coaches view athlete training preferences"
  ON public.training_preferences FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.coach_athlete_assignments ca
    WHERE ca.coach_id = auth.uid() AND ca.athlete_id = training_preferences.athlete_id
  ));

CREATE INDEX idx_training_preferences_athlete ON public.training_preferences (athlete_id);

CREATE TRIGGER update_training_preferences_updated_at
  BEFORE UPDATE ON public.training_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS goal_finish_time_seconds integer,
  ADD COLUMN IF NOT EXISTS goal_run_split_seconds_per_km integer;

ALTER TABLE public.weekly_summaries
  ADD COLUMN IF NOT EXISTS phase text;