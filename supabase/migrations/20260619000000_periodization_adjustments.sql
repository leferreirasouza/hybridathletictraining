-- ============================================================
-- Phase 2: AI-suggested periodization adjustments
-- ============================================================
-- Concurrent-training interference (Hickson 1980) and TSB-driven
-- intensity/volume adjustments are computed deterministically by the
-- generate-plan edge function and stored here as proposals — never
-- applied directly to planned_sessions until a coach approves. This
-- mirrors session_substitutions' pending_coach -> active/cancelled
-- state machine so an unapproved suggestion can never silently affect
-- a plan a coach hasn't reviewed.

CREATE TABLE public.periodization_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL,
  target_session_id uuid NOT NULL REFERENCES public.planned_sessions(id) ON DELETE CASCADE,
  adjustment_type text NOT NULL, -- 'interference_spacing' | 'tsb_intensity_reduction' | 'tsb_volume_reduction'
  reason_details text,
  source text NOT NULL DEFAULT 'ai',
  status text NOT NULL DEFAULT 'pending_coach', -- 'pending_coach' | 'active' | 'cancelled'
  original_intensity text,
  original_duration_min numeric,
  original_distance_km numeric,
  suggested_intensity text,
  suggested_duration_min numeric,
  suggested_distance_km numeric,
  tsb_at_suggestion numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.periodization_adjustments ENABLE ROW LEVEL SECURITY;

-- Athletes can view (but not create/modify) suggestions on their own plan.
-- Only the service-role generate-plan function inserts rows.
CREATE POLICY "Athletes view own adjustments"
  ON public.periodization_adjustments FOR SELECT
  TO authenticated
  USING (athlete_id = auth.uid());

CREATE POLICY "Coaches view athlete adjustments"
  ON public.periodization_adjustments FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.coach_athlete_assignments ca
    WHERE ca.coach_id = auth.uid() AND ca.athlete_id = periodization_adjustments.athlete_id
  ));

-- Coaches approve/reject by updating status (and, on approve, the frontend
-- separately applies suggested_* to planned_sessions in the same action).
CREATE POLICY "Coaches update athlete adjustments"
  ON public.periodization_adjustments FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.coach_athlete_assignments ca
    WHERE ca.coach_id = auth.uid() AND ca.athlete_id = periodization_adjustments.athlete_id
  ));

CREATE INDEX idx_periodization_adjustments_athlete_status
  ON public.periodization_adjustments (athlete_id, status);
