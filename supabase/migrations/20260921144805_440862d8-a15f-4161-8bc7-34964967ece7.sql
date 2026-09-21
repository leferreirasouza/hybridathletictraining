CREATE OR REPLACE FUNCTION public.session_trimp(_duration_min numeric, _avg_hr integer, _rpe integer, _resting_hr integer, _max_hr integer)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  hrr NUMERIC;
  rhr INT := COALESCE(_resting_hr, 60);
  mhr INT := COALESCE(_max_hr, 190);
BEGIN
  IF _duration_min IS NULL THEN
    RETURN 0;
  END IF;

  IF _avg_hr IS NOT NULL AND mhr > rhr THEN
    hrr := (_avg_hr - rhr) / (mhr - rhr)::NUMERIC;
    hrr := GREATEST(0, LEAST(1, hrr));
    RETURN ROUND(_duration_min * hrr * 0.64 * exp(1.92 * hrr), 4);
  END IF;

  IF _rpe IS NOT NULL THEN
    RETURN ROUND(_duration_min * _rpe * 0.25, 4);
  END IF;

  RETURN ROUND(_duration_min, 4);
END;
$function$;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT athlete_id FROM public.completed_sessions LOOP
    PERFORM public.recompute_training_load(r.athlete_id);
  END LOOP;
END $$;