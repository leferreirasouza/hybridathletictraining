CREATE OR REPLACE FUNCTION public.respond_to_plan_suggestion(_adjustment_id uuid, _accept boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller uuid := auth.uid();
  a public.periodization_adjustments%ROWTYPE;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO a FROM public.periodization_adjustments WHERE id = _adjustment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Suggestion not found'; END IF;
  IF a.status <> 'pending_coach' THEN RAISE EXCEPTION 'Suggestion already answered'; END IF;
  IF NOT (
    a.athlete_id = v_caller
    OR EXISTS (SELECT 1 FROM public.coach_athlete_assignments ca WHERE ca.coach_id = v_caller AND ca.athlete_id = a.athlete_id)
    OR public.has_role(v_caller, 'master_admin')
  ) THEN RAISE EXCEPTION 'Access denied'; END IF;

  IF _accept THEN
    UPDATE public.planned_sessions SET
      intensity = COALESCE(a.suggested_intensity::public.intensity_level, a.original_intensity::public.intensity_level),
      duration_min = COALESCE(a.suggested_duration_min, a.original_duration_min),
      distance_km = COALESCE(a.suggested_distance_km, a.original_distance_km)
    WHERE id = a.target_session_id;
    UPDATE public.periodization_adjustments SET status = 'active' WHERE id = a.id;
  ELSE
    UPDATE public.periodization_adjustments SET status = 'cancelled' WHERE id = a.id;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.respond_to_plan_suggestion(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_to_plan_suggestion(uuid, boolean) TO authenticated;