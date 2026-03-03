
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS age integer,
  ADD COLUMN IF NOT EXISTS weight_kg numeric,
  ADD COLUMN IF NOT EXISTS max_hr integer,
  ADD COLUMN IF NOT EXISTS fitness_level text DEFAULT 'intermediate',
  ADD COLUMN IF NOT EXISTS goal_race_name text,
  ADD COLUMN IF NOT EXISTS goal_race_date date,
  ADD COLUMN IF NOT EXISTS goal_race_location text,
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;
