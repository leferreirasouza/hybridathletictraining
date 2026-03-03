// HYROX Coach OS — Core Types

export type AppRole = 'master_admin' | 'admin' | 'coach' | 'athlete';

export type HyroxStation =
  | 'skierg' | 'sled_push' | 'sled_pull' | 'burpee_broad_jump'
  | 'row' | 'farmers_carry' | 'sandbag_lunges' | 'wall_balls';

export type Discipline =
  | 'run' | 'bike' | 'stairs' | 'rowing' | 'skierg'
  | 'mobility' | 'strength' | 'accessories' | 'hyrox_station'
  | 'prehab' | 'custom';

export type Intensity = 'easy' | 'moderate' | 'hard' | 'race_pace' | 'max_effort';

export interface Organization {
  id: string;
  name: string;
  logo_url?: string;
  created_at: string;
}

export interface Membership {
  id: string;
  user_id: string;
  organization_id: string;
  role: AppRole;
}

export interface TrainingPlan {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  created_by: string;
  is_template: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlanVersion {
  id: string;
  plan_id: string;
  version_number: number;
  notes?: string;
  created_by: string;
  created_at: string;
}

export interface PlannedSession {
  id: string;
  plan_version_id: string;
  athlete_id?: string;
  date: string;
  week_number: number;
  day_of_week: number;
  discipline: Discipline;
  session_name: string;
  distance_km?: number;
  duration_min?: number;
  intensity?: Intensity;
  workout_details?: string;
  notes?: string;
  order_index: number;
}

export interface SessionBlock {
  id: string;
  session_id: string;
  block_type: 'warmup' | 'main' | 'cooldown' | 'station' | 'strength' | 'accessory';
  exercise_name: string;
  sets?: number;
  reps?: number;
  duration_sec?: number;
  distance_m?: number;
  load_kg?: number;
  target_hr_min?: number;
  target_hr_max?: number;
  target_pace?: string; // min/km
  target_power_watts?: number;
  target_rpe?: number;
  notes?: string;
  order_index: number;
}

export interface CompletedSession {
  id: string;
  planned_session_id?: string;
  athlete_id: string;
  date: string;
  discipline: Discipline;
  actual_duration_min?: number;
  actual_distance_km?: number;
  avg_hr?: number;
  max_hr?: number;
  avg_pace?: string;
  rpe?: number;
  soreness?: number;
  pain_flag: boolean;
  pain_notes?: string;
  notes?: string;
  completed_at: string;
}

export interface WeeklySummary {
  week: number;
  week_start: string;
  week_end: string;
  run_km_target?: number;
  run_days?: number;
  bike_z2_min_target?: number;
  notes?: string;
}

export interface Target {
  id: string;
  plan_version_id: string;
  type: string;
  primary_target: string;
  secondary_guardrail?: string;
  current_reference?: string;
  usage_guide?: string;
}

export interface GarminWorkout {
  id: string;
  plan_version_id: string;
  workout_name: string;
  when_week_day: string;
  steps_garmin_style: string;
  target_type?: string;
  target_guidance?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  created_at: string;
}

export interface CoachAthleteAssignment {
  id: string;
  coach_id: string;
  athlete_id: string;
  organization_id: string;
  plan_id?: string;
}
