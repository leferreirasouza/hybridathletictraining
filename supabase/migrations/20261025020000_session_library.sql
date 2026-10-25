-- Session library (2026-10-25): a catalogue of named, evidence-backed
-- session templates that generate-plan must pick from, so every planned
-- session can say *why* it is in the plan. Global entries (organization_id
-- NULL) are seeded by migration; coaches can add org-scoped entries that an
-- org admin approves before they can be used.

CREATE TABLE IF NOT EXISTS public.session_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code text NOT NULL CHECK (code ~ '^[A-Z0-9_]{3,40}$'),
  name text NOT NULL,
  discipline public.discipline NOT NULL,
  slot_type text NOT NULL CHECK (slot_type IN ('run', 'strength', 'mobility_technique', 'hyrox')),
  subtype text NULL,
  intensity text NOT NULL CHECK (intensity IN ('easy', 'moderate', 'hard', 'race_pace', 'max_effort')),
  objective text NOT NULL,
  execution text NOT NULL,
  progression text NULL,
  contraindications text NULL,
  rationale text NOT NULL,
  evidence_refs text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('validated', 'new', 'reference')),
  is_approved boolean NOT NULL DEFAULT false,
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT session_library_org_code_key UNIQUE NULLS NOT DISTINCT (organization_id, code)
);

ALTER TABLE public.session_library ENABLE ROW LEVEL SECURITY;

-- Staff of an org: the roles allowed to author library entries.
CREATE OR REPLACE FUNCTION public.is_org_staff(_user_id uuid, _org_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT _org_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND organization_id = _org_id
      AND role IN ('coach', 'admin', 'master_admin')
  )
$$;

-- Org admins: the roles allowed to approve.
CREATE OR REPLACE FUNCTION public.is_org_admin(_user_id uuid, _org_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT _org_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND organization_id = _org_id
      AND role IN ('admin', 'master_admin')
  )
$$;

DROP POLICY IF EXISTS "Read approved and own-org session library" ON public.session_library;
CREATE POLICY "Read approved and own-org session library" ON public.session_library
  FOR SELECT TO authenticated
  USING (
    (organization_id IS NULL AND is_approved)
    OR (is_approved AND EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid() AND ur.organization_id = session_library.organization_id))
    OR public.is_org_staff(auth.uid(), organization_id)
  );

-- Coaches add pending entries to their own org; only admins add approved ones.
DROP POLICY IF EXISTS "Staff add org session library entries" ON public.session_library;
CREATE POLICY "Staff add org session library entries" ON public.session_library
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IS NOT NULL
    AND created_by = auth.uid()
    AND public.is_org_staff(auth.uid(), organization_id)
    AND (NOT is_approved OR public.is_org_admin(auth.uid(), organization_id))
  );

-- Admins edit/approve anything in their org; a creator may edit their own
-- entry only while it is pending and cannot approve it.
DROP POLICY IF EXISTS "Edit org session library entries" ON public.session_library;
CREATE POLICY "Edit org session library entries" ON public.session_library
  FOR UPDATE TO authenticated
  USING (
    public.is_org_admin(auth.uid(), organization_id)
    OR (created_by = auth.uid() AND NOT is_approved AND public.is_org_staff(auth.uid(), organization_id))
  )
  WITH CHECK (
    organization_id IS NOT NULL
    AND (
      public.is_org_admin(auth.uid(), organization_id)
      OR (created_by = auth.uid() AND NOT is_approved AND public.is_org_staff(auth.uid(), organization_id))
    )
  );

DROP POLICY IF EXISTS "Delete org session library entries" ON public.session_library;
CREATE POLICY "Delete org session library entries" ON public.session_library
  FOR DELETE TO authenticated
  USING (
    public.is_org_admin(auth.uid(), organization_id)
    OR (created_by = auth.uid() AND NOT is_approved)
  );

-- Global entries (organization_id NULL) have no client write path at all:
-- every write policy above requires an organization the user belongs to.

CREATE OR REPLACE FUNCTION public.session_library_touch()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.is_approved AND NOT COALESCE(OLD.is_approved, false) THEN
    NEW.approved_by := auth.uid();
    NEW.approved_at := now();
  ELSIF NOT NEW.is_approved THEN
    NEW.approved_by := NULL;
    NEW.approved_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS session_library_touch ON public.session_library;
CREATE TRIGGER session_library_touch
  BEFORE UPDATE ON public.session_library
  FOR EACH ROW EXECUTE FUNCTION public.session_library_touch();

ALTER TABLE public.planned_sessions
  ADD COLUMN IF NOT EXISTS library_session_id uuid NULL
    REFERENCES public.session_library(id) ON DELETE SET NULL;
