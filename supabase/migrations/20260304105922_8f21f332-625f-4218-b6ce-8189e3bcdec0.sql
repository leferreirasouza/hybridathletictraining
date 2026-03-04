-- Drop existing broad write policy
DROP POLICY IF EXISTS "Coaches and admins manage exercises" ON public.exercise_library;

-- Create master_admin-only write policy
CREATE POLICY "Master admins manage exercises"
ON public.exercise_library
FOR ALL
TO authenticated
USING (has_org_role(auth.uid(), organization_id, 'master_admin'::app_role))
WITH CHECK (has_org_role(auth.uid(), organization_id, 'master_admin'::app_role));
