
-- Race results table for storing HYROX race split data
CREATE TABLE public.race_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  race_date date NOT NULL,
  race_name text,
  race_location text,
  category text DEFAULT 'open',
  total_time_seconds integer,
  
  -- 8 running splits (seconds)
  run_1_seconds integer,
  run_2_seconds integer,
  run_3_seconds integer,
  run_4_seconds integer,
  run_5_seconds integer,
  run_6_seconds integer,
  run_7_seconds integer,
  run_8_seconds integer,
  
  -- 8 station splits (seconds) in HYROX order:
  -- 1: SkiErg, 2: Sled Push, 3: Sled Pull, 4: Burpee Broad Jumps
  -- 5: Rowing, 6: Farmers Carry, 7: Sandbag Lunges, 8: Wall Balls
  station_1_seconds integer,
  station_2_seconds integer,
  station_3_seconds integer,
  station_4_seconds integer,
  station_5_seconds integer,
  station_6_seconds integer,
  station_7_seconds integer,
  station_8_seconds integer,
  
  -- Transition times (optional)
  total_transition_seconds integer,
  
  -- Screenshot reference
  screenshot_url text,
  
  -- AI extracted vs manual
  input_method text DEFAULT 'manual',
  
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.race_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Athletes view own race results"
  ON public.race_results FOR SELECT
  TO authenticated
  USING (athlete_id = auth.uid());

CREATE POLICY "Athletes insert own race results"
  ON public.race_results FOR INSERT
  TO authenticated
  WITH CHECK (athlete_id = auth.uid());

CREATE POLICY "Athletes update own race results"
  ON public.race_results FOR UPDATE
  TO authenticated
  USING (athlete_id = auth.uid());

CREATE POLICY "Athletes delete own race results"
  ON public.race_results FOR DELETE
  TO authenticated
  USING (athlete_id = auth.uid());

-- Coaches can view their athletes' race results
CREATE POLICY "Coaches view athlete race results"
  ON public.race_results FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM coach_athlete_assignments ca
    WHERE ca.coach_id = auth.uid() AND ca.athlete_id = race_results.athlete_id
  ));

-- Storage bucket for race screenshots
INSERT INTO storage.buckets (id, name, public) VALUES ('race-screenshots', 'race-screenshots', true);

-- Storage RLS: athletes can upload to their own folder
CREATE POLICY "Athletes upload own screenshots"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'race-screenshots' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Anyone can view race screenshots"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'race-screenshots');
