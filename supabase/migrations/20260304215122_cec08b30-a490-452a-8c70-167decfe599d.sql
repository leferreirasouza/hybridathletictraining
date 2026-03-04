-- Create storage bucket for knowledge files
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('knowledge-files', 'knowledge-files', false, 20971520)
ON CONFLICT (id) DO NOTHING;

-- RLS: Coaches and admins can upload
CREATE POLICY "Coaches and admins upload knowledge files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'knowledge-files' AND
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('coach', 'admin', 'master_admin'))
);

-- RLS: Coaches and admins can read
CREATE POLICY "Coaches and admins read knowledge files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'knowledge-files' AND
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('coach', 'admin', 'master_admin'))
);

-- RLS: Master admins can delete knowledge files
CREATE POLICY "Master admins delete knowledge files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'knowledge-files' AND
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'master_admin')
);