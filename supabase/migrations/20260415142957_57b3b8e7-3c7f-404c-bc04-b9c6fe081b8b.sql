
-- PAR-Q Health Screening Questionnaire responses
CREATE TABLE public.parq_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  athlete_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Standard PAR-Q questions (yes/no)
  q1_heart_condition BOOLEAN NOT NULL DEFAULT false,
  q2_chest_pain_activity BOOLEAN NOT NULL DEFAULT false,
  q3_chest_pain_rest BOOLEAN NOT NULL DEFAULT false,
  q4_dizziness BOOLEAN NOT NULL DEFAULT false,
  q5_bone_joint BOOLEAN NOT NULL DEFAULT false,
  q6_blood_pressure_meds BOOLEAN NOT NULL DEFAULT false,
  q7_other_reason BOOLEAN NOT NULL DEFAULT false,
  
  -- Additional context
  medical_notes TEXT,
  has_risk_flags BOOLEAN GENERATED ALWAYS AS (
    q1_heart_condition OR q2_chest_pain_activity OR q3_chest_pain_rest OR 
    q4_dizziness OR q5_bone_joint OR q6_blood_pressure_meds OR q7_other_reason
  ) STORED,
  
  -- Soft warning acknowledgment
  risk_acknowledged BOOLEAN NOT NULL DEFAULT false,
  risk_acknowledged_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Fitness assessment (detailed intake)
CREATE TABLE public.fitness_assessments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  athlete_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Training history
  training_years INTEGER,
  weekly_training_hours NUMERIC,
  current_disciplines TEXT[] DEFAULT '{}',
  previous_race_experience TEXT,
  
  -- Injury history
  current_injuries TEXT,
  past_injuries TEXT,
  mobility_limitations TEXT,
  
  -- Health markers
  resting_hr INTEGER,
  vo2_max_estimate NUMERIC,
  body_fat_pct NUMERIC,
  
  -- Lifestyle
  sleep_hours_avg NUMERIC,
  stress_level INTEGER CHECK (stress_level BETWEEN 1 AND 10),
  nutrition_quality INTEGER CHECK (nutrition_quality BETWEEN 1 AND 10),
  
  -- Assessment outcome
  recommended_fitness_level TEXT DEFAULT 'intermediate',
  assessor_notes TEXT,
  assessed_by UUID,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add review/approval columns to knowledge_documents
ALTER TABLE public.knowledge_documents 
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_by UUID,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS safety_notes TEXT;

-- RLS for parq_responses
ALTER TABLE public.parq_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Athletes manage own parq" ON public.parq_responses
  FOR ALL TO authenticated
  USING (athlete_id = auth.uid())
  WITH CHECK (athlete_id = auth.uid());

CREATE POLICY "Coaches view athlete parq" ON public.parq_responses
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM coach_athlete_assignments ca
    WHERE ca.coach_id = auth.uid() AND ca.athlete_id = parq_responses.athlete_id
  ));

CREATE POLICY "Admins view all parq" ON public.parq_responses
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'master_admin') OR has_role(auth.uid(), 'admin'));

-- RLS for fitness_assessments
ALTER TABLE public.fitness_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Athletes manage own assessment" ON public.fitness_assessments
  FOR ALL TO authenticated
  USING (athlete_id = auth.uid())
  WITH CHECK (athlete_id = auth.uid());

CREATE POLICY "Coaches view athlete assessment" ON public.fitness_assessments
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM coach_athlete_assignments ca
    WHERE ca.coach_id = auth.uid() AND ca.athlete_id = fitness_assessments.athlete_id
  ));

CREATE POLICY "Admins view all assessments" ON public.fitness_assessments
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'master_admin') OR has_role(auth.uid(), 'admin'));
