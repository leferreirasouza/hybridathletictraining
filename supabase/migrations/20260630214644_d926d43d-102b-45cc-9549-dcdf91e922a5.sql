
-- 1) Avatars: explicit public SELECT policy
DROP POLICY IF EXISTS "Public can view avatars" ON storage.objects;
CREATE POLICY "Public can view avatars"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'avatars');

-- 2) Race screenshots: athlete can update/delete own files
DROP POLICY IF EXISTS "Athletes can update own race screenshots" ON storage.objects;
CREATE POLICY "Athletes can update own race screenshots"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'race-screenshots'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'race-screenshots'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Athletes can delete own race screenshots" ON storage.objects;
CREATE POLICY "Athletes can delete own race screenshots"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'race-screenshots'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 3) Realtime: require authenticated subscriptions on realtime.messages
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read realtime messages" ON realtime.messages;
CREATE POLICY "Authenticated users can read realtime messages"
ON realtime.messages FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated users can send realtime messages" ON realtime.messages;
CREATE POLICY "Authenticated users can send realtime messages"
ON realtime.messages FOR INSERT
TO authenticated
WITH CHECK (true);

-- 4) user_roles: prevent org admins from updating admin/master_admin rows
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
CREATE POLICY "Admins can update roles" ON public.user_roles
FOR UPDATE
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
