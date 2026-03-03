
-- Session substitutions: temporary one-off swaps for a single day
CREATE TABLE public.session_substitutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL,
  original_session_id uuid NOT NULL REFERENCES public.planned_sessions(id) ON DELETE CASCADE,
  substitution_date date NOT NULL DEFAULT CURRENT_DATE,
  reason text NOT NULL, -- 'no_equipment' | 'less_time' | 'other'
  reason_details text,
  source text NOT NULL DEFAULT 'ai', -- 'ai' | 'coach_request'
  status text NOT NULL DEFAULT 'active', -- 'active' | 'pending_coach' | 'coach_approved' | 'cancelled'
  substitute_session_name text NOT NULL,
  substitute_discipline text NOT NULL DEFAULT 'custom',
  substitute_duration_min numeric,
  substitute_workout_details text,
  substitute_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(athlete_id, original_session_id, substitution_date)
);

ALTER TABLE public.session_substitutions ENABLE ROW LEVEL SECURITY;

-- Athletes can manage their own substitutions
CREATE POLICY "Athletes manage own substitutions"
  ON public.session_substitutions FOR ALL
  TO authenticated
  USING (athlete_id = auth.uid())
  WITH CHECK (athlete_id = auth.uid());

-- Coaches can view their athletes' substitutions
CREATE POLICY "Coaches view athlete substitutions"
  ON public.session_substitutions FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM coach_athlete_assignments ca
    WHERE ca.coach_id = auth.uid() AND ca.athlete_id = session_substitutions.athlete_id
  ));

-- Coaches can update status (approve)
CREATE POLICY "Coaches update athlete substitutions"
  ON public.session_substitutions FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM coach_athlete_assignments ca
    WHERE ca.coach_id = auth.uid() AND ca.athlete_id = session_substitutions.athlete_id
  ));
