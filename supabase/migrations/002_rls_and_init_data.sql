-- ============================================
-- Row Level Security (RLS) 政策
-- ============================================

-- 啟用所有表的 RLS
-- infringement_system
ALTER TABLE infringement_system.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE infringement_system.product_vectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE infringement_system.platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE infringement_system.scrape_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE infringement_system.scraped_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE infringement_system.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE infringement_system.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE infringement_system.whitelist ENABLE ROW LEVEL SECURITY;
ALTER TABLE infringement_system.report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE infringement_system.generated_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE infringement_system.org_settings ENABLE ROW LEVEL SECURITY;

-- outsourcing_qc
ALTER TABLE outsourcing_qc.task_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE outsourcing_qc.task_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE outsourcing_qc.qc_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE outsourcing_qc.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE outsourcing_qc.image_removals ENABLE ROW LEVEL SECURITY;

-- ops_metrics
ALTER TABLE ops_metrics.platform_revenue ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_metrics.daily_kpi ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_metrics.monthly_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_metrics.platform_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_metrics.alerts ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS 政策: infringement_system
-- ============================================

CREATE POLICY "Allow authenticated access" ON infringement_system.products
  FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow authenticated access" ON infringement_system.product_vectors
  FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow authenticated access" ON infringement_system.platforms
  FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow authenticated access" ON infringement_system.scrape_jobs
  FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow authenticated access" ON infringement_system.scraped_items
  FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow authenticated access" ON infringement_system.matches
  FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow authenticated access" ON infringement_system.reviews
  FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow authenticated access" ON infringement_system.whitelist
  FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow authenticated access" ON infringement_system.report_templates
  FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow authenticated access" ON infringement_system.generated_reports
  FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow authenticated access" ON infringement_system.org_settings
  FOR ALL TO authenticated USING (true);

-- ============================================
-- RLS 政策: outsourcing_qc
-- ============================================

CREATE POLICY "Allow authenticated access" ON outsourcing_qc.task_batches
  FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow authenticated access" ON outsourcing_qc.task_items
  FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow authenticated access" ON outsourcing_qc.qc_reviews
  FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow authenticated access" ON outsourcing_qc.vendors
  FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow authenticated access" ON outsourcing_qc.image_removals
  FOR ALL TO authenticated USING (true);

-- ============================================
-- RLS 政策: ops_metrics
-- ============================================

CREATE POLICY "Allow authenticated access" ON ops_metrics.platform_revenue
  FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow authenticated access" ON ops_metrics.daily_kpi
  FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow authenticated access" ON ops_metrics.monthly_reports
  FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow authenticated access" ON ops_metrics.platform_performance
  FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow authenticated access" ON ops_metrics.alerts
  FOR ALL TO authenticated USING (true);

-- ============================================
-- 允許 service_role 完整存取
-- ============================================

CREATE POLICY "Allow service_role full access" ON infringement_system.products
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Allow service_role full access" ON infringement_system.product_vectors
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Allow service_role full access" ON infringement_system.platforms
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Allow service_role full access" ON infringement_system.scrape_jobs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Allow service_role full access" ON infringement_system.scraped_items
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Allow service_role full access" ON infringement_system.matches
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Allow service_role full access" ON infringement_system.reviews
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Allow service_role full access" ON infringement_system.whitelist
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Allow service_role full access" ON infringement_system.report_templates
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Allow service_role full access" ON infringement_system.generated_reports
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Allow service_role full access" ON infringement_system.org_settings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Allow service_role full access" ON outsourcing_qc.task_batches
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Allow service_role full access" ON outsourcing_qc.task_items
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Allow service_role full access" ON outsourcing_qc.qc_reviews
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Allow service_role full access" ON outsourcing_qc.vendors
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Allow service_role full access" ON outsourcing_qc.image_removals
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Allow service_role full access" ON ops_metrics.platform_revenue
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Allow service_role full access" ON ops_metrics.daily_kpi
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Allow service_role full access" ON ops_metrics.monthly_reports
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Allow service_role full access" ON ops_metrics.platform_performance
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Allow service_role full access" ON ops_metrics.alerts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================
-- 初始化資料
-- ============================================

-- 插入預設平台
INSERT INTO infringement_system.platforms (org_id, code, name, base_url, is_active) VALUES
  ('admin', 'shopee', '蝦皮購物', 'https://shopee.tw', true),
  ('admin', 'momo', 'momo購物網', 'https://www.momoshop.com.tw', true),
  ('admin', 'pchome', 'PChome', 'https://24h.pchome.com.tw', true),
  ('admin', 'yahoo', 'Yahoo購物', 'https://tw.buy.yahoo.com', true),
  ('admin', 'ruten', '露天拍賣', 'https://www.ruten.com.tw', true)
ON CONFLICT DO NOTHING;

-- 插入預設組織設定
INSERT INTO infringement_system.org_settings (org_id, company_name, notify_on_critical, notify_on_high)
VALUES ('admin', '公司營運中樞', true, true)
ON CONFLICT (org_id) DO NOTHING;

-- ============================================
-- Storage Buckets 建議
-- ============================================
-- 請在 Supabase Dashboard > Storage 中建立以下 Buckets：
-- 1. product-images (公開) - 產品原始圖片
-- 2. scraped-images (公開) - 抓取的商品圖片
-- 3. evidence-screenshots (私有) - 侵權證據截圖
-- 4. report-documents (私有) - 檢舉函文件
-- 5. outsourcing-originals (私有) - 外包原始圖檔
-- 6. outsourcing-processed (私有) - 外包處理後圖檔

-- ============================================
-- 完成訊息
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE '公司營運中樞 (Operations Hub) 資料庫建立完成！';
  RAISE NOTICE '';
  RAISE NOTICE '已建立的 Schema：';
  RAISE NOTICE '  1. infringement_system - 侵權監控系統';
  RAISE NOTICE '  2. outsourcing_qc - 外包審核系統';
  RAISE NOTICE '  3. ops_metrics - 營運儀表板';
  RAISE NOTICE '';
  RAISE NOTICE '請記得在 Storage 中建立必要的 Buckets。';
  RAISE NOTICE '============================================';
END $$;
