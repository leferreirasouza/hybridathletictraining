
-- Allow all authenticated users to see organizations (needed for onboarding org picker)
CREATE POLICY "Authenticated users can list orgs"
  ON public.organizations FOR SELECT
  USING (auth.uid() IS NOT NULL);
