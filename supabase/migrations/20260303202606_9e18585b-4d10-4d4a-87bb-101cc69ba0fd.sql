
CREATE POLICY "Assigned coaches and athletes can view each others profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.coach_athlete_assignments ca
    WHERE (ca.coach_id = auth.uid() AND ca.athlete_id = profiles.id)
       OR (ca.athlete_id = auth.uid() AND ca.coach_id = profiles.id)
  )
);
