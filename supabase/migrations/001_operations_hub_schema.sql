-- ============================================
-- 公司營運中樞 (Operations Hub) - 完整架構
-- 執行於 Supabase SQL Editor
-- ============================================

-- 啟用必要的擴展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- 建立三個獨立的 Schema
-- ============================================

CREATE SCHEMA IF NOT EXISTS infringement_system;  -- 侵權監控系統
CREATE SCHEMA IF NOT EXISTS outsourcing_qc;       -- 外包審核系統
CREATE SCHEMA IF NOT EXISTS ops_metrics;          -- 營運儀表板

-- 設定搜尋路徑
ALTER DATABASE postgres SET search_path TO public, infringement_system, outsourcing_qc, ops_metrics;

-- ============================================
-- Schema: infringement_system (侵權監控)
-- 儲存掃描紀錄、侵權證據
-- ============================================

-- 1. 產品資料庫
CREATE TABLE IF NOT EXISTS infringement_system.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL DEFAULT 'admin',
  name TEXT NOT NULL,
  internal_code TEXT,              -- 內部編碼
  ip_cert_number TEXT,             -- 智財權證號
  image_url TEXT NOT NULL DEFAULT '',
  thumbnail_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'vectorized', 'error')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inf_products_org ON infringement_system.products(org_id);
CREATE INDEX IF NOT EXISTS idx_inf_products_status ON infringement_system.products(status);

-- 2. 產品向量儲存 (用於 AI 比對)
CREATE TABLE IF NOT EXISTS infringement_system.product_vectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL DEFAULT 'admin',
  product_id UUID REFERENCES infringement_system.products(id) ON DELETE CASCADE,
  vector vector(512),
  model_version TEXT DEFAULT 'clip-v1',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inf_vectors_product ON infringement_system.product_vectors(product_id);

-- 3. 監控平台配置
CREATE TABLE IF NOT EXISTS infringement_system.platforms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL DEFAULT 'admin',
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  scraper_config JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. 爬蟲任務
CREATE TABLE IF NOT EXISTS infringement_system.scrape_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL DEFAULT 'admin',
  name TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  platforms TEXT[] NOT NULL,
  keywords TEXT[],
  max_pages INT DEFAULT 5,
  total_items INT DEFAULT 0,
  matched_items INT DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_log TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inf_jobs_org ON infringement_system.scrape_jobs(org_id);
CREATE INDEX IF NOT EXISTS idx_inf_jobs_status ON infringement_system.scrape_jobs(status);

-- 5. 抓取的商品
CREATE TABLE IF NOT EXISTS infringement_system.scraped_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL DEFAULT 'admin',
  job_id UUID REFERENCES infringement_system.scrape_jobs(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  external_id TEXT,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  seller_name TEXT,
  seller_id TEXT,
  price DECIMAL(12,2),
  image_url TEXT NOT NULL,
  screenshot_url TEXT,
  scraped_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, platform, external_id)
);

CREATE INDEX IF NOT EXISTS idx_inf_scraped_job ON infringement_system.scraped_items(job_id);
CREATE INDEX IF NOT EXISTS idx_inf_scraped_seller ON infringement_system.scraped_items(seller_id);

-- 6. AI 比對結果 (侵權證據)
CREATE TABLE IF NOT EXISTS infringement_system.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL DEFAULT 'admin',
  job_id UUID REFERENCES infringement_system.scrape_jobs(id),
  product_id UUID REFERENCES infringement_system.products(id),
  scraped_item_id UUID REFERENCES infringement_system.scraped_items(id),
  similarity_score DECIMAL(5,4) NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('critical', 'high', 'medium', 'low')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'dismissed')),
  auto_filtered BOOLEAN DEFAULT false,
  -- 侵權證據相關欄位
  evidence_screenshot_url TEXT,    -- 證據截圖
  evidence_captured_at TIMESTAMPTZ, -- 證據擷取時間
  legal_action_status TEXT DEFAULT 'none' CHECK (legal_action_status IN ('none', 'warning_sent', 'reported', 'resolved')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inf_matches_org ON infringement_system.matches(org_id);
CREATE INDEX IF NOT EXISTS idx_inf_matches_status ON infringement_system.matches(status);
CREATE INDEX IF NOT EXISTS idx_inf_matches_risk ON infringement_system.matches(risk_level);

-- 7. 人工審核記錄
CREATE TABLE IF NOT EXISTS infringement_system.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL DEFAULT 'admin',
  match_id UUID REFERENCES infringement_system.matches(id) ON DELETE CASCADE,
  reviewer_id UUID,
  reviewer_name TEXT,
  verdict TEXT NOT NULL CHECK (verdict IN ('confirmed', 'dismissed')),
  reason TEXT,
  reviewed_at TIMESTAMPTZ DEFAULT now()
);

