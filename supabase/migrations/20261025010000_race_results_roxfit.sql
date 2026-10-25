-- Automatic HYROX race results from ROXFIT imports (2026-10-25).
-- See supabase/functions/_shared/roxfitParse.ts / roxfitRaceResult.ts.
--
-- category keeps its existing meaning (format badge, or an age group on
-- generate-plan's goal rows); division_key is what races are compared on.

ALTER TABLE public.race_results
  ADD COLUMN IF NOT EXISTS strava_activity_id bigint NULL,
  ADD COLUMN IF NOT EXISTS division text NULL,
  -- open_men | open_women | pro_men | pro_women | doubles_men | doubles_women
  -- | doubles_mixed | relay_men | relay_women | relay_mixed
  ADD COLUMN IF NOT EXISTS division_key text NULL,
  ADD COLUMN IF NOT EXISTS overall_rank integer NULL,
  ADD COLUMN IF NOT EXISTS age_group_rank integer NULL;

-- One result per imported activity per athlete; NULLs (manual and goal rows)
-- don't collide.
ALTER TABLE public.race_results
  ADD CONSTRAINT race_results_athlete_strava_activity_key UNIQUE (athlete_id, strava_activity_id);
