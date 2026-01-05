/**
 * Supabase 資料庫類型定義
 * Operations Hub - 公司營運中樞
 * 此檔案定義所有資料表的 TypeScript 類型
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  // ============================================
  // infringement_system Schema (侵權監控系統)
  // ============================================
  infringement_system: {
    Tables: {
      products: {
        Row: {
          id: string
          org_id: string
          name: string
          internal_code: string | null
          ip_cert_number: string | null
          image_url: string
          thumbnail_url: string | null
          status: 'pending' | 'vectorized' | 'error'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id?: string
          name: string
          internal_code?: string | null
          ip_cert_number?: string | null
          image_url?: string
          thumbnail_url?: string | null
          status?: 'pending' | 'vectorized' | 'error'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          internal_code?: string | null
          ip_cert_number?: string | null
          image_url?: string
          thumbnail_url?: string | null
          status?: 'pending' | 'vectorized' | 'error'
          created_at?: string
          updated_at?: string
        }
      }
      product_vectors: {
        Row: {
          id: string
          org_id: string
          product_id: string
          vector: number[] | null
          model_version: string
          created_at: string
        }
        Insert: {
          id?: string
          org_id?: string
          product_id: string
          vector?: number[] | null
          model_version?: string
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          product_id?: string
          vector?: number[] | null
          model_version?: string
          created_at?: string
        }
      }
      platforms: {
        Row: {
          id: string
          org_id: string
          code: string
          name: string
          base_url: string
          is_active: boolean
          scraper_config: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          org_id?: string
          code: string
          name: string
          base_url: string
          is_active?: boolean
          scraper_config?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          code?: string
          name?: string
          base_url?: string
          is_active?: boolean
          scraper_config?: Json | null
          created_at?: string
        }
      }
      scrape_jobs: {
        Row: {
          id: string
          org_id: string
          name: string | null
          status: 'pending' | 'running' | 'completed' | 'failed'
          platforms: string[]
          keywords: string[] | null
          max_pages: number
          total_items: number
          matched_items: number
          started_at: string | null
          completed_at: string | null
          error_log: string | null
          created_at: string
        }
        Insert: {
          id?: string
          org_id?: string
          name?: string | null
          status?: 'pending' | 'running' | 'completed' | 'failed'
          platforms: string[]
          keywords?: string[] | null
          max_pages?: number
          total_items?: number
          matched_items?: number
          started_at?: string | null
          completed_at?: string | null
          error_log?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          name?: string | null
          status?: 'pending' | 'running' | 'completed' | 'failed'
          platforms?: string[]
          keywords?: string[] | null
          max_pages?: number
          total_items?: number
          matched_items?: number
          started_at?: string | null
          completed_at?: string | null
          error_log?: string | null
          created_at?: string
        }
      }
      scraped_items: {
        Row: {
          id: string
          org_id: string
          job_id: string
          platform: string
          external_id: string | null
          title: string
          url: string
          seller_name: string | null
          seller_id: string | null
          price: number | null
          image_url: string
          screenshot_url: string | null
          scraped_at: string
        }
        Insert: {
          id?: string
          org_id?: string
          job_id: string
          platform: string
          external_id?: string | null
          title: string
          url: string
          seller_name?: string | null
          seller_id?: string | null
          price?: number | null
          image_url: string
          screenshot_url?: string | null
          scraped_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          job_id?: string
          platform?: string
          external_id?: string | null
          title?: string
          url?: string
          seller_name?: string | null
          seller_id?: string | null
          price?: number | null
          image_url?: string
          screenshot_url?: string | null
          scraped_at?: string
        }
      }
      matches: {
        Row: {
          id: string
          org_id: string
          job_id: string | null
          product_id: string | null
          scraped_item_id: string | null
          similarity_score: number
          risk_level: 'critical' | 'high' | 'medium' | 'low'
          status: 'pending' | 'confirmed' | 'dismissed'
          auto_filtered: boolean
          evidence_screenshot_url: string | null
          evidence_captured_at: string | null
          legal_action_status: 'none' | 'warning_sent' | 'reported' | 'resolved'
          created_at: string
        }
        Insert: {
          id?: string
          org_id?: string
          job_id?: string | null
          product_id?: string | null
          scraped_item_id?: string | null
          similarity_score: number
          risk_level: 'critical' | 'high' | 'medium' | 'low'
          status?: 'pending' | 'confirmed' | 'dismissed'
          auto_filtered?: boolean
          evidence_screenshot_url?: string | null
          evidence_captured_at?: string | null
          legal_action_status?: 'none' | 'warning_sent' | 'reported' | 'resolved'
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          job_id?: string | null
          product_id?: string | null
          scraped_item_id?: string | null
          similarity_score?: number
          risk_level?: 'critical' | 'high' | 'medium' | 'low'
          status?: 'pending' | 'confirmed' | 'dismissed'
          auto_filtered?: boolean
          evidence_screenshot_url?: string | null
          evidence_captured_at?: string | null
          legal_action_status?: 'none' | 'warning_sent' | 'reported' | 'resolved'
          created_at?: string
        }
      }
      reviews: {
        Row: {
          id: string
          org_id: string
          match_id: string
          reviewer_id: string | null
          reviewer_name: string | null
          verdict: 'confirmed' | 'dismissed'
          reason: string | null
          reviewed_at: string
        }
        Insert: {
          id?: string
          org_id?: string
          match_id: string
          reviewer_id?: string | null
          reviewer_name?: string | null
          verdict: 'confirmed' | 'dismissed'
          reason?: string | null
          reviewed_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          match_id?: string
          reviewer_id?: string | null
          reviewer_name?: string | null
          verdict?: 'confirmed' | 'dismissed'
          reason?: string | null
          reviewed_at?: string
        }
      }
      whitelist: {
        Row: {
          id: string
          org_id: string
          platform: string
          seller_id: string
          seller_name: string | null
          reason: string | null
          created_at: string
        }
        Insert: {
          id?: string
          org_id?: string
          platform: string
          seller_id: string
          seller_name?: string | null
          reason?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          platform?: string
          seller_id?: string
          seller_name?: string | null
          reason?: string | null
          created_at?: string
        }
      }
      report_templates: {
        Row: {
          id: string
          org_id: string
          name: string
          platform: string | null
          template_url: string
          field_mappings: Json | null
          is_default: boolean
          created_at: string
        }
        Insert: {
          id?: string
          org_id?: string
          name: string
          platform?: string | null
          template_url: string
          field_mappings?: Json | null
          is_default?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          platform?: string | null
          template_url?: string
          field_mappings?: Json | null
          is_default?: boolean
          created_at?: string
        }
      }
      generated_reports: {
        Row: {
          id: string
          org_id: string
          match_id: string | null
          template_id: string | null
          file_url: string
          status: 'generated' | 'submitted' | 'resolved'
          submitted_at: string | null
          resolved_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          org_id?: string
          match_id?: string | null
          template_id?: string | null
          file_url: string
          status?: 'generated' | 'submitted' | 'resolved'
          submitted_at?: string | null
          resolved_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          match_id?: string | null
          template_id?: string | null
          file_url?: string
          status?: 'generated' | 'submitted' | 'resolved'
          submitted_at?: string | null
          resolved_at?: string | null
          created_at?: string
        }
      }
      org_settings: {
        Row: {
          id: string
          org_id: string
          company_name: string | null
          contact_email: string | null
          notify_on_critical: boolean
          notify_on_high: boolean
          auto_filter_whitelist: boolean
          critical_threshold: number
          high_threshold: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id?: string
          company_name?: string | null
          contact_email?: string | null
          notify_on_critical?: boolean
          notify_on_high?: boolean
          auto_filter_whitelist?: boolean
          critical_threshold?: number
          high_threshold?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          company_name?: string | null
          contact_email?: string | null
          notify_on_critical?: boolean
          notify_on_high?: boolean
          auto_filter_whitelist?: boolean
          critical_threshold?: number
          high_threshold?: number
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      product_status: 'pending' | 'vectorized' | 'error'
      job_status: 'pending' | 'running' | 'completed' | 'failed'
      risk_level: 'critical' | 'high' | 'medium' | 'low'
      match_status: 'pending' | 'confirmed' | 'dismissed'
      legal_action_status: 'none' | 'warning_sent' | 'reported' | 'resolved'
      report_status: 'generated' | 'submitted' | 'resolved'
    }
  }

  // ============================================
  // outsourcing_qc Schema (外包審核系統)
  // ============================================
  outsourcing_qc: {
    Tables: {
      task_batches: {
        Row: {
          id: string
          org_id: string
          batch_name: string
          task_type: 'background_removal' | 'image_annotation' | 'data_labeling' | 'other'
          total_items: number
          completed_items: number
          qc_passed_items: number
          qc_failed_items: number
          status: 'pending' | 'in_progress' | 'qc_review' | 'completed'
          assigned_vendor: string | null
          deadline: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id?: string
          batch_name: string
          task_type: 'background_removal' | 'image_annotation' | 'data_labeling' | 'other'
          total_items?: number
          completed_items?: number
          qc_passed_items?: number
          qc_failed_items?: number
          status?: 'pending' | 'in_progress' | 'qc_review' | 'completed'
          assigned_vendor?: string | null
          deadline?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          batch_name?: string
          task_type?: 'background_removal' | 'image_annotation' | 'data_labeling' | 'other'
          total_items?: number
          completed_items?: number
          qc_passed_items?: number
          qc_failed_items?: number
          status?: 'pending' | 'in_progress' | 'qc_review' | 'completed'
          assigned_vendor?: string | null
          deadline?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      task_items: {
        Row: {
          id: string
          org_id: string
          batch_id: string
          item_name: string
          original_image_url: string | null
          processed_image_url: string | null
          work_status: 'pending' | 'processing' | 'completed' | 'revision'
          worker_id: string | null
          worker_notes: string | null
          completed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          org_id?: string
          batch_id: string
          item_name: string
          original_image_url?: string | null
          processed_image_url?: string | null
          work_status?: 'pending' | 'processing' | 'completed' | 'revision'
          worker_id?: string | null
          worker_notes?: string | null
          completed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          batch_id?: string
          item_name?: string
          original_image_url?: string | null
          processed_image_url?: string | null
          work_status?: 'pending' | 'processing' | 'completed' | 'revision'
          worker_id?: string | null
          worker_notes?: string | null
          completed_at?: string | null
          created_at?: string
        }
      }
      qc_reviews: {
        Row: {
          id: string
          org_id: string
          item_id: string
          reviewer_id: string | null
          reviewer_name: string | null
          qc_result: 'pass' | 'fail' | 'revision_needed'
          qc_score: number | null
          accuracy_check: boolean | null
          quality_check: boolean | null
          completeness_check: boolean | null
          qc_notes: string | null
          revision_instructions: string | null
          reviewed_at: string
        }
        Insert: {
          id?: string
          org_id?: string
          item_id: string
          reviewer_id?: string | null
          reviewer_name?: string | null
          qc_result: 'pass' | 'fail' | 'revision_needed'
          qc_score?: number | null
          accuracy_check?: boolean | null
          quality_check?: boolean | null
          completeness_check?: boolean | null
          qc_notes?: string | null
          revision_instructions?: string | null
          reviewed_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          item_id?: string
          reviewer_id?: string | null
          reviewer_name?: string | null
          qc_result?: 'pass' | 'fail' | 'revision_needed'
          qc_score?: number | null
          accuracy_check?: boolean | null
          quality_check?: boolean | null
          completeness_check?: boolean | null
          qc_notes?: string | null
          revision_instructions?: string | null
          reviewed_at?: string
        }
      }
      vendors: {
        Row: {
          id: string
          org_id: string
          vendor_name: string
          contact_person: string | null
          contact_email: string | null
          contact_phone: string | null
          specialties: string[] | null
          rating: number | null
          total_tasks: number
          completed_tasks: number
          average_quality_score: number | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id?: string
          vendor_name: string
          contact_person?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          specialties?: string[] | null
          rating?: number | null
          total_tasks?: number
          completed_tasks?: number
          average_quality_score?: number | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          vendor_name?: string
          contact_person?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          specialties?: string[] | null
          rating?: number | null
          total_tasks?: number
          completed_tasks?: number
          average_quality_score?: number | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      image_removals: {
        Row: {
          id: string
          org_id: string
          task_item_id: string | null
          original_url: string
          removed_url: string | null
          removal_method: 'ai_auto' | 'manual' | 'hybrid' | null
          processing_time_ms: number | null
          file_size_before: number | null
          file_size_after: number | null
          created_at: string
        }
        Insert: {
          id?: string
          org_id?: string
          task_item_id?: string | null
          original_url: string
          removed_url?: string | null
          removal_method?: 'ai_auto' | 'manual' | 'hybrid' | null
          processing_time_ms?: number | null
          file_size_before?: number | null
          file_size_after?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          task_item_id?: string | null
          original_url?: string
          removed_url?: string | null
          removal_method?: 'ai_auto' | 'manual' | 'hybrid' | null
          processing_time_ms?: number | null
          file_size_before?: number | null
          file_size_after?: number | null
          created_at?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      task_type: 'background_removal' | 'image_annotation' | 'data_labeling' | 'other'
      batch_status: 'pending' | 'in_progress' | 'qc_review' | 'completed'
      work_status: 'pending' | 'processing' | 'completed' | 'revision'
      qc_result: 'pass' | 'fail' | 'revision_needed'
      removal_method: 'ai_auto' | 'manual' | 'hybrid'
    }
  }

  // ============================================
  // ops_metrics Schema (營運儀表板)
  // ============================================
  ops_metrics: {
    Tables: {
      platform_revenue: {
        Row: {
          id: string
          org_id: string
          platform: string
          report_date: string
          gross_revenue: number | null
          net_revenue: number | null
          orders_count: number | null
          units_sold: number | null
          returns_count: number | null
          returns_amount: number | null
          platform_fee: number | null
          shipping_cost: number | null
          ad_spend: number | null
          created_at: string
        }
        Insert: {
          id?: string
          org_id?: string
          platform: string
          report_date: string
          gross_revenue?: number | null
          net_revenue?: number | null
          orders_count?: number | null
          units_sold?: number | null
          returns_count?: number | null
          returns_amount?: number | null
          platform_fee?: number | null
          shipping_cost?: number | null
          ad_spend?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          platform?: string
          report_date?: string
          gross_revenue?: number | null
          net_revenue?: number | null
          orders_count?: number | null
          units_sold?: number | null
          returns_count?: number | null
          returns_amount?: number | null
          platform_fee?: number | null
          shipping_cost?: number | null
          ad_spend?: number | null
          created_at?: string
        }
      }
      daily_kpi: {
        Row: {
          id: string
          org_id: string
          report_date: string
          total_revenue: number | null
          total_orders: number | null
          average_order_value: number | null
          infringement_scanned: number | null
          infringement_detected: number | null
          infringement_confirmed: number | null
          infringement_resolved: number | null
          outsourcing_tasks_total: number | null
          outsourcing_tasks_completed: number | null
          outsourcing_qc_pass_rate: number | null
          created_at: string
        }
        Insert: {
          id?: string
          org_id?: string
          report_date: string
          total_revenue?: number | null
          total_orders?: number | null
          average_order_value?: number | null
          infringement_scanned?: number | null
          infringement_detected?: number | null
          infringement_confirmed?: number | null
          infringement_resolved?: number | null
          outsourcing_tasks_total?: number | null
          outsourcing_tasks_completed?: number | null
          outsourcing_qc_pass_rate?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          report_date?: string
          total_revenue?: number | null
          total_orders?: number | null
          average_order_value?: number | null
          infringement_scanned?: number | null
          infringement_detected?: number | null
          infringement_confirmed?: number | null
          infringement_resolved?: number | null
          outsourcing_tasks_total?: number | null
          outsourcing_tasks_completed?: number | null
          outsourcing_qc_pass_rate?: number | null
          created_at?: string
        }
      }
      monthly_reports: {
        Row: {
          id: string
          org_id: string
          report_year: number
          report_month: number
          total_revenue: number | null
          total_orders: number | null
          total_returns: number | null
          return_rate: number | null
          total_platform_fees: number | null
          total_shipping_costs: number | null
          total_ad_spend: number | null
          total_outsourcing_cost: number | null
          gross_profit: number | null
          net_profit: number | null
          profit_margin: number | null
          infringement_cases_total: number | null
          infringement_cases_resolved: number | null
          created_at: string
        }
        Insert: {
          id?: string
          org_id?: string
          report_year: number
          report_month: number
          total_revenue?: number | null
          total_orders?: number | null
          total_returns?: number | null
          return_rate?: number | null
          total_platform_fees?: number | null
          total_shipping_costs?: number | null
          total_ad_spend?: number | null
          total_outsourcing_cost?: number | null
          gross_profit?: number | null
          net_profit?: number | null
          profit_margin?: number | null
          infringement_cases_total?: number | null
          infringement_cases_resolved?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          report_year?: number
          report_month?: number
          total_revenue?: number | null
          total_orders?: number | null
          total_returns?: number | null
          return_rate?: number | null
          total_platform_fees?: number | null
          total_shipping_costs?: number | null
          total_ad_spend?: number | null
          total_outsourcing_cost?: number | null
          gross_profit?: number | null
          net_profit?: number | null
          profit_margin?: number | null
          infringement_cases_total?: number | null
          infringement_cases_resolved?: number | null
          created_at?: string
        }
      }
      platform_performance: {
        Row: {
          id: string
          org_id: string
          platform: string
          report_date: string
          page_views: number | null
          unique_visitors: number | null
          conversion_rate: number | null
          active_listings: number | null
          out_of_stock_items: number | null
          average_rating: number | null
          reviews_count: number | null
          positive_reviews_rate: number | null
          created_at: string
        }
        Insert: {
          id?: string
          org_id?: string
          platform: string
          report_date: string
          page_views?: number | null
          unique_visitors?: number | null
          conversion_rate?: number | null
          active_listings?: number | null
          out_of_stock_items?: number | null
          average_rating?: number | null
          reviews_count?: number | null
          positive_reviews_rate?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          platform?: string
          report_date?: string
          page_views?: number | null
          unique_visitors?: number | null
          conversion_rate?: number | null
          active_listings?: number | null
          out_of_stock_items?: number | null
          average_rating?: number | null
          reviews_count?: number | null
          positive_reviews_rate?: number | null
          created_at?: string
        }
      }
      alerts: {
        Row: {
          id: string
          org_id: string
          alert_type: 'revenue_drop' | 'infringement_spike' | 'qc_failure' | 'inventory_low' | 'other'
          severity: 'info' | 'warning' | 'critical'
          title: string
          message: string | null
          related_entity_type: string | null
          related_entity_id: string | null
          is_read: boolean
          is_resolved: boolean
          resolved_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          org_id?: string
          alert_type: 'revenue_drop' | 'infringement_spike' | 'qc_failure' | 'inventory_low' | 'other'
          severity: 'info' | 'warning' | 'critical'
          title: string
          message?: string | null
          related_entity_type?: string | null
          related_entity_id?: string | null
          is_read?: boolean
          is_resolved?: boolean
          resolved_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          alert_type?: 'revenue_drop' | 'infringement_spike' | 'qc_failure' | 'inventory_low' | 'other'
          severity?: 'info' | 'warning' | 'critical'
          title?: string
          message?: string | null
          related_entity_type?: string | null
          related_entity_id?: string | null
          is_read?: boolean
          is_resolved?: boolean
          resolved_at?: string | null
          created_at?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      alert_type: 'revenue_drop' | 'infringement_spike' | 'qc_failure' | 'inventory_low' | 'other'
      severity: 'info' | 'warning' | 'critical'
    }
  }
}

// ============================================
// 便捷類型別名
// ============================================

// infringement_system
export type Product = Database['infringement_system']['Tables']['products']['Row']
export type ProductVector = Database['infringement_system']['Tables']['product_vectors']['Row']
export type Platform = Database['infringement_system']['Tables']['platforms']['Row']
export type ScrapeJob = Database['infringement_system']['Tables']['scrape_jobs']['Row']
export type ScrapedItem = Database['infringement_system']['Tables']['scraped_items']['Row']
export type Match = Database['infringement_system']['Tables']['matches']['Row']
export type InfringementReview = Database['infringement_system']['Tables']['reviews']['Row']
export type Whitelist = Database['infringement_system']['Tables']['whitelist']['Row']
export type ReportTemplate = Database['infringement_system']['Tables']['report_templates']['Row']
export type GeneratedReport = Database['infringement_system']['Tables']['generated_reports']['Row']
export type OrgSettings = Database['infringement_system']['Tables']['org_settings']['Row']

// outsourcing_qc
export type TaskBatch = Database['outsourcing_qc']['Tables']['task_batches']['Row']
export type TaskItem = Database['outsourcing_qc']['Tables']['task_items']['Row']
export type QCReview = Database['outsourcing_qc']['Tables']['qc_reviews']['Row']
export type Vendor = Database['outsourcing_qc']['Tables']['vendors']['Row']
export type ImageRemoval = Database['outsourcing_qc']['Tables']['image_removals']['Row']

// ops_metrics
export type PlatformRevenue = Database['ops_metrics']['Tables']['platform_revenue']['Row']
export type DailyKPI = Database['ops_metrics']['Tables']['daily_kpi']['Row']
export type MonthlyReport = Database['ops_metrics']['Tables']['monthly_reports']['Row']
export type PlatformPerformance = Database['ops_metrics']['Tables']['platform_performance']['Row']
export type Alert = Database['ops_metrics']['Tables']['alerts']['Row']
