/**
 * Database types for Supabase
 * This file should be regenerated when schema changes
 * Command: npx supabase gen types typescript --local > types/database.types.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          settings: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      users: {
        Row: {
          id: string;
          org_id: string | null;
          email: string;
          name: string | null;
          role: 'admin' | 'staff';
          avatar_url: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          org_id?: string | null;
          email: string;
          name?: string | null;
          role?: 'admin' | 'staff';
          avatar_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string | null;
          email?: string;
          name?: string | null;
          role?: 'admin' | 'staff';
          avatar_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      customers: {
        Row: {
          id: string;
          org_id: string | null;
          phone: string;
          name: string | null;
          email: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id?: string | null;
          phone: string;
          name?: string | null;
          email?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string | null;
          phone?: string;
          name?: string | null;
          email?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      products: {
        Row: {
          id: string;
          org_id: string | null;
          sku: string;
          name: string;
          category: string | null;
          price: number | null;
          image_url: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id?: string | null;
          sku: string;
          name: string;
          category?: string | null;
          price?: number | null;
          image_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string | null;
          sku?: string;
          name?: string;
          category?: string | null;
          price?: number | null;
          image_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      orders: {
        Row: {
          id: string;
          org_id: string | null;
          order_number: string;
          customer_id: string | null;
          channel_source: 'shopee' | 'official' | 'momo' | 'dealer' | 'other';
          status: string;
          total_amount: number | null;
          order_date: string | null;
          shipping_address: string | null;
          customer_phone: string;
          customer_name: string | null;
          delivered_at: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id?: string | null;
          order_number: string;
          customer_id?: string | null;
          channel_source: 'shopee' | 'official' | 'momo' | 'dealer' | 'other';
          status?: string;
          total_amount?: number | null;
          order_date?: string | null;
          shipping_address?: string | null;
          customer_phone: string;
          customer_name?: string | null;
          delivered_at?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string | null;
          order_number?: string;
          customer_id?: string | null;
          channel_source?: 'shopee' | 'official' | 'momo' | 'dealer' | 'other';
          status?: string;
          total_amount?: number | null;
          order_date?: string | null;
          shipping_address?: string | null;
          customer_phone?: string;
          customer_name?: string | null;
          delivered_at?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      order_items: {
        Row: {
          id: string;
          org_id: string | null;
          order_id: string | null;
          product_id: string | null;
          sku: string | null;
          product_name: string;
          quantity: number;
          unit_price: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id?: string | null;
          order_id?: string | null;
          product_id?: string | null;
          sku?: string | null;
          product_name: string;
          quantity?: number;
          unit_price?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string | null;
          order_id?: string | null;
          product_id?: string | null;
          sku?: string | null;
          product_name?: string;
          quantity?: number;
          unit_price?: number | null;
          created_at?: string;
        };
      };
      return_requests: {
        Row: {
          id: string;
          org_id: string | null;
          request_number: string;
          order_id: string | null;
          customer_id: string | null;
          status: 'pending_review' | 'approved_waiting_shipping' | 'shipping_in_transit' | 'received_inspecting' | 'abnormal_disputed' | 'refund_processing' | 'completed';
          channel_source: 'shopee' | 'official' | 'momo' | 'dealer' | 'other' | null;
          refund_type: 'original_payment' | 'store_credit' | 'bank_transfer' | 'pending';
          ai_analysis_tag: string | null;
          reason_category: string | null;
          reason_detail: string | null;
          return_shipping_method: 'self_ship' | 'convenience_store' | 'company_pickup' | null;
          tracking_number: string | null;
          logistics_company: string | null;
          refund_amount: number | null;
          applied_at: string;
          approved_at: string | null;
          shipped_at: string | null;
          received_at: string | null;
          inspected_at: string | null;
          refund_processed_at: string | null;
          closed_at: string | null;
          reviewed_by: string | null;
          inspected_by: string | null;
          refund_processed_by: string | null;
          review_notes: string | null;
          inspection_notes: string | null;
          dispute_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id?: string | null;
          request_number?: string;
          order_id?: string | null;
          customer_id?: string | null;
          status?: 'pending_review' | 'approved_waiting_shipping' | 'shipping_in_transit' | 'received_inspecting' | 'abnormal_disputed' | 'refund_processing' | 'completed';
          channel_source?: 'shopee' | 'official' | 'momo' | 'dealer' | 'other' | null;
          refund_type?: 'original_payment' | 'store_credit' | 'bank_transfer' | 'pending';
          ai_analysis_tag?: string | null;
          reason_category?: string | null;
          reason_detail?: string | null;
          return_shipping_method?: 'self_ship' | 'convenience_store' | 'company_pickup' | null;
          tracking_number?: string | null;
          logistics_company?: string | null;
          refund_amount?: number | null;
          applied_at?: string;
          approved_at?: string | null;
          shipped_at?: string | null;
          received_at?: string | null;
          inspected_at?: string | null;
          refund_processed_at?: string | null;
          closed_at?: string | null;
          reviewed_by?: string | null;
          inspected_by?: string | null;
          refund_processed_by?: string | null;
          review_notes?: string | null;
          inspection_notes?: string | null;
          dispute_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string | null;
          request_number?: string;
          order_id?: string | null;
          customer_id?: string | null;
          status?: 'pending_review' | 'approved_waiting_shipping' | 'shipping_in_transit' | 'received_inspecting' | 'abnormal_disputed' | 'refund_processing' | 'completed';
          channel_source?: 'shopee' | 'official' | 'momo' | 'dealer' | 'other' | null;
          refund_type?: 'original_payment' | 'store_credit' | 'bank_transfer' | 'pending';
          ai_analysis_tag?: string | null;
          reason_category?: string | null;
          reason_detail?: string | null;
          return_shipping_method?: 'self_ship' | 'convenience_store' | 'company_pickup' | null;
          tracking_number?: string | null;
          logistics_company?: string | null;
          refund_amount?: number | null;
          applied_at?: string;
          approved_at?: string | null;
          shipped_at?: string | null;
          received_at?: string | null;
          inspected_at?: string | null;
          refund_processed_at?: string | null;
          closed_at?: string | null;
          reviewed_by?: string | null;
          inspected_by?: string | null;
          refund_processed_by?: string | null;
          review_notes?: string | null;
          inspection_notes?: string | null;
          dispute_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      return_items: {
        Row: {
          id: string;
          org_id: string | null;
          return_request_id: string | null;
          order_item_id: string | null;
          product_id: string | null;
          sku: string | null;
          product_name: string;
          quantity: number;
          unit_price: number | null;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id?: string | null;
          return_request_id?: string | null;
          order_item_id?: string | null;
          product_id?: string | null;
          sku?: string | null;
          product_name: string;
          quantity?: number;
          unit_price?: number | null;
          reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string | null;
          return_request_id?: string | null;
          order_item_id?: string | null;
          product_id?: string | null;
          sku?: string | null;
          product_name?: string;
          quantity?: number;
          unit_price?: number | null;
          reason?: string | null;
          created_at?: string;
        };
      };
      return_images: {
        Row: {
          id: string;
          org_id: string | null;
          return_request_id: string | null;
          image_url: string;
          storage_path: string | null;
          image_type: 'shipping_label' | 'product_damage' | 'outer_box' | 'inspection' | 'other' | null;
          uploaded_by: 'customer' | 'staff' | null;
          file_size_bytes: number | null;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id?: string | null;
          return_request_id?: string | null;
          image_url: string;
          storage_path?: string | null;
          image_type?: 'shipping_label' | 'product_damage' | 'outer_box' | 'inspection' | 'other' | null;
          uploaded_by?: 'customer' | 'staff' | null;
          file_size_bytes?: number | null;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string | null;
          return_request_id?: string | null;
          image_url?: string;
          storage_path?: string | null;
          image_type?: 'shipping_label' | 'product_damage' | 'outer_box' | 'inspection' | 'other' | null;
          uploaded_by?: 'customer' | 'staff' | null;
          file_size_bytes?: number | null;
          description?: string | null;
          created_at?: string;
        };
      };
      inspection_records: {
        Row: {
          id: string;
          org_id: string | null;
          return_request_id: string | null;
          inspector_id: string | null;
          result: 'passed' | 'failed' | 'partial' | null;
          condition_grade: 'A' | 'B' | 'C' | 'D' | 'F' | null;
          checklist: Json;
          notes: string | null;
          inspector_comment: string | null;
          inspected_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id?: string | null;
          return_request_id?: string | null;
          inspector_id?: string | null;
          result?: 'passed' | 'failed' | 'partial' | null;
          condition_grade?: 'A' | 'B' | 'C' | 'D' | 'F' | null;
          checklist?: Json;
          notes?: string | null;
          inspector_comment?: string | null;
          inspected_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string | null;
          return_request_id?: string | null;
          inspector_id?: string | null;
          result?: 'passed' | 'failed' | 'partial' | null;
          condition_grade?: 'A' | 'B' | 'C' | 'D' | 'F' | null;
          checklist?: Json;
          notes?: string | null;
          inspector_comment?: string | null;
          inspected_at?: string;
          created_at?: string;
        };
      };
      ai_analysis_reports: {
        Row: {
          id: string;
          org_id: string | null;
          report_period: string;
          report_type: string;
          pain_points: Json | null;
          recommendations: Json | null;
          sku_analysis: Json | null;
          channel_analysis: Json | null;
          trend_analysis: Json | null;
          raw_prompt: string | null;
          raw_response: string | null;
          total_returns: number | null;
          total_refund_amount: number | null;
          return_rate: number | null;
          store_credit_rate: number | null;
          generated_by: string | null;
          generated_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id?: string | null;
          report_period: string;
          report_type?: string;
          pain_points?: Json | null;
          recommendations?: Json | null;
          sku_analysis?: Json | null;
          channel_analysis?: Json | null;
          trend_analysis?: Json | null;
          raw_prompt?: string | null;
          raw_response?: string | null;
          total_returns?: number | null;
          total_refund_amount?: number | null;
          return_rate?: number | null;
          store_credit_rate?: number | null;
          generated_by?: string | null;
          generated_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string | null;
          report_period?: string;
          report_type?: string;
          pain_points?: Json | null;
          recommendations?: Json | null;
          sku_analysis?: Json | null;
          channel_analysis?: Json | null;
          trend_analysis?: Json | null;
          raw_prompt?: string | null;
          raw_response?: string | null;
          total_returns?: number | null;
          total_refund_amount?: number | null;
          return_rate?: number | null;
          store_credit_rate?: number | null;
          generated_by?: string | null;
          generated_at?: string;
          created_at?: string;
        };
      };
      activity_logs: {
        Row: {
          id: string;
          org_id: string | null;
          entity_type: string;
          entity_id: string;
          action: string;
          actor_type: 'user' | 'customer' | 'system' | null;
          actor_id: string | null;
          actor_name: string | null;
          old_value: Json | null;
          new_value: Json | null;
          description: string | null;
          ip_address: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id?: string | null;
          entity_type: string;
          entity_id: string;
          action: string;
          actor_type?: 'user' | 'customer' | 'system' | null;
          actor_id?: string | null;
          actor_name?: string | null;
          old_value?: Json | null;
          new_value?: Json | null;
          description?: string | null;
          ip_address?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string | null;
          entity_type?: string;
          entity_id?: string;
          action?: string;
          actor_type?: 'user' | 'customer' | 'system' | null;
          actor_id?: string | null;
          actor_name?: string | null;
          old_value?: Json | null;
          new_value?: Json | null;
          description?: string | null;
          ip_address?: string | null;
          created_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

// Convenience type aliases
export type Organization = Database['public']['Tables']['organizations']['Row'];
export type User = Database['public']['Tables']['users']['Row'];
export type Customer = Database['public']['Tables']['customers']['Row'];
export type Product = Database['public']['Tables']['products']['Row'];
export type Order = Database['public']['Tables']['orders']['Row'];
export type OrderItem = Database['public']['Tables']['order_items']['Row'];
export type ReturnRequest = Database['public']['Tables']['return_requests']['Row'];
export type ReturnItem = Database['public']['Tables']['return_items']['Row'];
export type ReturnImage = Database['public']['Tables']['return_images']['Row'];
export type InspectionRecord = Database['public']['Tables']['inspection_records']['Row'];
export type AIAnalysisReport = Database['public']['Tables']['ai_analysis_reports']['Row'];
export type ActivityLog = Database['public']['Tables']['activity_logs']['Row'];
