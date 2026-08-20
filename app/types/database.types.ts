export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      attendance: {
        Row: {
          concert_id: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          concert_id: string
          id?: string
          status: string
          user_id?: string
        }
        Update: {
          concert_id?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_concert_id_fkey"
            columns: ["concert_id"]
            isOneToOne: false
            referencedRelation: "concert_notes"
            referencedColumns: ["concert_id"]
          },
          {
            foreignKeyName: "attendance_concert_id_fkey"
            columns: ["concert_id"]
            isOneToOne: false
            referencedRelation: "concerts"
            referencedColumns: ["id"]
          },
        ]
      }
      concerts: {
        Row: {
          artist: string
          date: string
          event_id: string
          id: string
          notes: string | null
          owner_id: string
          place: string
          stage_id: string | null
          time: string | null
        }
        Insert: {
          artist: string
          date: string
          event_id: string
          id?: string
          notes?: string | null
          owner_id?: string
          place: string
          stage_id?: string | null
          time?: string | null
        }
        Update: {
          artist?: string
          date?: string
          event_id?: string
          id?: string
          notes?: string | null
          owner_id?: string
          place?: string
          stage_id?: string | null
          time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "concerts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concerts_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "event_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      event_members: {
        Row: {
          event_id: string
          id: string
          user_id: string
        }
        Insert: {
          event_id: string
          id?: string
          user_id?: string
        }
        Update: {
          event_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_members_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_stages: {
        Row: {
          event_id: string
          id: string
          name: string
        }
        Insert: {
          event_id: string
          id?: string
          name: string
        }
        Update: {
          event_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_stages_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          allow_place_override: boolean
          end_date: string
          id: string
          kind: string
          name: string
          owner_id: string
          place: string
          start_date: string
        }
        Insert: {
          allow_place_override?: boolean
          end_date: string
          id?: string
          kind: string
          name: string
          owner_id?: string
          place: string
          start_date: string
        }
        Update: {
          allow_place_override?: boolean
          end_date?: string
          id?: string
          kind?: string
          name?: string
          owner_id?: string
          place?: string
          start_date?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          shared_list_enabled: boolean
          username: string
        }
        Insert: {
          created_at?: string
          id: string
          shared_list_enabled?: boolean
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          shared_list_enabled?: boolean
          username?: string
        }
        Relationships: []
      }
    }
    Views: {
      attendance_effective: {
        Row: {
          concert_id: string | null
          id: string | null
          status: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_concert_id_fkey"
            columns: ["concert_id"]
            isOneToOne: false
            referencedRelation: "concert_notes"
            referencedColumns: ["concert_id"]
          },
          {
            foreignKeyName: "attendance_concert_id_fkey"
            columns: ["concert_id"]
            isOneToOne: false
            referencedRelation: "concerts"
            referencedColumns: ["id"]
          },
        ]
      }
      concert_notes: {
        Row: {
          concert_id: string | null
          notes: string | null
        }
        Insert: {
          concert_id?: string | null
          notes?: string | null
        }
        Update: {
          concert_id?: string | null
          notes?: string | null
        }
        Relationships: []
      }
      shared_list_profiles: {
        Row: {
          username: string | null
          username_key: string | null
        }
        Insert: {
          username?: string | null
          username_key?: never
        }
        Update: {
          username?: string | null
          username_key?: never
        }
        Relationships: []
      }
    }
    Functions: {
      assert_event_bill_valid: {
        Args: { p_event_id: string }
        Returns: undefined
      }
      concert_event_rule_violation: {
        Args: { concert: Database["public"]["Tables"]["concerts"]["Row"] }
        Returns: string
      }
      concert_is_past: {
        Args: { p_date: string; p_time: string }
        Returns: boolean
      }
      save_event_and_concert_dates: {
        Args: {
          p_allow_place_override?: boolean
          p_concert_dates: Json
          p_end_date: string
          p_event_id: string
          p_name?: string
          p_place?: string
          p_stages?: Json
          p_start_date: string
        }
        Returns: {
          allow_place_override: boolean
          end_date: string
          id: string
          kind: string
          name: string
          owner_id: string
          place: string
          start_date: string
        }
        SetofOptions: {
          from: "*"
          to: "events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      username_is_taken: { Args: { candidate: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const

