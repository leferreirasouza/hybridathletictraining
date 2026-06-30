-- ============================================================
-- Plan Generator Rework, Phase B: wizard preference fields,
-- richer equipment shape, structured session_blocks grouping.
-- ============================================================

-- Per-category day pickers (Runna asks running days and strength days
-- separately) and a mobility/technique sub-type weighting, so the
-- mobility-focus wizard question actually wires into sessionSlots.ts's
-- MOBILITY_TECH_ROTATION instead of being UI-only. All nullable/defaulted —
-- existing rows are unaffected.
ALTER TABLE public.training_preferences
  ADD COLUMN IF NOT EXISTS strength_days int[],
  ADD COLUMN IF NOT EXISTS mobility_days int[],
  ADD COLUMN IF NOT EXISTS mobility_tech_weights jsonb NOT NULL DEFAULT '{"mobility":0.4,"skill_drill":0.2,"rehab":0.2,"run_mechanics":0.2}';

-- Equipment moves from a flat 4-boolean object to {preset, items}, so the
-- wizard can offer preset categories (bodyweight/home gym/HYROX-CrossFit
-- box/full gym) plus a granular item checklist. Existing flat rows are
-- backfilled into the new shape rather than left to silently read as empty.
UPDATE public.training_preferences
SET equipment = jsonb_build_object('preset', 'custom', 'items', equipment)
WHERE equipment ? 'gym_access' AND NOT (equipment ? 'items');

ALTER TABLE public.training_preferences
  ALTER COLUMN equipment SET DEFAULT '{"preset":"bodyweight_only","items":{"gym_access":false,"sled":false,"rower":false,"skierg":false}}';

-- Structured session output: group strength exercises into numbered parts
-- and supersets (mirrors Runna's "Part 4 — Repeat 3 times — Superset" UI),
-- and let a block carry per-segment equipment/muscle-group tags and a
-- progressive/varied-pace label (target_pace stays single-value; this is
-- for "5km at 4:55/km, 4km at 4:35/km"-style descriptions). All nullable —
-- simple flat warmup/cooldown rows are unaffected.
ALTER TYPE public.block_type ADD VALUE IF NOT EXISTS 'superset';

ALTER TABLE public.session_blocks
  ADD COLUMN IF NOT EXISTS part_number integer,
  ADD COLUMN IF NOT EXISTS superset_group integer,
  ADD COLUMN IF NOT EXISTS repeat_count integer,
  ADD COLUMN IF NOT EXISTS equipment text,
  ADD COLUMN IF NOT EXISTS muscle_group text,
  ADD COLUMN IF NOT EXISTS target_pace_label text;