-- 8. 白名單賣場
CREATE TABLE IF NOT EXISTS infringement_system.whitelist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL DEFAULT 'admin',
  platform TEXT NOT NULL,
  seller_id TEXT NOT NULL,
  seller_name TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, platform, seller_id)
);

-- 9. 檢舉函模板
CREATE TABLE IF NOT EXISTS infringement_system.report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL DEFAULT 'admin',
  name TEXT NOT NULL,
  platform TEXT,
  template_url TEXT NOT NULL,
  field_mappings JSONB,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. 已生成報告
CREATE TABLE IF NOT EXISTS infringement_system.generated_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL DEFAULT 'admin',
  match_id UUID REFERENCES infringement_system.matches(id),
  template_id UUID REFERENCES infringement_system.report_templates(id),
  file_url TEXT NOT NULL,
  status TEXT DEFAULT 'generated' CHECK (status IN ('generated', 'submitted', 'resolved')),
  submitted_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 11. 組織設定
CREATE TABLE IF NOT EXISTS infringement_system.org_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL UNIQUE DEFAULT 'admin',
  company_name TEXT,
  contact_email TEXT,
  notify_on_critical BOOLEAN DEFAULT true,
  notify_on_high BOOLEAN DEFAULT true,
  auto_filter_whitelist BOOLEAN DEFAULT true,
  critical_threshold DECIMAL(5,2) DEFAULT 90.00,
  high_threshold DECIMAL(5,2) DEFAULT 70.00,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- Schema: outsourcing_qc (外包審核)
-- 儲存外包標註、QC 備註、去背圖檔
-- ============================================

-- 1. 外包任務批次
CREATE TABLE IF NOT EXISTS outsourcing_qc.task_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL DEFAULT 'admin',
  batch_name TEXT NOT NULL,
  task_type TEXT NOT NULL CHECK (task_type IN ('background_removal', 'image_annotation', 'data_labeling', 'other')),
  total_items INT DEFAULT 0,
  completed_items INT DEFAULT 0,
  qc_passed_items INT DEFAULT 0,
  qc_failed_items INT DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'qc_review', 'completed')),
  assigned_vendor TEXT,            -- 外包廠商名稱
  deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qc_batches_org ON outsourcing_qc.task_batches(org_id);
CREATE INDEX IF NOT EXISTS idx_qc_batches_status ON outsourcing_qc.task_batches(status);

-- 2. 外包任務項目
CREATE TABLE IF NOT EXISTS outsourcing_qc.task_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL DEFAULT 'admin',
  batch_id UUID REFERENCES outsourcing_qc.task_batches(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  -- 去背相關欄位
  original_image_url TEXT,         -- 原始圖檔
  processed_image_url TEXT,        -- 處理後圖檔 (去背後)
  -- 任務狀態
  work_status TEXT DEFAULT 'pending' CHECK (work_status IN ('pending', 'processing', 'completed', 'revision')),
  worker_id TEXT,                  -- 外包人員 ID
  worker_notes TEXT,               -- 外包人員備註
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qc_items_batch ON outsourcing_qc.task_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_qc_items_status ON outsourcing_qc.task_items(work_status);

-- 3. QC 審核記錄
CREATE TABLE IF NOT EXISTS outsourcing_qc.qc_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL DEFAULT 'admin',
  item_id UUID REFERENCES outsourcing_qc.task_items(id) ON DELETE CASCADE,
  reviewer_id UUID,
  reviewer_name TEXT,
  qc_result TEXT NOT NULL CHECK (qc_result IN ('pass', 'fail', 'revision_needed')),
  qc_score INT CHECK (qc_score >= 0 AND qc_score <= 100), -- 品質分數
  -- 審核細項
  accuracy_check BOOLEAN,          -- 準確度檢查
  quality_check BOOLEAN,           -- 品質檢查
  completeness_check BOOLEAN,      -- 完整度檢查
  -- 備註
  qc_notes TEXT,                   -- QC 備註
  revision_instructions TEXT,      -- 修改指示
  reviewed_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qc_reviews_item ON outsourcing_qc.qc_reviews(item_id);
CREATE INDEX IF NOT EXISTS idx_qc_reviews_result ON outsourcing_qc.qc_reviews(qc_result);

-- 4. 外包廠商管理
CREATE TABLE IF NOT EXISTS outsourcing_qc.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL DEFAULT 'admin',
  vendor_name TEXT NOT NULL,
  contact_person TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  specialties TEXT[],              -- 專長領域
  rating DECIMAL(3,2),             -- 評分 (0-5)
  total_tasks INT DEFAULT 0,
  completed_tasks INT DEFAULT 0,
  average_quality_score DECIMAL(5,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. 去背圖檔對照表 (removal schema 需求)
CREATE TABLE IF NOT EXISTS outsourcing_qc.image_removals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL DEFAULT 'admin',
  task_item_id UUID REFERENCES outsourcing_qc.task_items(id),
  original_url TEXT NOT NULL,      -- 去背前圖檔連結
  removed_url TEXT,                -- 去背後圖檔連結
  removal_method TEXT CHECK (removal_method IN ('ai_auto', 'manual', 'hybrid')),
  processing_time_ms INT,          -- 處理時間 (毫秒)
  file_size_before INT,            -- 原始檔案大小
  file_size_after INT,             -- 處理後檔案大小
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- Schema: ops_metrics (營運儀表板)
-- 儲存全公司 KPI、各平台營收彙整數據
-- ============================================

-- 1. 平台營收數據
CREATE TABLE IF NOT EXISTS ops_metrics.platform_revenue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL DEFAULT 'admin',
  platform TEXT NOT NULL,          -- 平台名稱 (shopee, momo, pchome, etc.)
  report_date DATE NOT NULL,       -- 報表日期
  -- 營收數據
  gross_revenue DECIMAL(15,2),     -- 毛營收
  net_revenue DECIMAL(15,2),       -- 淨營收
  orders_count INT,                -- 訂單數
  units_sold INT,                  -- 銷售件數
  returns_count INT,               -- 退貨數
  returns_amount DECIMAL(15,2),    -- 退貨金額
  -- 平台費用
  platform_fee DECIMAL(12,2),      -- 平台手續費
  shipping_cost DECIMAL(12,2),     -- 物流費用
  ad_spend DECIMAL(12,2),          -- 廣告支出
  -- 時間戳記
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, platform, report_date)
);

