
-- Allow admins/master_admins to update roles in their org
CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (
  has_org_role(auth.uid(), organization_id, 'admin'::app_role)
  OR has_org_role(auth.uid(), organization_id, 'master_admin'::app_role)
)
WITH CHECK (
  has_org_role(auth.uid(), organization_id, 'admin'::app_role)
  OR has_org_role(auth.uid(), organization_id, 'master_admin'::app_role)
);

-- Allow admins/master_admins to delete roles in their org
CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  has_org_role(auth.uid(), organization_id, 'admin'::app_role)
  OR has_org_role(auth.uid(), organization_id, 'master_admin'::app_role)
);
