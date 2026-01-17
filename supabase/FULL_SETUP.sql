-- ============================================
-- Smart Return System - 完整資料庫設定
-- 請在 Supabase SQL Editor 執行此腳本
-- ============================================

-- ============================================
-- 1. Shopee 退貨管理表
-- ============================================
CREATE TABLE IF NOT EXISTS shopee_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(100) NOT NULL UNIQUE,
  order_date DATE,
  total_price DECIMAL(10, 2) DEFAULT 0,
  product_name TEXT,
  option_name TEXT,
  activity_price DECIMAL(10, 2) DEFAULT 0,
  option_sku VARCHAR(100),
  return_quantity INTEGER DEFAULT 1,
  is_processed BOOLEAN DEFAULT FALSE,
  is_printed BOOLEAN DEFAULT FALSE,
  is_scanned BOOLEAN DEFAULT FALSE,
  scanned_at TIMESTAMPTZ,
  note TEXT,
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shopee_returns_order_number ON shopee_returns(order_number);
CREATE INDEX IF NOT EXISTS idx_shopee_returns_is_processed ON shopee_returns(is_processed);
CREATE INDEX IF NOT EXISTS idx_shopee_returns_imported_at ON shopee_returns(imported_at);

-- ============================================
-- 2. 客戶表 (Portal 需要)
-- ============================================
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100),
    email VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);

-- ============================================
-- 3. 訂單表
-- ============================================
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(100) UNIQUE NOT NULL,
    customer_id UUID REFERENCES public.customers(id),
    customer_phone VARCHAR(50),
    customer_name VARCHAR(100),
    channel_source VARCHAR(50), -- shopee, official, momo, dealer, other
    status VARCHAR(30) DEFAULT 'delivered',
    total_amount DECIMAL(12,2) DEFAULT 0,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON public.orders(customer_phone);

-- ============================================
-- 4. 退貨申請表
-- ============================================
CREATE TABLE IF NOT EXISTS public.return_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_number VARCHAR(50) UNIQUE NOT NULL DEFAULT ('RET-' || to_char(NOW(), 'YYYYMMDD') || '-' || LPAD(floor(random() * 10000)::text, 4, '0')),
    order_id UUID REFERENCES public.orders(id),
    customer_id UUID REFERENCES public.customers(id),
    channel_source VARCHAR(50),
    status VARCHAR(30) DEFAULT 'pending_review',
    reason_category VARCHAR(50),
    reason_detail TEXT,
    review_notes TEXT,
    refund_amount DECIMAL(12,2),
    refund_type VARCHAR(30),
    approved_at TIMESTAMPTZ,
    shipped_at TIMESTAMPTZ,
    received_at TIMESTAMPTZ,
    refund_processed_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_return_requests_request_number ON public.return_requests(request_number);
CREATE INDEX IF NOT EXISTS idx_return_requests_order_id ON public.return_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_status ON public.return_requests(status);
CREATE INDEX IF NOT EXISTS idx_return_requests_created_at ON public.return_requests(created_at);

-- ============================================
-- 5. 退貨商品表
-- ============================================
CREATE TABLE IF NOT EXISTS public.return_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_request_id UUID NOT NULL REFERENCES public.return_requests(id) ON DELETE CASCADE,
    product_name VARCHAR(255) NOT NULL,
    product_sku VARCHAR(100),
    quantity INTEGER DEFAULT 1,
    unit_price DECIMAL(10,2),
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_return_items_return_request_id ON public.return_items(return_request_id);

-- ============================================
-- 6. 退貨圖片表
-- ============================================
CREATE TABLE IF NOT EXISTS public.return_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_request_id UUID NOT NULL REFERENCES public.return_requests(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    storage_path TEXT,
    image_type VARCHAR(50),
    uploaded_by VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_return_images_return_request_id ON public.return_images(return_request_id);

-- ============================================
-- 7. 活動日誌表
-- ============================================
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    actor_type VARCHAR(50),
    actor_id UUID,
    description TEXT,
    old_value JSONB,
    new_value JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON public.activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at);

-- ============================================
-- 8. 檢驗紀錄表
-- ============================================
CREATE TABLE IF NOT EXISTS public.inspection_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_request_id UUID NOT NULL REFERENCES public.return_requests(id) ON DELETE CASCADE,
    result VARCHAR(30),
    condition_grade VARCHAR(10),
    inspector_comment TEXT,
    inspected_by UUID,
    inspected_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inspection_records_return_request_id ON public.inspection_records(return_request_id);

-- ============================================
-- 9. AI 分析報告表
-- ============================================
CREATE TABLE IF NOT EXISTS public.ai_analysis_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_period VARCHAR(10) NOT NULL,
    report_type VARCHAR(30) DEFAULT 'monthly',
    pain_points JSONB,
    recommendations JSONB,
    sku_analysis JSONB,
    channel_analysis JSONB,
    trend_analysis JSONB,
    raw_prompt TEXT,
    raw_response TEXT,
    total_returns INTEGER,
    total_refund_amount DECIMAL(12,2),
    store_credit_rate DECIMAL(5,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_analysis_reports_period ON public.ai_analysis_reports(report_period);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_reports_created_at ON public.ai_analysis_reports(created_at);

-- ============================================
-- 10. 啟用 RLS
-- ============================================
ALTER TABLE shopee_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analysis_reports ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 11. RLS Policies
-- ============================================

-- shopee_returns
CREATE POLICY "Allow all for authenticated users" ON shopee_returns
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "service_role_shopee_returns" ON shopee_returns
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- customers
CREATE POLICY "service_role_customers" ON public.customers
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_customers_select" ON public.customers
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_customers_insert" ON public.customers
    FOR INSERT TO authenticated WITH CHECK (true);

-- orders
CREATE POLICY "service_role_orders" ON public.orders
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_orders_select" ON public.orders
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_orders_insert" ON public.orders
    FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_orders_update" ON public.orders
    FOR UPDATE TO authenticated USING (true);

-- return_requests
CREATE POLICY "service_role_return_requests" ON public.return_requests
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_return_requests_all" ON public.return_requests
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- return_items
CREATE POLICY "service_role_return_items" ON public.return_items
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_return_items_all" ON public.return_items
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- return_images
CREATE POLICY "service_role_return_images" ON public.return_images
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_return_images_all" ON public.return_images
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- activity_logs
CREATE POLICY "service_role_activity_logs" ON public.activity_logs
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_activity_logs_select" ON public.activity_logs
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_activity_logs_insert" ON public.activity_logs
    FOR INSERT TO authenticated WITH CHECK (true);

-- inspection_records
CREATE POLICY "service_role_inspection_records" ON public.inspection_records
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_inspection_records_all" ON public.inspection_records
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ai_analysis_reports
CREATE POLICY "service_role_ai_analysis_reports" ON public.ai_analysis_reports
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_ai_analysis_reports_all" ON public.ai_analysis_reports
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- 12. 更新時間觸發器
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_customers_updated_at ON public.customers;
CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON public.customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;
CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_return_requests_updated_at ON public.return_requests;
CREATE TRIGGER update_return_requests_updated_at
    BEFORE UPDATE ON public.return_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_shopee_returns_updated_at ON shopee_returns;
CREATE TRIGGER update_shopee_returns_updated_at
    BEFORE UPDATE ON shopee_returns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 完成！
-- ============================================
-- 執行完此 SQL 後，請在 Supabase Dashboard > Storage 建立:
-- Bucket 名稱: return-images
-- 公開存取: 是 (Public)
-- ============================================
