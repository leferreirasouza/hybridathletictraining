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
          created_at: string
          id: string
          organization_id: string
        }
        Insert: {
          athlete_id: string
          coach_id: string
          created_at?: string
          id?: string
          organization_id: string
        }
        Update: {
          athlete_id?: string
          coach_id?: string
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
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
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
      training_plans: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_template: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_template?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_template?: boolean
          name?: string
          organization_id?: string
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
    }
    Enums: {
      app_role: "master_admin" | "coach" | "athlete"
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
      app_role: ["master_admin", "coach", "athlete"],
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
