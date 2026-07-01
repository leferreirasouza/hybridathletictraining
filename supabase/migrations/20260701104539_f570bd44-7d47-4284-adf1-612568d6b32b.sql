
-- 1) Convert has_role/has_org_role dependent policies to authenticated-only
DROP POLICY IF EXISTS "Master admins can create orgs" ON public.organizations;
CREATE POLICY "Master admins can create orgs" ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'master_admin'::public.app_role));

DROP POLICY IF EXISTS "Master admins can view all orgs" ON public.organizations;
CREATE POLICY "Master admins can view all orgs" ON public.organizations
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'master_admin'::public.app_role));

DROP POLICY IF EXISTS "Master admins can delete orgs" ON public.organizations;
CREATE POLICY "Master admins can delete orgs" ON public.organizations
  FOR DELETE TO authenticated
  USING (public.has_org_role(auth.uid(), id, 'master_admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can update orgs" ON public.organizations;
CREATE POLICY "Admins can update orgs" ON public.organizations
  FOR UPDATE TO authenticated
  USING (public.has_org_role(auth.uid(), id, 'master_admin'::public.app_role)
      OR public.has_org_role(auth.uid(), id, 'admin'::public.app_role));

DROP POLICY IF EXISTS "Master admins can view all profiles" ON public.profiles;
CREATE POLICY "Master admins can view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'master_admin'::public.app_role));

DROP POLICY IF EXISTS "Only admins can delete profiles" ON public.profiles;
CREATE POLICY "Only admins can delete profiles" ON public.profiles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'master_admin'::public.app_role));

DROP POLICY IF EXISTS "Coaches and admins manage documents" ON public.knowledge_documents;
CREATE POLICY "Coaches and admins manage documents" ON public.knowledge_documents
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'coach'::public.app_role)
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'master_admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'coach'::public.app_role)
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'master_admin'::public.app_role));

DROP POLICY IF EXISTS "Coaches and admins manage chunks" ON public.knowledge_chunks;
CREATE POLICY "Coaches and admins manage chunks" ON public.knowledge_chunks
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'coach'::public.app_role)
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'master_admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'coach'::public.app_role)
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'master_admin'::public.app_role));

DROP POLICY IF EXISTS "Admins view org assignments" ON public.coach_athlete_assignments;
CREATE POLICY "Admins view org assignments" ON public.coach_athlete_assignments
  FOR SELECT TO authenticated
  USING (public.has_org_role(auth.uid(), organization_id, 'admin'::public.app_role)
      OR public.has_org_role(auth.uid(), organization_id, 'master_admin'::public.app_role)
      OR public.has_role(auth.uid(), 'master_admin'::public.app_role));

-- 2) Revoke anon EXECUTE on has_role/has_org_role
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, public.app_role) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, public.app_role) TO authenticated, service_role;

-- 3) Avatars: add authenticated-only SELECT policy so anon cannot list via SDK
DROP POLICY IF EXISTS "Authenticated users can list avatars" ON storage.objects;
CREATE POLICY "Authenticated users can list avatars" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');

-- 4) Realtime messages: strict structured topic check
DROP POLICY IF EXISTS "Users read own topic realtime messages" ON realtime.messages;
DROP POLICY IF EXISTS "Users send to own topic realtime messages" ON realtime.messages;

CREATE POLICY "Users read own topic realtime messages" ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND realtime.topic() IS NOT NULL
    AND (
      realtime.topic() = 'user:' || (auth.uid())::text
      OR starts_with(realtime.topic(), 'user:' || (auth.uid())::text || ':')
      OR starts_with(realtime.topic(), 'dm:' || (auth.uid())::text || ':')
    )
  );

CREATE POLICY "Users send to own topic realtime messages" ON realtime.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND realtime.topic() IS NOT NULL
    AND (
      realtime.topic() = 'user:' || (auth.uid())::text
      OR starts_with(realtime.topic(), 'user:' || (auth.uid())::text || ':')
      OR starts_with(realtime.topic(), 'dm:' || (auth.uid())::text || ':')
    )
  );
