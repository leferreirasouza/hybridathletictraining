
-- Insert 3 dummy organizations
INSERT INTO public.organizations (name) VALUES
  ('HYROX São Paulo'),
  ('HYROX Rio de Janeiro'),
  ('HYROX Belo Horizonte');

-- Restrict org creation to master_admins only
DROP POLICY IF EXISTS "Authenticated users can create orgs" ON public.organizations;
CREATE POLICY "Master admins can create orgs"
  ON public.organizations FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'master_admin'::app_role));
