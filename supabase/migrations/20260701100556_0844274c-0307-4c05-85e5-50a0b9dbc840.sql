
-- 1. Avatars: drop broad public SELECT that enables listing.
-- Public URLs continue to work through the storage CDN without an RLS SELECT policy.
DROP POLICY IF EXISTS "Public can view avatars" ON storage.objects;

-- 2. Realtime messages: scope to per-user topics (topic must contain the caller's uid).
DROP POLICY IF EXISTS "Authenticated users can read realtime messages" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated users can send realtime messages" ON realtime.messages;

CREATE POLICY "Users read own topic realtime messages"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    realtime.topic() IS NOT NULL
    AND auth.uid() IS NOT NULL
    AND position((auth.uid())::text in realtime.topic()) > 0
  );

CREATE POLICY "Users send to own topic realtime messages"
  ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    realtime.topic() IS NOT NULL
    AND auth.uid() IS NOT NULL
    AND position((auth.uid())::text in realtime.topic()) > 0
  );

-- 3. user_roles UPDATE: prevent admins from touching master_admin rows.
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;

CREATE POLICY "Admins can update roles"
  ON public.user_roles
  FOR UPDATE
  TO authenticated
  USING (
    has_org_role(auth.uid(), organization_id, 'master_admin'::app_role)
    OR (
      has_org_role(auth.uid(), organization_id, 'admin'::app_role)
      AND role = ANY (ARRAY['coach'::app_role, 'athlete'::app_role])
    )
  )
  WITH CHECK (
    has_org_role(auth.uid(), organization_id, 'master_admin'::app_role)
    OR (
      has_org_role(auth.uid(), organization_id, 'admin'::app_role)
      AND role = ANY (ARRAY['coach'::app_role, 'athlete'::app_role])
    )
  );

-- Also lock DELETE the same way so admins can't delete master_admin rows.
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;

CREATE POLICY "Admins can delete roles"
  ON public.user_roles
  FOR DELETE
  TO authenticated
  USING (
    has_org_role(auth.uid(), organization_id, 'master_admin'::app_role)
    OR (
      has_org_role(auth.uid(), organization_id, 'admin'::app_role)
      AND role = ANY (ARRAY['coach'::app_role, 'athlete'::app_role])
    )
  );
