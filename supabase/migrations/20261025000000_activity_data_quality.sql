-- Activity data quality (2026-10-25).
--
-- Imported activities carry known distortions that the training-load engine
-- and the AI coach must not take at face value: treadmill/indoor distance is
-- an estimate, HYROX races arrive as "Run" imports, HR straps produce spikes,
-- and the same effort is often recorded twice (watch + ROXFIT/Peloton
-- import). Classification lives in supabase/functions/_shared/activityQuality.ts;
-- these columns persist its output so every consumer reads the same verdict.
--
-- data_flags values:
--   race               — a race effort (Strava workout_type race, or a HYROX race import)
--   distance_estimated — treadmill / trainer / virtual: distance & pace are not GPS-measured
--   hr_artifact        — avg HR implausible for this athlete; excluded from HR-based load
--   max_hr_artifact    — max HR spike above the athlete's plausible ceiling
--   manual_entry       — typed in by hand on Strava, no sensor data

ALTER TABLE public.completed_sessions
  ADD COLUMN IF NOT EXISTS data_flags text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.strava_activities
  ADD COLUMN IF NOT EXISTS data_flags text[] NOT NULL DEFAULT '{}',
  -- Set when this recording is a second copy of an effort already linked
  -- through another strava_activities row (points at that row's id).
  ADD COLUMN IF NOT EXISTS duplicate_of uuid NULL REFERENCES public.strava_activities(id) ON DELETE SET NULL;

-- Same as the previous definition except that a session flagged hr_artifact
-- passes NULL avg HR, so session_trimp falls back to RPE / duration instead
-- of trusting a corrupt heart-rate trace.
CREATE OR REPLACE FUNCTION public.recompute_training_load(_athlete_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _start_date DATE;
  _d DATE;
  _today DATE := CURRENT_DATE;
  _day_trimp NUMERIC;
  _prev_ctl NUMERIC := 0;
  _prev_atl NUMERIC := 0;
  _ctl NUMERIC;
  _atl NUMERIC;
  _resting_hr INT;
  _max_hr INT;
BEGIN
  SELECT resting_hr, max_hr INTO _resting_hr, _max_hr FROM public.profiles WHERE id = _athlete_id;

  SELECT MIN(date) INTO _start_date FROM public.completed_sessions WHERE athlete_id = _athlete_id;
  IF _start_date IS NULL THEN
    RETURN;
  END IF;

  _d := _start_date;
  WHILE _d <= _today LOOP
    SELECT COALESCE(SUM(public.session_trimp(
             actual_duration_min,
             CASE WHEN 'hr_artifact' = ANY(data_flags) THEN NULL ELSE avg_hr END,
             rpe, _resting_hr, _max_hr)), 0)
      INTO _day_trimp
      FROM public.completed_sessions
      WHERE athlete_id = _athlete_id AND date = _d;

    _ctl := ROUND(_prev_ctl + (_day_trimp - _prev_ctl) * (1 - exp(-1.0 / 42)), 4);
    _atl := ROUND(_prev_atl + (_day_trimp - _prev_atl) * (1 - exp(-1.0 / 7)), 4);

    INSERT INTO public.training_load_daily (athlete_id, date, trimp, ctl, atl, tsb, computed_at)
    VALUES (_athlete_id, _d, _day_trimp, _ctl, _atl, _prev_ctl - _prev_atl, now())
    ON CONFLICT (athlete_id, date) DO UPDATE SET
      trimp = EXCLUDED.trimp, ctl = EXCLUDED.ctl, atl = EXCLUDED.atl, tsb = EXCLUDED.tsb, computed_at = EXCLUDED.computed_at;

    _prev_ctl := _ctl;
    _prev_atl := _atl;
    _d := _d + 1;
  END LOOP;
END;
$function$;
