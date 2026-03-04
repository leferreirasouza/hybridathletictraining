
-- Create races_calendar table
CREATE TABLE public.races_calendar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  race_type text NOT NULL DEFAULT 'hyrox', -- 'hyrox', '5k', '10k', '21k', 'marathon', 'other'
  race_name text NOT NULL,
  race_date date NOT NULL,
  race_end_date date,
  city text,
  country text NOT NULL,
  continent text,
  location_detail text,
  external_url text,
  image_url text,
  source text NOT NULL DEFAULT 'seed', -- 'seed', 'scraper', 'user'
  created_by uuid,
  is_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.races_calendar ENABLE ROW LEVEL SECURITY;

-- Everyone (authenticated) can view races
CREATE POLICY "Authenticated users can view races"
  ON public.races_calendar FOR SELECT TO authenticated
  USING (true);

-- Authenticated users can insert custom races
CREATE POLICY "Authenticated users can create custom races"
  ON public.races_calendar FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND source = 'user');

-- Users can update their own custom races
CREATE POLICY "Users can update own custom races"
  ON public.races_calendar FOR UPDATE TO authenticated
  USING (created_by = auth.uid() AND source = 'user');

-- Users can delete their own custom races
CREATE POLICY "Users can delete own custom races"
  ON public.races_calendar FOR DELETE TO authenticated
  USING (created_by = auth.uid() AND source = 'user');

-- Admins can manage all races
CREATE POLICY "Admins manage all races"
  ON public.races_calendar FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'master_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Add index for common queries
CREATE INDEX idx_races_calendar_type_country ON public.races_calendar (race_type, country);
CREATE INDEX idx_races_calendar_date ON public.races_calendar (race_date);

-- Add profile field to link to a specific race
ALTER TABLE public.profiles ADD COLUMN goal_race_id uuid REFERENCES public.races_calendar(id);
