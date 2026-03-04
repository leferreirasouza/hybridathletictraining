-- Allow master admins to view all profiles (needed for admin user management)
CREATE POLICY "Master admins can view all profiles"
ON public.profiles
FOR SELECT
USING (public.has_role(auth.uid(), 'master_admin'::app_role));