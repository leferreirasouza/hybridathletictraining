-- Sync bookkeeping on the Strava connection
ALTER TABLE public.strava_connections ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ;
ALTER TABLE public.strava_connections ADD COLUMN IF NOT EXISTS last_sync_status TEXT;
ALTER TABLE public.strava_connections ADD COLUMN IF NOT EXISTS last_sync_count INTEGER;

-- Athlete-controlled "ignore this activity" flag
ALTER TABLE public.strava_activities ADD COLUMN IF NOT EXISTS ignored BOOLEAN NOT NULL DEFAULT false;

GRANT UPDATE ON public.strava_activities TO authenticated;

DROP POLICY IF EXISTS "Athletes update own strava activities" ON public.strava_activities;
CREATE POLICY "Athletes update own strava activities" ON public.strava_activities
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_strava_activities_inbox
  ON public.strava_activities(user_id, ignored, start_date_local DESC);

-- ============================================================
-- Security: knowledge-files must be scoped to the owning org
-- ============================================================
DROP POLICY IF EXISTS "Coaches and admins read knowledge files" ON storage.objects;
CREATE POLICY "Coaches and admins read knowledge files" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'knowledge-files'
    AND (
      public.has_role(auth.uid(), 'master_admin')
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role IN ('coach', 'admin', 'master_admin')
          AND ur.organization_id::text = (storage.foldername(name))[1]
      )
    )
  );

DROP POLICY IF EXISTS "Coaches and admins upload knowledge files" ON storage.objects;
CREATE POLICY "Coaches and admins upload knowledge files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'knowledge-files'
    AND (
      public.has_role(auth.uid(), 'master_admin')
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role IN ('coach', 'admin', 'master_admin')
          AND ur.organization_id::text = (storage.foldername(name))[1]
      )
    )
  );

DROP POLICY IF EXISTS "Coaches and admins update knowledge files" ON storage.objects;
CREATE POLICY "Coaches and admins update knowledge files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'knowledge-files'
    AND (
      public.has_role(auth.uid(), 'master_admin')
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role IN ('coach', 'admin', 'master_admin')
          AND ur.organization_id::text = (storage.foldername(name))[1]
      )
    )
  )
  WITH CHECK (
    bucket_id = 'knowledge-files'
    AND (
      public.has_role(auth.uid(), 'master_admin')
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role IN ('coach', 'admin', 'master_admin')
          AND ur.organization_id::text = (storage.foldername(name))[1]
      )
    )
  );

-- ============================================================
-- Security: plan_history inserts must be scoped to the plan
-- ============================================================
DROP POLICY IF EXISTS "Authenticated insert plan history" ON public.plan_history;
CREATE POLICY "Plan owners and org staff insert plan history" ON public.plan_history
  FOR INSERT TO authenticated
  WITH CHECK (
    performed_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.training_plans tp
      WHERE tp.id = plan_history.plan_id
        AND (
          tp.created_by = auth.uid()
          OR public.has_role(auth.uid(), 'master_admin')
          OR public.has_org_role(auth.uid(), tp.organization_id, 'coach')
          OR public.has_org_role(auth.uid(), tp.organization_id, 'admin')
        )
    )
  );