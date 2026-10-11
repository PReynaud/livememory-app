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
          {
            foreignKeyName: "attendance_concert_id_fkey"
            columns: ["concert_id"]
            isOneToOne: false
            referencedRelation: "shared_list_concerts"
            referencedColumns: ["concert_id"]
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
          stage_name: string | null
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
          stage_name?: string | null
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
          stage_name?: string | null
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
            foreignKeyName: "concerts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "shared_list_concerts"
            referencedColumns: ["event_id"]
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
          {
            foreignKeyName: "event_members_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "shared_list_concerts"
            referencedColumns: ["event_id"]
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
          {
            foreignKeyName: "event_stages_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "shared_list_concerts"
            referencedColumns: ["event_id"]
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
      name_catalog: {
        Row: {
          created_at: string
          kind: string
          name: string
          name_normalized: string
        }
        Insert: {
          created_at?: string
          kind: string
          name: string
          name_normalized?: string
        }
        Update: {
          created_at?: string
          kind?: string
          name?: string
          name_normalized?: string
        }
        Relationships: []
      }
      oauth_authorization_codes: {
        Row: {
          client_id: string
          code_challenge: string
          code_hash: string
          created_at: string
          expires_at: string
          grant_id: string | null
          redirect_uri: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          client_id: string
          code_challenge: string
          code_hash: string
          created_at?: string
          expires_at: string
          grant_id?: string | null
          redirect_uri: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          client_id?: string
          code_challenge?: string
          code_hash?: string
          created_at?: string
          expires_at?: string
          grant_id?: string | null
          redirect_uri?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_authorization_codes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "oauth_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oauth_authorization_codes_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "oauth_grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oauth_authorization_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_clients: {
        Row: {
          client_name: string
          created_at: string
          id: string
          redirect_uris: string[]
        }
        Insert: {
          client_name: string
          created_at?: string
          id?: string
          redirect_uris: string[]
        }
        Update: {
          client_name?: string
          created_at?: string
          id?: string
          redirect_uris?: string[]
        }
        Relationships: []
      }
      oauth_grants: {
        Row: {
          access_expires_at: string | null
          access_token_hash: string | null
          client_id: string
          created_at: string
          has_access_token: boolean | null
          id: string
          previous_refresh_token_hash: string | null
          refresh_token_hash: string | null
          user_id: string
        }
        Insert: {
          access_expires_at?: string | null
          access_token_hash?: string | null
          client_id: string
          created_at?: string
          has_access_token?: boolean | null
          id?: string
          previous_refresh_token_hash?: string | null
          refresh_token_hash?: string | null
          user_id: string
        }
        Update: {
          access_expires_at?: string | null
          access_token_hash?: string | null
          client_id?: string
          created_at?: string
          has_access_token?: boolean | null
          id?: string
          previous_refresh_token_hash?: string | null
          refresh_token_hash?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_grants_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "oauth_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oauth_grants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          {
            foreignKeyName: "attendance_concert_id_fkey"
            columns: ["concert_id"]
            isOneToOne: false
            referencedRelation: "shared_list_concerts"
            referencedColumns: ["concert_id"]
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
      shared_list_concerts: {
        Row: {
          artist: string | null
          concert_date: string | null
          concert_id: string | null
          concert_place: string | null
          concert_time: string | null
          end_date: string | null
          event_id: string | null
          event_kind: string | null
          event_name: string | null
          event_place: string | null
          stage_id: string | null
          stage_name: string | null
          start_date: string | null
          username: string | null
          username_key: string | null
        }
        Relationships: [
          {
            foreignKeyName: "concerts_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "event_stages"
            referencedColumns: ["id"]
          },
        ]
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
      attach_oauth_grant_tokens: {
        Args: {
          p_access_expires_at: string
          p_access_hash: string
          p_grant_id: string
          p_refresh_hash: string
        }
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
      concert_move_would_lose_joiners: {
        Args: { p_source_event_id: string; p_target_event_id: string }
        Returns: boolean
      }
      event_has_joiners: { Args: { p_event_id: string }; Returns: boolean }
      get_shared_list_concerts: {
        Args: { requested: string }
        Returns: {
          artist: string
          concert_date: string
          concert_id: string
          concert_place: string
          concert_time: string
          end_date: string
          event_id: string
          event_kind: string
          event_name: string
          event_place: string
          stage_id: string
          stage_name: string
          start_date: string
        }[]
      }
      get_shared_list_profile: {
        Args: { requested: string }
        Returns: {
          username: string
        }[]
      }
      issue_oauth_authorization_code: {
        Args: {
          p_client_id: string
          p_code_challenge: string
          p_code_hash: string
          p_expires_at: string
          p_redirect_uri: string
          p_user_id: string
        }
        Returns: string
      }
      lookup_oauth_access_token: {
        Args: { p_token_hash: string }
        Returns: string
      }
      oauth_client_for_redirect: {
        Args: { p_client_id: string; p_redirect_uri: string }
        Returns: Json
      }
      oauth_redirect_uri_allowed: { Args: { uri: string }; Returns: boolean }
      redeem_oauth_authorization_code: {
        Args: {
          p_access_expires_at: string
          p_access_hash: string
          p_client_id: string
          p_code_challenge: string
          p_code_hash: string
          p_redirect_uri: string
          p_refresh_hash: string
        }
        Returns: Json
      }
      register_oauth_client: {
        Args: { p_client_name: string; p_redirect_uris: string[] }
        Returns: string
      }
      rotate_oauth_refresh_token: {
        Args: {
          p_access_expires_at: string
          p_access_hash: string
          p_client_id: string
          p_next_refresh_hash: string
          p_refresh_hash: string
        }
        Returns: string
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

