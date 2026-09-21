UPDATE public.exercise_library
SET description = 'Unilateral hinge. Balance and posterior chain. High value where asymmetry or leg-length differences are present.'
WHERE name = 'Single-Leg Romanian Deadlift'
  AND description LIKE '%leg length discrepancy%';