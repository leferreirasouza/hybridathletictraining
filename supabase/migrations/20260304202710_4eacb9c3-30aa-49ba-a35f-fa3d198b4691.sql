
-- Add source tracking and soft-archive to training_plans
ALTER TABLE public.training_plans
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS archived_at timestamptz DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.training_plans.source IS 'Origin of the plan: manual, spreadsheet, ai_generated';
COMMENT ON COLUMN public.training_plans.archived_at IS 'Soft-delete timestamp; NULL means active';

-- Create plan_history table for full audit trail of plan lifecycle events
CREATE TABLE public.plan_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.training_plans(id) ON DELETE CASCADE,
  action text NOT NULL, -- created, archived, restored, version_added, assigned, unassigned
  performed_by uuid NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_history ENABLE ROW LEVEL SECURITY;

-- Coaches/admins can view history for plans in their org
CREATE POLICY "Org members view plan history"
  ON public.plan_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM training_plans tp
      JOIN user_roles ur ON ur.organization_id = tp.organization_id
      WHERE tp.id = plan_history.plan_id AND ur.user_id = auth.uid()
    )
  );

-- Coaches/admins can insert history
CREATE POLICY "Authenticated insert plan history"
  ON public.plan_history FOR INSERT
  TO authenticated
  WITH CHECK (performed_by = auth.uid());
