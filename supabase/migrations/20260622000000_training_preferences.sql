-- ============================================================
-- Plan Generator Rework, Phase A: persistent goals + preferences
-- ============================================================
-- Backs the deterministic pace-zone / phase / session-slot engine in
-- supabase/functions/_shared/{paceZones,phaseModel,sessionSlots}.ts.
-- Multi-valued preference data (days, weights, muscle focus) lives in its
-- own table rather than widening profiles; scalar standing goals (target
-- finish time) go on profiles alongside the existing goal_race_* columns.

CREATE TABLE public.training_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  available_days int[] NOT NULL DEFAULT '{1,3,5}', -- 1=Mon..7=Sun
  session_length_min int NOT NULL DEFAULT 60,
  run_type_weights jsonb NOT NULL DEFAULT '{"easy":0.6,"tempo":0.15,"interval":0.1,"long":0.15,"fartlek":0}',
  strength_sessions_per_week int NOT NULL DEFAULT 2,
  muscle_focus text[] NOT NULL DEFAULT '{}',
  mobility_technique_sessions_per_week int NOT NULL DEFAULT 1,
  equipment jsonb NOT NULL DEFAULT '{"gym_access":true,"sled":true,"rower":true,"skierg":true}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

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

-- Persistent goal finish time, so it survives across plan regenerations
-- instead of dying with each AthletePlanForm submit.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS goal_finish_time_seconds integer,
  ADD COLUMN IF NOT EXISTS goal_run_split_seconds_per_km integer;

-- Week-level phase label (base/build/peak/taper), natural fit alongside the
-- existing per-week run_km_target aggregate.
ALTER TABLE public.weekly_summaries
  ADD COLUMN IF NOT EXISTS phase text;
