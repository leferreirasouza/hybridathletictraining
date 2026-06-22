export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ai_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          thread_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          thread_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "ai_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_threads: {
        Row: {
          created_at: string
          id: string
          title: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      coach_athlete_assignments: {
        Row: {
          athlete_id: string
          coach_id: string
          coach_type: string
          created_at: string
          id: string
          organization_id: string
        }
        Insert: {
          athlete_id: string
          coach_id: string
          coach_type?: string
          created_at?: string
          id?: string
          organization_id: string
        }
        Update: {
          athlete_id?: string
          coach_id?: string
          coach_type?: string
          created_at?: string
          id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_athlete_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      completed_sessions: {
        Row: {
          actual_distance_km: number | null
          actual_duration_min: number | null
          athlete_id: string
          avg_hr: number | null
          avg_pace: string | null
          completed_at: string
          date: string
          discipline: Database["public"]["Enums"]["discipline"]
          id: string
          max_hr: number | null
          notes: string | null
          pain_flag: boolean
          pain_notes: string | null
          planned_session_id: string | null
          rpe: number | null
          soreness: number | null
        }
        Insert: {
          actual_distance_km?: number | null
          actual_duration_min?: number | null
          athlete_id: string
          avg_hr?: number | null
          avg_pace?: string | null
          completed_at?: string
          date?: string
          discipline?: Database["public"]["Enums"]["discipline"]
          id?: string
          max_hr?: number | null
          notes?: string | null
          pain_flag?: boolean
          pain_notes?: string | null
          planned_session_id?: string | null
          rpe?: number | null
          soreness?: number | null
        }
        Update: {
          actual_distance_km?: number | null
          actual_duration_min?: number | null
          athlete_id?: string
          avg_hr?: number | null
          avg_pace?: string | null
          completed_at?: string
          date?: string
          discipline?: Database["public"]["Enums"]["discipline"]
          id?: string
          max_hr?: number | null
          notes?: string | null
          pain_flag?: boolean
          pain_notes?: string | null
          planned_session_id?: string | null
          rpe?: number | null
          soreness?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "completed_sessions_planned_session_id_fkey"
            columns: ["planned_session_id"]
            isOneToOne: false
            referencedRelation: "planned_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          read_at: string | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      equipment_presets: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          equipment: Json
          id: string
          name: string
          organization_id: string
          run_type_weights: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          equipment?: Json
          id?: string
          name: string
          organization_id: string
          run_type_weights?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          equipment?: Json
          id?: string
          name?: string
          organization_id?: string
          run_type_weights?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_presets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_library: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          category: string
          coaching_cues: string | null
          contraindications: string | null
          created_at: string
          created_by: string
          description: string | null
          difficulty_level: string
          discipline: string
          equipment_required: string[] | null
          hyrox_station: string | null
          id: string
          is_approved: boolean
          muscle_groups: string[] | null
          name: string
          organization_id: string
          progression_from: string | null
          progression_to: string | null
          source: string
          subcategory: string | null
          updated_at: string
          video_url: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          category?: string
          coaching_cues?: string | null
          contraindications?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          difficulty_level?: string
          discipline?: string
          equipment_required?: string[] | null
          hyrox_station?: string | null
          id?: string
          is_approved?: boolean
          muscle_groups?: string[] | null
          name: string
          organization_id: string
          progression_from?: string | null
          progression_to?: string | null
          source?: string
          subcategory?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          category?: string
          coaching_cues?: string | null
          contraindications?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          difficulty_level?: string
          discipline?: string
          equipment_required?: string[] | null
          hyrox_station?: string | null
          id?: string
          is_approved?: boolean
          muscle_groups?: string[] | null
          name?: string
          organization_id?: string
          progression_from?: string | null
          progression_to?: string | null
          source?: string
          subcategory?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercise_library_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      fitness_assessments: {
        Row: {
          assessed_by: string | null
          assessor_notes: string | null
          athlete_id: string
          body_fat_pct: number | null
          created_at: string
          current_disciplines: string[] | null
          current_injuries: string | null
          id: string
          mobility_limitations: string | null
          nutrition_quality: number | null
          past_injuries: string | null
          previous_race_experience: string | null
          recommended_fitness_level: string | null
          resting_hr: number | null
          sleep_hours_avg: number | null
          stress_level: number | null
          training_years: number | null
          updated_at: string
          vo2_max_estimate: number | null
          weekly_training_hours: number | null
        }
        Insert: {
          assessed_by?: string | null
          assessor_notes?: string | null
          athlete_id: string
          body_fat_pct?: number | null
          created_at?: string
          current_disciplines?: string[] | null
          current_injuries?: string | null
          id?: string
          mobility_limitations?: string | null
          nutrition_quality?: number | null
          past_injuries?: string | null
          previous_race_experience?: string | null
          recommended_fitness_level?: string | null
          resting_hr?: number | null
          sleep_hours_avg?: number | null
          stress_level?: number | null
          training_years?: number | null
          updated_at?: string
          vo2_max_estimate?: number | null
          weekly_training_hours?: number | null
        }
        Update: {
          assessed_by?: string | null
          assessor_notes?: string | null
          athlete_id?: string
          body_fat_pct?: number | null
          created_at?: string
          current_disciplines?: string[] | null
          current_injuries?: string | null
          id?: string
          mobility_limitations?: string | null
          nutrition_quality?: number | null
          past_injuries?: string | null
          previous_race_experience?: string | null
          recommended_fitness_level?: string | null
          resting_hr?: number | null
          sleep_hours_avg?: number | null
          stress_level?: number | null
          training_years?: number | null
          updated_at?: string
          vo2_max_estimate?: number | null
          weekly_training_hours?: number | null
        }
        Relationships: []
      }
      garmin_activities: {
        Row: {
          activity_id: string | null
          activity_type: string | null
          avg_hr: number | null
          avg_pace_min_per_km: number | null
          avg_speed_mps: number | null
          calories: number | null
          completed_session_id: string | null
          created_at: string
          device_name: string | null
          discipline: Database["public"]["Enums"]["discipline"] | null
          distance_m: number | null
          duration_sec: number | null
          elevation_gain_m: number | null
          id: string
          max_hr: number | null
          raw: Json
          start_time_local: string | null
          start_time_utc: string | null
          steps: number | null
          summary_id: string
          training_load: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_id?: string | null
          activity_type?: string | null
          avg_hr?: number | null
          avg_pace_min_per_km?: number | null
          avg_speed_mps?: number | null
          calories?: number | null
          completed_session_id?: string | null
          created_at?: string
          device_name?: string | null
          discipline?: Database["public"]["Enums"]["discipline"] | null
          distance_m?: number | null
          duration_sec?: number | null
          elevation_gain_m?: number | null
          id?: string
          max_hr?: number | null
          raw: Json
          start_time_local?: string | null
          start_time_utc?: string | null
          steps?: number | null
          summary_id: string
          training_load?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_id?: string | null
          activity_type?: string | null
          avg_hr?: number | null
          avg_pace_min_per_km?: number | null
          avg_speed_mps?: number | null
          calories?: number | null
          completed_session_id?: string | null
          created_at?: string
          device_name?: string | null
          discipline?: Database["public"]["Enums"]["discipline"] | null
          distance_m?: number | null
          duration_sec?: number | null
          elevation_gain_m?: number | null
          id?: string
          max_hr?: number | null
          raw?: Json
          start_time_local?: string | null
          start_time_utc?: string | null
          steps?: number | null
          summary_id?: string
          training_load?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "garmin_activities_completed_session_id_fkey"
            columns: ["completed_session_id"]
            isOneToOne: false
            referencedRelation: "completed_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      garmin_connections: {
        Row: {
          access_token: string | null
          access_token_secret: string | null
          created_at: string
          garmin_user_id: string | null
          id: string
          last_sync_at: string | null
          request_token: string | null
          request_token_secret: string | null
          scopes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          access_token_secret?: string | null
          created_at?: string
          garmin_user_id?: string | null
          id?: string
          last_sync_at?: string | null
          request_token?: string | null
          request_token_secret?: string | null
          scopes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          access_token_secret?: string | null
          created_at?: string
          garmin_user_id?: string | null
          id?: string
          last_sync_at?: string | null
          request_token?: string | null
          request_token_secret?: string | null
          scopes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      garmin_dailies: {
        Row: {
          active_kilocalories: number | null
          active_time_sec: number | null
          avg_hr: number | null
          avg_stress: number | null
          bmr_kilocalories: number | null
          body_battery_charged: number | null
          body_battery_drained: number | null
          calendar_date: string
          created_at: string
          distance_m: number | null
          floors_climbed: number | null
          hrv_ms: number | null
          id: string
          max_hr: number | null
          max_stress: number | null
          min_hr: number | null
          moderate_intensity_sec: number | null
          raw: Json
          respiration_avg: number | null
          resting_hr: number | null
          spo2_avg: number | null
          steps: number | null
          summary_id: string
          updated_at: string
          user_id: string
          vigorous_intensity_sec: number | null
        }
        Insert: {
          active_kilocalories?: number | null
          active_time_sec?: number | null
          avg_hr?: number | null
          avg_stress?: number | null
          bmr_kilocalories?: number | null
          body_battery_charged?: number | null
          body_battery_drained?: number | null
          calendar_date: string
          created_at?: string
          distance_m?: number | null
          floors_climbed?: number | null
          hrv_ms?: number | null
          id?: string
          max_hr?: number | null
          max_stress?: number | null
          min_hr?: number | null
          moderate_intensity_sec?: number | null
          raw: Json
          respiration_avg?: number | null
          resting_hr?: number | null
          spo2_avg?: number | null
          steps?: number | null
          summary_id: string
          updated_at?: string
          user_id: string
          vigorous_intensity_sec?: number | null
        }
        Update: {
          active_kilocalories?: number | null
          active_time_sec?: number | null
          avg_hr?: number | null
          avg_stress?: number | null
          bmr_kilocalories?: number | null
          body_battery_charged?: number | null
          body_battery_drained?: number | null
          calendar_date?: string
          created_at?: string
          distance_m?: number | null
          floors_climbed?: number | null
          hrv_ms?: number | null
          id?: string
          max_hr?: number | null
          max_stress?: number | null
          min_hr?: number | null
          moderate_intensity_sec?: number | null
          raw?: Json
          respiration_avg?: number | null
          resting_hr?: number | null
          spo2_avg?: number | null
          steps?: number | null
          summary_id?: string
          updated_at?: string
          user_id?: string
          vigorous_intensity_sec?: number | null
        }
        Relationships: []
      }
      garmin_sleep: {
        Row: {
          avg_hrv_ms: number | null
          avg_respiration: number | null
          avg_spo2: number | null
          awake_sec: number | null
          calendar_date: string
          created_at: string
          deep_sleep_sec: number | null
          duration_sec: number | null
          end_time_utc: string | null
          id: string
          light_sleep_sec: number | null
          raw: Json
          rem_sleep_sec: number | null
          sleep_score: number | null
          start_time_utc: string | null
          summary_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_hrv_ms?: number | null
          avg_respiration?: number | null
          avg_spo2?: number | null
          awake_sec?: number | null
          calendar_date: string
          created_at?: string
          deep_sleep_sec?: number | null
          duration_sec?: number | null
          end_time_utc?: string | null
          id?: string
          light_sleep_sec?: number | null
          raw: Json
          rem_sleep_sec?: number | null
          sleep_score?: number | null
          start_time_utc?: string | null
          summary_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_hrv_ms?: number | null
          avg_respiration?: number | null
          avg_spo2?: number | null
          awake_sec?: number | null
          calendar_date?: string
          created_at?: string
          deep_sleep_sec?: number | null
          duration_sec?: number | null
          end_time_utc?: string | null
          id?: string
          light_sleep_sec?: number | null
          raw?: Json
          rem_sleep_sec?: number | null
          sleep_score?: number | null
          start_time_utc?: string | null
          summary_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      garmin_workouts: {
        Row: {
          id: string
          plan_version_id: string
          steps_garmin_style: string | null
          target_guidance: string | null
          target_type: string | null
          when_week_day: string | null
          workout_name: string
        }
        Insert: {
          id?: string
          plan_version_id: string
          steps_garmin_style?: string | null
          target_guidance?: string | null
          target_type?: string | null
          when_week_day?: string | null
          workout_name: string
        }
        Update: {
          id?: string
          plan_version_id?: string
          steps_garmin_style?: string | null
          target_guidance?: string | null
          target_type?: string | null
          when_week_day?: string | null
          workout_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "garmin_workouts_plan_version_id_fkey"
            columns: ["plan_version_id"]
            isOneToOne: false
            referencedRelation: "plan_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          document_id: string
          embedding: string | null
          id: string
          metadata: Json | null
        }
        Insert: {
          chunk_index?: number
          content: string
          created_at?: string
          document_id: string
          embedding?: string | null
          id?: string
          metadata?: Json | null
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          document_id?: string
          embedding?: string | null
          id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "knowledge_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_documents: {
        Row: {
          content_text: string | null
          created_at: string
          file_path: string | null
          id: string
          is_verified: boolean
          metadata: Json | null
          organization_id: string
          safety_notes: string | null
          source_type: string
          source_url: string | null
          status: string
          title: string
          total_chunks: number | null
          updated_at: string
          uploaded_by: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          content_text?: string | null
          created_at?: string
          file_path?: string | null
          id?: string
          is_verified?: boolean
          metadata?: Json | null
          organization_id: string
          safety_notes?: string | null
          source_type?: string
          source_url?: string | null
          status?: string
          title: string
          total_chunks?: number | null
          updated_at?: string
          uploaded_by: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          content_text?: string | null
          created_at?: string
          file_path?: string | null
          id?: string
          is_verified?: boolean
          metadata?: Json | null
          organization_id?: string
          safety_notes?: string | null
          source_type?: string
          source_url?: string | null
          status?: string
          title?: string
          total_chunks?: number | null
          updated_at?: string
          uploaded_by?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
        }
        Relationships: []
      }
      parq_responses: {
        Row: {
          athlete_id: string
          completed_at: string
          created_at: string
          has_risk_flags: boolean | null
          id: string
          medical_notes: string | null
          q1_heart_condition: boolean
          q2_chest_pain_activity: boolean
          q3_chest_pain_rest: boolean
          q4_dizziness: boolean
          q5_bone_joint: boolean
          q6_blood_pressure_meds: boolean
          q7_other_reason: boolean
          risk_acknowledged: boolean
          risk_acknowledged_at: string | null
        }
        Insert: {
          athlete_id: string
          completed_at?: string
          created_at?: string
          has_risk_flags?: boolean | null
          id?: string
          medical_notes?: string | null
          q1_heart_condition?: boolean
          q2_chest_pain_activity?: boolean
          q3_chest_pain_rest?: boolean
          q4_dizziness?: boolean
          q5_bone_joint?: boolean
          q6_blood_pressure_meds?: boolean
          q7_other_reason?: boolean
          risk_acknowledged?: boolean
          risk_acknowledged_at?: string | null
        }
        Update: {
          athlete_id?: string
          completed_at?: string
          created_at?: string
          has_risk_flags?: boolean | null
          id?: string
          medical_notes?: string | null
          q1_heart_condition?: boolean
          q2_chest_pain_activity?: boolean
          q3_chest_pain_rest?: boolean
          q4_dizziness?: boolean
          q5_bone_joint?: boolean
          q6_blood_pressure_meds?: boolean
          q7_other_reason?: boolean
          risk_acknowledged?: boolean
          risk_acknowledged_at?: string | null
        }
        Relationships: []
      }
      periodization_adjustments: {
        Row: {
          adjustment_type: string
          athlete_id: string
          created_at: string
          id: string
          original_distance_km: number | null
          original_duration_min: number | null
          original_intensity: string | null
          reason_details: string | null
          source: string
          status: string
          suggested_distance_km: number | null
          suggested_duration_min: number | null
          suggested_intensity: string | null
          target_session_id: string
          tsb_at_suggestion: number | null
        }
        Insert: {
          adjustment_type: string
          athlete_id: string
          created_at?: string
          id?: string
          original_distance_km?: number | null
          original_duration_min?: number | null
          original_intensity?: string | null
          reason_details?: string | null
          source?: string
          status?: string
          suggested_distance_km?: number | null
          suggested_duration_min?: number | null
          suggested_intensity?: string | null
          target_session_id: string
          tsb_at_suggestion?: number | null
        }
        Update: {
          adjustment_type?: string
          athlete_id?: string
          created_at?: string
          id?: string
          original_distance_km?: number | null
          original_duration_min?: number | null
          original_intensity?: string | null
          reason_details?: string | null
          source?: string
          status?: string
          suggested_distance_km?: number | null
          suggested_duration_min?: number | null
          suggested_intensity?: string | null
          target_session_id?: string
          tsb_at_suggestion?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "periodization_adjustments_target_session_id_fkey"
            columns: ["target_session_id"]
            isOneToOne: false
            referencedRelation: "planned_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_history: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          performed_by: string
          plan_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          performed_by: string
          plan_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          performed_by?: string
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_history_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "training_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_versions: {
        Row: {
          created_at: string
          created_by: string
          id: string
          notes: string | null
          plan_id: string
          version_number: number
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          notes?: string | null
          plan_id: string
          version_number?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          plan_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "plan_versions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "training_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      planned_sessions: {
        Row: {
          athlete_id: string | null
          created_at: string
          date: string | null
          day_of_week: number
          discipline: Database["public"]["Enums"]["discipline"]
          distance_km: number | null
          duration_min: number | null
          id: string
          intensity: Database["public"]["Enums"]["intensity_level"] | null
          notes: string | null
          order_index: number
          plan_version_id: string
          session_name: string
          week_number: number
          workout_details: string | null
        }
        Insert: {
          athlete_id?: string | null
          created_at?: string
          date?: string | null
          day_of_week?: number
          discipline?: Database["public"]["Enums"]["discipline"]
          distance_km?: number | null
          duration_min?: number | null
          id?: string
          intensity?: Database["public"]["Enums"]["intensity_level"] | null
          notes?: string | null
          order_index?: number
          plan_version_id: string
          session_name?: string
          week_number?: number
          workout_details?: string | null
        }
        Update: {
          athlete_id?: string | null
          created_at?: string
          date?: string | null
          day_of_week?: number
          discipline?: Database["public"]["Enums"]["discipline"]
          distance_km?: number | null
          duration_min?: number | null
          id?: string
          intensity?: Database["public"]["Enums"]["intensity_level"] | null
          notes?: string | null
          order_index?: number
          plan_version_id?: string
          session_name?: string
          week_number?: number
          workout_details?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "planned_sessions_plan_version_id_fkey"
            columns: ["plan_version_id"]
            isOneToOne: false
            referencedRelation: "plan_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          age: number | null
          avatar_url: string | null
          created_at: string
          fitness_level: string | null
          full_name: string
          goal_finish_time_seconds: number | null
          goal_race_date: string | null
          goal_race_id: string | null
          goal_race_location: string | null
          goal_race_name: string | null
          goal_run_split_seconds_per_km: number | null
          id: string
          max_hr: number | null
          onboarding_completed: boolean | null
          resting_hr: number | null
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          age?: number | null
          avatar_url?: string | null
          created_at?: string
          fitness_level?: string | null
          full_name?: string
          goal_finish_time_seconds?: number | null
          goal_race_date?: string | null
          goal_race_id?: string | null
          goal_race_location?: string | null
          goal_race_name?: string | null
          goal_run_split_seconds_per_km?: number | null
          id: string
          max_hr?: number | null
          onboarding_completed?: boolean | null
          resting_hr?: number | null
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          age?: number | null
          avatar_url?: string | null
          created_at?: string
          fitness_level?: string | null
          full_name?: string
          goal_finish_time_seconds?: number | null
          goal_race_date?: string | null
          goal_race_id?: string | null
          goal_race_location?: string | null
          goal_race_name?: string | null
          goal_run_split_seconds_per_km?: number | null
          id?: string
          max_hr?: number | null
          onboarding_completed?: boolean | null
          resting_hr?: number | null
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_goal_race_id_fkey"
            columns: ["goal_race_id"]
            isOneToOne: false
            referencedRelation: "races_calendar"
            referencedColumns: ["id"]
          },
        ]
      }
      race_results: {
        Row: {
          athlete_id: string
          category: string | null
          created_at: string
          id: string
          input_method: string | null
          notes: string | null
          race_date: string
          race_location: string | null
          race_name: string | null
          run_1_seconds: number | null
          run_2_seconds: number | null
          run_3_seconds: number | null
          run_4_seconds: number | null
          run_5_seconds: number | null
          run_6_seconds: number | null
          run_7_seconds: number | null
          run_8_seconds: number | null
          screenshot_url: string | null
          station_1_seconds: number | null
          station_2_seconds: number | null
          station_3_seconds: number | null
          station_4_seconds: number | null
          station_5_seconds: number | null
          station_6_seconds: number | null
          station_7_seconds: number | null
          station_8_seconds: number | null
          total_time_seconds: number | null
          total_transition_seconds: number | null
        }
        Insert: {
          athlete_id: string
          category?: string | null
          created_at?: string
          id?: string
          input_method?: string | null
          notes?: string | null
          race_date: string
          race_location?: string | null
          race_name?: string | null
          run_1_seconds?: number | null
          run_2_seconds?: number | null
          run_3_seconds?: number | null
          run_4_seconds?: number | null
          run_5_seconds?: number | null
          run_6_seconds?: number | null
          run_7_seconds?: number | null
          run_8_seconds?: number | null
          screenshot_url?: string | null
          station_1_seconds?: number | null
          station_2_seconds?: number | null
          station_3_seconds?: number | null
          station_4_seconds?: number | null
          station_5_seconds?: number | null
          station_6_seconds?: number | null
          station_7_seconds?: number | null
          station_8_seconds?: number | null
          total_time_seconds?: number | null
          total_transition_seconds?: number | null
        }
        Update: {
          athlete_id?: string
          category?: string | null
          created_at?: string
          id?: string
          input_method?: string | null
          notes?: string | null
          race_date?: string
          race_location?: string | null
          race_name?: string | null
          run_1_seconds?: number | null
          run_2_seconds?: number | null
          run_3_seconds?: number | null
          run_4_seconds?: number | null
          run_5_seconds?: number | null
          run_6_seconds?: number | null
          run_7_seconds?: number | null
          run_8_seconds?: number | null
          screenshot_url?: string | null
          station_1_seconds?: number | null
          station_2_seconds?: number | null
          station_3_seconds?: number | null
          station_4_seconds?: number | null
          station_5_seconds?: number | null
          station_6_seconds?: number | null
          station_7_seconds?: number | null
          station_8_seconds?: number | null
          total_time_seconds?: number | null
          total_transition_seconds?: number | null
        }
        Relationships: []
      }
      races_calendar: {
        Row: {
          city: string | null
          continent: string | null
          country: string
          created_at: string
          created_by: string | null
          external_url: string | null
          id: string
          image_url: string | null
          is_verified: boolean
          location_detail: string | null
          race_date: string
          race_end_date: string | null
          race_name: string
          race_type: string
          source: string
          updated_at: string
        }
        Insert: {
          city?: string | null
          continent?: string | null
          country: string
          created_at?: string
          created_by?: string | null
          external_url?: string | null
          id?: string
          image_url?: string | null
          is_verified?: boolean
          location_detail?: string | null
          race_date: string
          race_end_date?: string | null
          race_name: string
          race_type?: string
          source?: string
          updated_at?: string
        }
        Update: {
          city?: string | null
          continent?: string | null
          country?: string
          created_at?: string
          created_by?: string | null
          external_url?: string | null
          id?: string
          image_url?: string | null
          is_verified?: boolean
          location_detail?: string | null
          race_date?: string
          race_end_date?: string | null
          race_name?: string
          race_type?: string
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      session_blocks: {
        Row: {
          block_type: Database["public"]["Enums"]["block_type"]
          distance_m: number | null
          duration_sec: number | null
          exercise_name: string
          id: string
          load_kg: number | null
          notes: string | null
          order_index: number
          reps: number | null
          session_id: string
          sets: number | null
          target_hr_max: number | null
          target_hr_min: number | null
          target_pace: string | null
          target_power_watts: number | null
          target_rpe: number | null
        }
        Insert: {
          block_type?: Database["public"]["Enums"]["block_type"]
          distance_m?: number | null
          duration_sec?: number | null
          exercise_name?: string
          id?: string
          load_kg?: number | null
          notes?: string | null
          order_index?: number
          reps?: number | null
          session_id: string
          sets?: number | null
          target_hr_max?: number | null
          target_hr_min?: number | null
          target_pace?: string | null
          target_power_watts?: number | null
          target_rpe?: number | null
        }
        Update: {
          block_type?: Database["public"]["Enums"]["block_type"]
          distance_m?: number | null
          duration_sec?: number | null
          exercise_name?: string
          id?: string
          load_kg?: number | null
          notes?: string | null
          order_index?: number
          reps?: number | null
          session_id?: string
          sets?: number | null
          target_hr_max?: number | null
          target_hr_min?: number | null
          target_pace?: string | null
          target_power_watts?: number | null
          target_rpe?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "session_blocks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "planned_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_substitutions: {
        Row: {
          athlete_id: string
          created_at: string
          id: string
          original_session_id: string
          reason: string
          reason_details: string | null
          source: string
          status: string
          substitute_discipline: string
          substitute_duration_min: number | null
          substitute_notes: string | null
          substitute_session_name: string
          substitute_workout_details: string | null
          substitution_date: string
        }
        Insert: {
          athlete_id: string
          created_at?: string
          id?: string
          original_session_id: string
          reason: string
          reason_details?: string | null
          source?: string
          status?: string
          substitute_discipline?: string
          substitute_duration_min?: number | null
          substitute_notes?: string | null
          substitute_session_name: string
          substitute_workout_details?: string | null
          substitution_date?: string
        }
        Update: {
          athlete_id?: string
          created_at?: string
          id?: string
          original_session_id?: string
          reason?: string
          reason_details?: string | null
          source?: string
          status?: string
          substitute_discipline?: string
          substitute_duration_min?: number | null
          substitute_notes?: string | null
          substitute_session_name?: string
          substitute_workout_details?: string | null
          substitution_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_substitutions_original_session_id_fkey"
            columns: ["original_session_id"]
            isOneToOne: false
            referencedRelation: "planned_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      strava_connections: {
        Row: {
          access_token: string
          athlete_avatar_url: string | null
          athlete_name: string | null
          athlete_username: string | null
          created_at: string | null
          expires_at: number
          id: string
          refresh_token: string
          scope: string | null
          strava_athlete_id: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          athlete_avatar_url?: string | null
          athlete_name?: string | null
          athlete_username?: string | null
          created_at?: string | null
          expires_at: number
          id?: string
          refresh_token: string
          scope?: string | null
          strava_athlete_id: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          athlete_avatar_url?: string | null
          athlete_name?: string | null
          athlete_username?: string | null
          created_at?: string | null
          expires_at?: number
          id?: string
          refresh_token?: string
          scope?: string | null
          strava_athlete_id?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      targets: {
        Row: {
          current_reference: string | null
          id: string
          plan_version_id: string
          primary_target: string
          secondary_guardrail: string | null
          type: string
          usage_guide: string | null
        }
        Insert: {
          current_reference?: string | null
          id?: string
          plan_version_id: string
          primary_target: string
          secondary_guardrail?: string | null
          type: string
          usage_guide?: string | null
        }
        Update: {
          current_reference?: string | null
          id?: string
          plan_version_id?: string
          primary_target?: string
          secondary_guardrail?: string | null
          type?: string
          usage_guide?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "targets_plan_version_id_fkey"
            columns: ["plan_version_id"]
            isOneToOne: false
            referencedRelation: "plan_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      training_load_daily: {
        Row: {
          athlete_id: string
          atl: number
          computed_at: string
          ctl: number
          date: string
          id: string
          trimp: number
          tsb: number
        }
        Insert: {
          athlete_id: string
          atl?: number
          computed_at?: string
          ctl?: number
          date: string
          id?: string
          trimp?: number
          tsb?: number
        }
        Update: {
          athlete_id?: string
          atl?: number
          computed_at?: string
          ctl?: number
          date?: string
          id?: string
          trimp?: number
          tsb?: number
        }
        Relationships: []
      }
      training_plans: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_template: boolean
          name: string
          organization_id: string
          source: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_template?: boolean
          name: string
          organization_id: string
          source?: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_template?: boolean
          name?: string
          organization_id?: string
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_plans_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      training_preferences: {
        Row: {
          athlete_id: string
          available_days: number[]
          equipment: Json
          id: string
          mobility_technique_sessions_per_week: number
          muscle_focus: string[]
          run_type_weights: Json
          session_length_min: number
          strength_sessions_per_week: number
          updated_at: string
        }
        Insert: {
          athlete_id: string
          available_days?: number[]
          equipment?: Json
          id?: string
          mobility_technique_sessions_per_week?: number
          muscle_focus?: string[]
          run_type_weights?: Json
          session_length_min?: number
          strength_sessions_per_week?: number
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          available_days?: number[]
          equipment?: Json
          id?: string
          mobility_technique_sessions_per_week?: number
          muscle_focus?: string[]
          run_type_weights?: Json
          session_length_min?: number
          strength_sessions_per_week?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_summaries: {
        Row: {
          bike_z2_min_target: number | null
          created_at: string
          id: string
          notes: string | null
          phase: string | null
          plan_version_id: string
          run_days: string | null
          run_km_target: number | null
          week_end: string | null
          week_number: number
          week_start: string | null
        }
        Insert: {
          bike_z2_min_target?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          phase?: string | null
          plan_version_id: string
          run_days?: string | null
          run_km_target?: number | null
          week_end?: string | null
          week_number?: number
          week_start?: string | null
        }
        Update: {
          bike_z2_min_target?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          phase?: string | null
          plan_version_id?: string
          run_days?: string | null
          run_km_target?: number | null
          week_end?: string | null
          week_number?: number
          week_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "weekly_summaries_plan_version_id_fkey"
            columns: ["plan_version_id"]
            isOneToOne: false
            referencedRelation: "plan_versions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_delete_athlete: { Args: { _athlete_id: string }; Returns: Json }
      admin_get_cron_jobs: {
        Args: never
        Returns: {
          active: boolean
          failure_count: number
          jobid: number
          jobname: string
          last_duration_ms: number
          last_message: string
          last_run_at: string
          last_status: string
          schedule: string
          success_count: number
          total_runs: number
        }[]
      }
      admin_get_cron_runs: {
        Args: { _jobname: string; _limit?: number }
        Returns: {
          duration_ms: number
          end_time: string
          return_message: string
          runid: number
          start_time: string
          status: string
        }[]
      }
      assign_onboarding_role: {
        Args: { _org_id: string; _role: string }
        Returns: undefined
      }
      has_org_role: {
        Args: {
          _org_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      list_active_organizations: {
        Args: never
        Returns: {
          id: string
          name: string
        }[]
      }
      recompute_training_load: {
        Args: { _athlete_id: string }
        Returns: undefined
      }
      session_trimp: {
        Args: {
          _avg_hr: number
          _duration_min: number
          _max_hr: number
          _resting_hr: number
          _rpe: number
        }
        Returns: number
      }
    }
    Enums: {
      app_role: "master_admin" | "admin" | "coach" | "athlete"
      block_type:
        | "warmup"
        | "main"
        | "cooldown"
        | "station"
        | "strength"
        | "accessory"
      discipline:
        | "run"
        | "bike"
        | "stairs"
        | "rowing"
        | "skierg"
        | "mobility"
        | "strength"
        | "accessories"
        | "hyrox_station"
        | "prehab"
        | "custom"
      intensity_level: "easy" | "moderate" | "hard" | "race_pace" | "max_effort"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["master_admin", "admin", "coach", "athlete"],
      block_type: [
        "warmup",
        "main",
        "cooldown",
        "station",
        "strength",
        "accessory",
      ],
      discipline: [
        "run",
        "bike",
        "stairs",
        "rowing",
        "skierg",
        "mobility",
        "strength",
        "accessories",
        "hyrox_station",
        "prehab",
        "custom",
      ],
      intensity_level: ["easy", "moderate", "hard", "race_pace", "max_effort"],
    },
  },
} as const
