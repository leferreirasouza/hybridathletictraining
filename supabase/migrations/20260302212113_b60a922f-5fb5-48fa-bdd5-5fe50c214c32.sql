
-- ============================================================
-- HYROX Coach OS — Core Database Schema
-- ============================================================

-- Roles enum
CREATE TYPE public.app_role AS ENUM ('master_admin', 'coach', 'athlete');

-- Disciplines enum
CREATE TYPE public.discipline AS ENUM (
  'run', 'bike', 'stairs', 'rowing', 'skierg',
  'mobility', 'strength', 'accessories', 'hyrox_station',
  'prehab', 'custom'
);

-- Intensity enum
CREATE TYPE public.intensity_level AS ENUM ('easy', 'moderate', 'hard', 'race_pace', 'max_effort');

-- Block types
CREATE TYPE public.block_type AS ENUM ('warmup', 'main', 'cooldown', 'station', 'strength', 'accessory');

-- ============================================================
-- Profiles
-- ============================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- Organizations
-- ============================================================
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- User Roles (per org)
-- ============================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'athlete',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, organization_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(_user_id UUID, _org_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND organization_id = _org_id AND role = _role
  )
$$;

-- Org RLS: members can view their orgs
CREATE POLICY "Members can view own orgs" ON public.organizations FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.organization_id = organizations.id AND user_roles.user_id = auth.uid()));
CREATE POLICY "Admins can create orgs" ON public.organizations FOR INSERT
  WITH CHECK (true);
CREATE POLICY "Admins can update orgs" ON public.organizations FOR UPDATE
  USING (public.has_org_role(auth.uid(), id, 'master_admin') OR public.has_org_role(auth.uid(), id, 'coach'));

-- User roles RLS
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admins/coaches can view org roles" ON public.user_roles FOR SELECT
  USING (public.has_org_role(auth.uid(), organization_id, 'coach') OR public.has_org_role(auth.uid(), organization_id, 'master_admin'));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR INSERT
  WITH CHECK (public.has_org_role(auth.uid(), organization_id, 'master_admin') OR public.has_org_role(auth.uid(), organization_id, 'coach'));
CREATE POLICY "Users can insert own role" ON public.user_roles FOR INSERT WITH CHECK (user_id = auth.uid());

-- ============================================================
-- Coach-Athlete Assignments
-- ============================================================
CREATE TABLE public.coach_athlete_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  athlete_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (coach_id, athlete_id, organization_id)
);
ALTER TABLE public.coach_athlete_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Coaches see own assignments" ON public.coach_athlete_assignments FOR SELECT
  USING (coach_id = auth.uid() OR athlete_id = auth.uid());
CREATE POLICY "Coaches create assignments" ON public.coach_athlete_assignments FOR INSERT
  WITH CHECK (public.has_org_role(auth.uid(), organization_id, 'coach') OR public.has_org_role(auth.uid(), organization_id, 'master_admin'));

-- ============================================================
-- Training Plans
-- ============================================================
CREATE TABLE public.training_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  is_template BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.training_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can view plans" ON public.training_plans FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.organization_id = training_plans.organization_id AND user_roles.user_id = auth.uid()));
CREATE POLICY "Coaches can manage plans" ON public.training_plans FOR INSERT
  WITH CHECK (public.has_org_role(auth.uid(), organization_id, 'coach') OR public.has_org_role(auth.uid(), organization_id, 'master_admin'));
CREATE POLICY "Coaches can update plans" ON public.training_plans FOR UPDATE
  USING (public.has_org_role(auth.uid(), organization_id, 'coach') OR public.has_org_role(auth.uid(), organization_id, 'master_admin'));

-- ============================================================
-- Plan Versions
-- ============================================================
CREATE TABLE public.plan_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.training_plans(id) ON DELETE CASCADE,
  version_number INT NOT NULL DEFAULT 1,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.plan_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can view versions" ON public.plan_versions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.training_plans tp
    JOIN public.user_roles ur ON ur.organization_id = tp.organization_id
    WHERE tp.id = plan_versions.plan_id AND ur.user_id = auth.uid()
  ));
CREATE POLICY "Coaches can create versions" ON public.plan_versions FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.training_plans tp
    WHERE tp.id = plan_versions.plan_id
    AND (public.has_org_role(auth.uid(), tp.organization_id, 'coach') OR public.has_org_role(auth.uid(), tp.organization_id, 'master_admin'))
  ));

-- ============================================================
-- Planned Sessions (matches spreadsheet rows)
-- ============================================================
CREATE TABLE public.planned_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_version_id UUID NOT NULL REFERENCES public.plan_versions(id) ON DELETE CASCADE,
  athlete_id UUID REFERENCES auth.users(id),
  date DATE,
  week_number INT NOT NULL DEFAULT 1,
  day_of_week INT NOT NULL DEFAULT 1,
  discipline public.discipline NOT NULL DEFAULT 'run',
  session_name TEXT NOT NULL DEFAULT '',
  distance_km NUMERIC,
  duration_min NUMERIC,
  intensity public.intensity_level,
  workout_details TEXT,
  notes TEXT,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.planned_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can view sessions" ON public.planned_sessions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.plan_versions pv
    JOIN public.training_plans tp ON tp.id = pv.plan_id
    JOIN public.user_roles ur ON ur.organization_id = tp.organization_id
    WHERE pv.id = planned_sessions.plan_version_id AND ur.user_id = auth.uid()
  ));
