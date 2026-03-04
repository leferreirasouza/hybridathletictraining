-- Make race-screenshots bucket private
UPDATE storage.buckets SET public = false WHERE id = 'race-screenshots';

-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Anyone can view race screenshots" ON storage.objects;

-- Create scoped SELECT policy: owner or their coach can view
CREATE POLICY "Athletes and coaches view race screenshots"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'race-screenshots'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.coach_athlete_assignments ca
        WHERE ca.coach_id = auth.uid()
        AND ca.athlete_id::text = (storage.foldername(name))[1]
      )
    )
  );