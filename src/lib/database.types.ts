// Types générés depuis le schéma Supabase du projet Opalook (pjxvstskgzvsyzkbxxug).
// Régénération : `npx supabase gen types typescript --project-id pjxvstskgzvsyzkbxxug`
// (ou via l'outil MCP Supabase `generate_typescript_types`).

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type CategoryStatus = "todo" | "in_progress" | "optimized" | "published";

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.15" };
  public: {
    Tables: {
      projects: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          domain: string | null;
          locale: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          domain?: string | null;
          locale?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["projects"]["Insert"]>;
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          project_id: string;
          url: string;
          name: string;
          target_keyword: string | null;
          status: CategoryStatus;
          source_title: string | null;
          source_meta_description: string | null;
          source_h1: string | null;
          source_content: string | null;
          source_data: Json;
          source_fetched_at: string | null;
          secondary_keywords: string[];
          fan_queries: string[];
          brief: string | null;
          gsc_data: Json;
          gsc_fetched_at: string | null;
          keyword_volume: number | null;
          keyword_difficulty: number | null;
          keyword_cpc: number | null;
          keyword_intent: string | null;
          keyword_data_at: string | null;
          serp_data: Json;
          serp_fetched_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          url: string;
          name: string;
          target_keyword?: string | null;
          status?: CategoryStatus;
          source_title?: string | null;
          source_meta_description?: string | null;
          source_h1?: string | null;
          source_content?: string | null;
          source_data?: Json;
          source_fetched_at?: string | null;
          secondary_keywords?: string[];
          fan_queries?: string[];
          brief?: string | null;
          gsc_data?: Json;
          gsc_fetched_at?: string | null;
          keyword_volume?: number | null;
          keyword_difficulty?: number | null;
          keyword_cpc?: number | null;
          keyword_intent?: string | null;
          keyword_data_at?: string | null;
          serp_data?: Json;
          serp_fetched_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["categories"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "categories_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      optimizations: {
        Row: {
          id: string;
          category_id: string;
          version: number;
          title: string | null;
          meta_description: string | null;
          h1: string | null;
          content: string | null;
          score: number | null;
          engine: string | null;
          editorial_angle: string | null;
          payload: Json;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          category_id: string;
          /** Laisser vide : un trigger Postgres attribue max(version) + 1. */
          version?: number;
          title?: string | null;
          meta_description?: string | null;
          h1?: string | null;
          content?: string | null;
          score?: number | null;
          engine?: string | null;
          editorial_angle?: string | null;
          payload?: Json;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["optimizations"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "optimizations_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: { category_status: CategoryStatus };
    CompositeTypes: Record<never, never>;
  };
};

export type Project = Database["public"]["Tables"]["projects"]["Row"];
export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type Optimization = Database["public"]["Tables"]["optimizations"]["Row"];