CREATE POLICY "Coaches can manage sessions" ON public.planned_sessions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.plan_versions pv
    JOIN public.training_plans tp ON tp.id = pv.plan_id
    WHERE pv.id = planned_sessions.plan_version_id
    AND (public.has_org_role(auth.uid(), tp.organization_id, 'coach') OR public.has_org_role(auth.uid(), tp.organization_id, 'master_admin'))
  ));

-- ============================================================
-- Session Blocks (detailed structure within a session)
-- ============================================================
CREATE TABLE public.session_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.planned_sessions(id) ON DELETE CASCADE,
  block_type public.block_type NOT NULL DEFAULT 'main',
  exercise_name TEXT NOT NULL DEFAULT '',
  sets INT,
  reps INT,
  duration_sec INT,
  distance_m NUMERIC,
  load_kg NUMERIC,
  target_hr_min INT,
  target_hr_max INT,
  target_pace TEXT,
  target_power_watts INT,
  target_rpe INT,
  notes TEXT,
  order_index INT NOT NULL DEFAULT 0
);
ALTER TABLE public.session_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View session blocks" ON public.session_blocks FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.planned_sessions ps
    JOIN public.plan_versions pv ON pv.id = ps.plan_version_id
    JOIN public.training_plans tp ON tp.id = pv.plan_id
    JOIN public.user_roles ur ON ur.organization_id = tp.organization_id
    WHERE ps.id = session_blocks.session_id AND ur.user_id = auth.uid()
  ));
CREATE POLICY "Coaches manage blocks" ON public.session_blocks FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.planned_sessions ps
    JOIN public.plan_versions pv ON pv.id = ps.plan_version_id
    JOIN public.training_plans tp ON tp.id = pv.plan_id
    WHERE ps.id = session_blocks.session_id
    AND (public.has_org_role(auth.uid(), tp.organization_id, 'coach') OR public.has_org_role(auth.uid(), tp.organization_id, 'master_admin'))
  ));

-- ============================================================
-- Completed Sessions (athlete logs)
-- ============================================================
CREATE TABLE public.completed_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planned_session_id UUID REFERENCES public.planned_sessions(id),
  athlete_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  discipline public.discipline NOT NULL DEFAULT 'run',
  actual_duration_min NUMERIC,
  actual_distance_km NUMERIC,
  avg_hr INT,
  max_hr INT,
  avg_pace TEXT,
  rpe INT CHECK (rpe >= 1 AND rpe <= 10),
  soreness INT CHECK (soreness >= 0 AND soreness <= 10),
  pain_flag BOOLEAN NOT NULL DEFAULT false,
  pain_notes TEXT,
  notes TEXT,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.completed_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Athletes view own completed" ON public.completed_sessions FOR SELECT USING (athlete_id = auth.uid());
CREATE POLICY "Athletes insert own completed" ON public.completed_sessions FOR INSERT WITH CHECK (athlete_id = auth.uid());
CREATE POLICY "Athletes update own completed" ON public.completed_sessions FOR UPDATE USING (athlete_id = auth.uid());
CREATE POLICY "Coaches view athlete completed" ON public.completed_sessions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.coach_athlete_assignments ca WHERE ca.coach_id = auth.uid() AND ca.athlete_id = completed_sessions.athlete_id
  ));

-- ============================================================
-- Targets (matches Targets sheet)
-- ============================================================
CREATE TABLE public.targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_version_id UUID NOT NULL REFERENCES public.plan_versions(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  primary_target TEXT NOT NULL,
  secondary_guardrail TEXT,
  current_reference TEXT,
  usage_guide TEXT
);
ALTER TABLE public.targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members view targets" ON public.targets FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.plan_versions pv
    JOIN public.training_plans tp ON tp.id = pv.plan_id
    JOIN public.user_roles ur ON ur.organization_id = tp.organization_id
    WHERE pv.id = targets.plan_version_id AND ur.user_id = auth.uid()
  ));

-- ============================================================
-- Garmin Workouts (matches Garmin Workouts sheet)
-- ============================================================
CREATE TABLE public.garmin_workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_version_id UUID NOT NULL REFERENCES public.plan_versions(id) ON DELETE CASCADE,
  workout_name TEXT NOT NULL,
  when_week_day TEXT,
  steps_garmin_style TEXT,
  target_type TEXT,
  target_guidance TEXT
);
ALTER TABLE public.garmin_workouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members view garmin" ON public.garmin_workouts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.plan_versions pv
    JOIN public.training_plans tp ON tp.id = pv.plan_id
    JOIN public.user_roles ur ON ur.organization_id = tp.organization_id
    WHERE pv.id = garmin_workouts.plan_version_id AND ur.user_id = auth.uid()
  ));

-- ============================================================
-- AI Threads & Messages
-- ============================================================
CREATE TABLE public.ai_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own threads" ON public.ai_threads FOR ALL USING (user_id = auth.uid());

CREATE TABLE public.ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.ai_threads(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own messages" ON public.ai_messages FOR ALL
  USING (EXISTS (SELECT 1 FROM public.ai_threads t WHERE t.id = ai_messages.thread_id AND t.user_id = auth.uid()));

-- ============================================================
-- Audit Log
-- ============================================================
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view audit" ON public.audit_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'master_admin'));
CREATE POLICY "System inserts audit" ON public.audit_logs FOR INSERT WITH CHECK (true);

-- ============================================================
-- Updated_at trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON public.training_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
