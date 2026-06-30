ALTER TABLE public.training_preferences
  ADD COLUMN IF NOT EXISTS strength_days int[],
  ADD COLUMN IF NOT EXISTS mobility_days int[],
  ADD COLUMN IF NOT EXISTS mobility_tech_weights jsonb NOT NULL DEFAULT '{"mobility":0.4,"skill_drill":0.2,"rehab":0.2,"run_mechanics":0.2}'::jsonb;

UPDATE public.training_preferences
SET equipment = jsonb_build_object('preset', 'custom', 'items', equipment)
WHERE equipment ? 'gym_access' AND NOT (equipment ? 'items');

ALTER TABLE public.training_preferences
  ALTER COLUMN equipment SET DEFAULT '{"preset":"bodyweight_only","items":{"gym_access":false,"sled":false,"rower":false,"skierg":false}}'::jsonb;

ALTER TYPE public.block_type ADD VALUE IF NOT EXISTS 'superset';

ALTER TABLE public.session_blocks
  ADD COLUMN IF NOT EXISTS part_number integer,
  ADD COLUMN IF NOT EXISTS superset_group integer,
  ADD COLUMN IF NOT EXISTS repeat_count integer,
  ADD COLUMN IF NOT EXISTS equipment text,
  ADD COLUMN IF NOT EXISTS muscle_group text,
  ADD COLUMN IF NOT EXISTS target_pace_label text;