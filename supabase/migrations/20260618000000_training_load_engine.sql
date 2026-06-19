-- ============================================================
-- Training Load Engine: Banister TRIMP + CTL/ATL/TSB
-- ============================================================
-- Phase 0 of the training-load/periodization roadmap. Hand-coded
-- deliberately (not Lovable-prompted): incorrect EWMA math here would
-- silently corrupt the fatigue/safety signal coaches rely on downstream.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS resting_hr integer;

CREATE TABLE public.training_load_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  trimp NUMERIC NOT NULL DEFAULT 0,
  ctl NUMERIC NOT NULL DEFAULT 0,
  atl NUMERIC NOT NULL DEFAULT 0,
  tsb NUMERIC NOT NULL DEFAULT 0,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (athlete_id, date)
);
ALTER TABLE public.training_load_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Athletes view own load" ON public.training_load_daily FOR SELECT
  USING (athlete_id = auth.uid());
CREATE POLICY "Coaches view athlete load" ON public.training_load_daily FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.coach_athlete_assignments ca
    WHERE ca.coach_id = auth.uid() AND ca.athlete_id = training_load_daily.athlete_id
  ));

CREATE INDEX idx_training_load_daily_athlete_date ON public.training_load_daily (athlete_id, date);

-- ============================================================
-- Per-session TRIMP
-- ============================================================
-- Banister-style individualized HR-reserve TRIMP when avg_hr/resting_hr/max_hr
-- are all available; falls back to Foster's session-RPE TRIMP (duration * RPE)
-- otherwise, since athletes log RPE far more consistently than HR today.
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
    RETURN _duration_min * hrr * 0.64 * exp(1.92 * hrr);
  END IF;

  IF _rpe IS NOT NULL THEN
    RETURN _duration_min * _rpe;
  END IF;

  RETURN 0;
END;
$$;

-- ============================================================
-- CTL (42-day EWMA) / ATL (7-day EWMA) / TSB recomputation
-- ============================================================
-- TSB for day D is stored using D-1's CTL/ATL (the form an athlete carries
-- INTO day D, before that day's training is applied) — the standard
-- TrainingPeaks/Coggan convention.
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

    _ctl := _prev_ctl + (_day_trimp - _prev_ctl) * (1 - exp(-1.0 / 42));
    _atl := _prev_atl + (_day_trimp - _prev_atl) * (1 - exp(-1.0 / 7));

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

-- ============================================================
-- Keep load fresh whenever an athlete logs/edits/deletes a session
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_recompute_training_load()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.recompute_training_load(COALESCE(NEW.athlete_id, OLD.athlete_id));
  RETURN NULL;
END;
$$;

CREATE TRIGGER recompute_training_load_on_session_change
  AFTER INSERT OR UPDATE OR DELETE ON public.completed_sessions
  FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_training_load();

-- Extensions needed for the daily decay catch-up job (Phase 0's scheduled
-- compute requirement, e.g. fatigue recovering on rest days with no new
-- session). The actual cron.schedule(...) call is run manually via the
-- Supabase SQL editor / dashboard after this migration, NOT committed here,
-- since it needs to reference a secret (CRON_SECRET) that must never be
-- checked into git.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
