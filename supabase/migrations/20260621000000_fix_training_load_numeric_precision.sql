-- ============================================================
-- Fix unbounded NUMERIC precision from exp() in the load engine
-- ============================================================
-- Postgres's numeric exp() computes to very high internal precision
-- (observed: 100s-1000s of digits) rather than rounding to something
-- sane. recompute_training_load() carries _ctl/_atl forward across a
-- day-by-day loop, so that precision compounded on every iteration,
-- producing absurdly bloated stored values (confirmed via a smoke test
-- against live data right after the original migration was applied).
-- Round at the source in both functions, and constrain the storage
-- columns to numeric(12,4) as a second line of defense.

ALTER TABLE public.training_load_daily
  ALTER COLUMN trimp TYPE numeric(12,4),
  ALTER COLUMN ctl TYPE numeric(12,4),
  ALTER COLUMN atl TYPE numeric(12,4),
  ALTER COLUMN tsb TYPE numeric(12,4);

CREATE OR REPLACE FUNCTION public.session_trimp(
  _duration_min NUMERIC,
  _avg_hr INT,
  _rpe INT,
  _resting_hr INT,
  _max_hr INT
) RETURNS NUMERIC
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  hrr NUMERIC;
BEGIN
  IF _duration_min IS NULL THEN
    RETURN 0;
  END IF;

  IF _avg_hr IS NOT NULL AND _resting_hr IS NOT NULL AND _max_hr IS NOT NULL AND _max_hr > _resting_hr THEN
    hrr := (_avg_hr - _resting_hr) / (_max_hr - _resting_hr)::NUMERIC;
    hrr := GREATEST(0, LEAST(1, hrr));
    RETURN ROUND(_duration_min * hrr * 0.64 * exp(1.92 * hrr), 4);
  END IF;

  IF _rpe IS NOT NULL THEN
    RETURN _duration_min * _rpe;
  END IF;

  RETURN 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.recompute_training_load(_athlete_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
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
    SELECT COALESCE(SUM(public.session_trimp(actual_duration_min, avg_hr, rpe, _resting_hr, _max_hr)), 0)
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
$$;
