// Types générés depuis le schéma Supabase du projet Opalook (pjxvstskgzvsyzkbxxug).
// Régénération : `npx supabase gen types typescript --project-id pjxvstskgzvsyzkbxxug`
// (ou via l'outil MCP Supabase `generate_typescript_types`).

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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          brief: string | null
          catalog_long_description: string | null
          catalog_short_description: string | null
          created_at: string
          external_id: number | null
          fan_queries: string[]
          gsc_data: Json
          gsc_fetched_at: string | null
          id: string
          keyword_cpc: number | null
          keyword_data_at: string | null
          keyword_difficulty: number | null
          keyword_intent: string | null
          keyword_volume: number | null
          name: string
          parent_external_id: number | null
          products_count: number | null
          project_id: string
          secondary_keywords: string[]
          serp_data: Json
          serp_fetched_at: string | null
          source_content: string | null
          source_data: Json
          source_fetched_at: string | null
          source_h1: string | null
          source_meta_description: string | null
          source_title: string | null
          status: Database["public"]["Enums"]["category_status"]
          target_keyword: string | null
          updated_at: string
          url: string
        }
        Insert: {
          brief?: string | null
          catalog_long_description?: string | null
          catalog_short_description?: string | null
          created_at?: string
          external_id?: number | null
          fan_queries?: string[]
          gsc_data?: Json
          gsc_fetched_at?: string | null
          id?: string
          keyword_cpc?: number | null
          keyword_data_at?: string | null
          keyword_difficulty?: number | null
          keyword_intent?: string | null
          keyword_volume?: number | null
          name: string
          parent_external_id?: number | null
          products_count?: number | null
          project_id: string
          secondary_keywords?: string[]
          serp_data?: Json
          serp_fetched_at?: string | null
          source_content?: string | null
          source_data?: Json
          source_fetched_at?: string | null
          source_h1?: string | null
          source_meta_description?: string | null
          source_title?: string | null
          status?: Database["public"]["Enums"]["category_status"]
          target_keyword?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          brief?: string | null
          catalog_long_description?: string | null
          catalog_short_description?: string | null
          created_at?: string
          external_id?: number | null
          fan_queries?: string[]
          gsc_data?: Json
          gsc_fetched_at?: string | null
          id?: string
          keyword_cpc?: number | null
          keyword_data_at?: string | null
          keyword_difficulty?: number | null
          keyword_intent?: string | null
          keyword_volume?: number | null
          name?: string
          parent_external_id?: number | null
          products_count?: number | null
          project_id?: string
          secondary_keywords?: string[]
          serp_data?: Json
          serp_fetched_at?: string | null
          source_content?: string | null
          source_data?: Json
          source_fetched_at?: string | null
          source_h1?: string | null
          source_meta_description?: string | null
          source_title?: string | null
          status?: Database["public"]["Enums"]["category_status"]
          target_keyword?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      optimizations: {
        Row: {
          category_id: string
          content: string | null
          created_at: string
          created_by: string | null
          editorial_angle: string | null
          engine: string | null
          h1: string | null
          id: string
          meta_description: string | null
          payload: Json
          score: number | null
          short_description: string | null
          title: string | null
          version: number
        }
        Insert: {
          category_id: string
          content?: string | null
          created_at?: string
          created_by?: string | null
          editorial_angle?: string | null
          engine?: string | null
          h1?: string | null
          id?: string
          meta_description?: string | null
          payload?: Json
          score?: number | null
          short_description?: string | null
          title?: string | null
          version?: number
        }
        Update: {
          category_id?: string
          content?: string | null
          created_at?: string
          created_by?: string | null
          editorial_angle?: string | null
          engine?: string | null
          h1?: string | null
          id?: string
          meta_description?: string | null
          payload?: Json
          score?: number | null
          short_description?: string | null
          title?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "optimizations_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          business_rules: string | null
          created_at: string
          domain: string | null
          id: string
          locale: string
          market: string | null
          name: string
          notes: string | null
          owner_id: string
          updated_at: string
        }
        Insert: {
          business_rules?: string | null
          created_at?: string
          domain?: string | null
          id?: string
          locale?: string
          market?: string | null
          name: string
          notes?: string | null
          owner_id: string
          updated_at?: string
        }
        Update: {
          business_rules?: string | null
          created_at?: string
          domain?: string | null
          id?: string
          locale?: string
          market?: string | null
          name?: string
          notes?: string | null
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      category_status: "todo" | "in_progress" | "optimized" | "published"
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
      category_status: ["todo", "in_progress", "optimized", "published"],
    },
  },
} as const

/* --------------------------------------------------------------- raccourcis */
// Ajoutés à la main, conservés lors des régénérations : le générateur ne
// produit que la forme `Enums<"category_status">`, illisible à l'usage.

export type CategoryStatus = Enums<"category_status">
export type Project = Tables<"projects">
export type Category = Tables<"categories">
export type Optimization = Tables<"optimizations">

