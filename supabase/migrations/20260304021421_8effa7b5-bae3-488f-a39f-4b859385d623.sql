-- Allow master admins to view ALL organizations (needed for admin panel)
CREATE POLICY "Master admins can view all orgs"
ON public.organizations
FOR SELECT
USING (public.has_role(auth.uid(), 'master_admin'::app_role));