CREATE INDEX IF NOT EXISTS idx_ops_revenue_date ON ops_metrics.platform_revenue(report_date);
CREATE INDEX IF NOT EXISTS idx_ops_revenue_platform ON ops_metrics.platform_revenue(platform);

-- 2. 每日 KPI 彙總
CREATE TABLE IF NOT EXISTS ops_metrics.daily_kpi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL DEFAULT 'admin',
  report_date DATE NOT NULL,
  -- 營收 KPI
  total_revenue DECIMAL(15,2),
  total_orders INT,
  average_order_value DECIMAL(10,2),
  -- 侵權監控 KPI
  infringement_scanned INT,        -- 掃描商品數
  infringement_detected INT,       -- 發現侵權數
  infringement_confirmed INT,      -- 確認侵權數
  infringement_resolved INT,       -- 已處理數
  -- 外包 QC KPI
  outsourcing_tasks_total INT,     -- 外包任務總數
  outsourcing_tasks_completed INT, -- 已完成數
  outsourcing_qc_pass_rate DECIMAL(5,2), -- QC 通過率
  -- 時間戳記
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, report_date)
);

CREATE INDEX IF NOT EXISTS idx_ops_kpi_date ON ops_metrics.daily_kpi(report_date);

-- 3. 月度報表
CREATE TABLE IF NOT EXISTS ops_metrics.monthly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL DEFAULT 'admin',
  report_year INT NOT NULL,
  report_month INT NOT NULL CHECK (report_month >= 1 AND report_month <= 12),
  -- 營收彙總
  total_revenue DECIMAL(15,2),
  total_orders INT,
  total_returns INT,
  return_rate DECIMAL(5,2),
  -- 成本彙總
  total_platform_fees DECIMAL(12,2),
  total_shipping_costs DECIMAL(12,2),
  total_ad_spend DECIMAL(12,2),
  total_outsourcing_cost DECIMAL(12,2),
  -- 利潤
  gross_profit DECIMAL(15,2),
  net_profit DECIMAL(15,2),
  profit_margin DECIMAL(5,2),
  -- 侵權數據
  infringement_cases_total INT,
  infringement_cases_resolved INT,
  -- 時間戳記
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, report_year, report_month)
);

-- 4. 平台效能追蹤
CREATE TABLE IF NOT EXISTS ops_metrics.platform_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL DEFAULT 'admin',
  platform TEXT NOT NULL,
  report_date DATE NOT NULL,
  -- 流量數據
  page_views INT,
  unique_visitors INT,
  conversion_rate DECIMAL(5,4),
  -- 商品數據
  active_listings INT,             -- 上架商品數
  out_of_stock_items INT,          -- 缺貨商品數
  -- 評價數據
  average_rating DECIMAL(3,2),
  reviews_count INT,
  positive_reviews_rate DECIMAL(5,2),
  -- 時間戳記
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, platform, report_date)
);

-- 5. 警示通知記錄
CREATE TABLE IF NOT EXISTS ops_metrics.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL DEFAULT 'admin',
  alert_type TEXT NOT NULL CHECK (alert_type IN ('revenue_drop', 'infringement_spike', 'qc_failure', 'inventory_low', 'other')),
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  title TEXT NOT NULL,
  message TEXT,
  related_entity_type TEXT,        -- 關聯實體類型
  related_entity_id UUID,          -- 關聯實體 ID
  is_read BOOLEAN DEFAULT false,
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ops_alerts_type ON ops_metrics.alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_ops_alerts_severity ON ops_metrics.alerts(severity);
