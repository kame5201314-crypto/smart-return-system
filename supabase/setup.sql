-- =====================================================
-- Smart Return System - 完整設定腳本
-- 請在 Supabase Dashboard > SQL Editor 執行此腳本
-- =====================================================

-- 1. 建立 Storage Bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'return-images',
  'return-images',
  true,  -- 設為 public 以便顯示圖片
  10485760, -- 10MB 限制
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760;

-- 2. Storage 政策 - 允許上傳和讀取
DROP POLICY IF EXISTS "Allow public read" ON storage.objects;
CREATE POLICY "Allow public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'return-images');

DROP POLICY IF EXISTS "Allow service role upload" ON storage.objects;
CREATE POLICY "Allow service role upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'return-images');

DROP POLICY IF EXISTS "Allow service role delete" ON storage.objects;
CREATE POLICY "Allow service role delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'return-images');

-- 3. 確保資料表存在（如果尚未執行 schema.sql）
-- 組織表
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 插入預設組織
INSERT INTO organizations (name, slug)
VALUES ('Default Organization', 'admin')
ON CONFLICT (slug) DO NOTHING;

-- 客戶表
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) DEFAULT (SELECT id FROM organizations WHERE slug = 'admin'),
  phone VARCHAR(20) NOT NULL,
  name VARCHAR(255),
  email VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 訂單表
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) DEFAULT (SELECT id FROM organizations WHERE slug = 'admin'),
  order_number VARCHAR(100) NOT NULL,
  customer_id UUID REFERENCES customers(id),
  channel_source VARCHAR(50) CHECK (channel_source IN ('shopee', 'official', 'momo', 'dealer', 'other', 'ruten', 'pchome')) NOT NULL DEFAULT 'other',
  status VARCHAR(30) DEFAULT 'completed',
  total_amount DECIMAL(10,2),
  order_date TIMESTAMPTZ,
  shipping_address TEXT,
  customer_phone VARCHAR(20) NOT NULL,
  customer_name VARCHAR(255),
  delivered_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 退貨申請表
CREATE TABLE IF NOT EXISTS return_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) DEFAULT (SELECT id FROM organizations WHERE slug = 'admin'),
  request_number VARCHAR(50) UNIQUE,
  order_id UUID REFERENCES orders(id),
  customer_id UUID REFERENCES customers(id),
  status VARCHAR(30) CHECK (status IN (
    'pending_review',
    'approved_waiting_shipping',
    'shipping_in_transit',
    'received_inspecting',
    'abnormal_disputed',
    'refund_processing',
    'completed'
  )) DEFAULT 'pending_review',
  channel_source VARCHAR(50),
  refund_type VARCHAR(30) DEFAULT 'pending',
  ai_analysis_tag VARCHAR(100),
  reason_category VARCHAR(100),
  reason_detail TEXT,
  return_shipping_method VARCHAR(50),
  tracking_number VARCHAR(100),
  logistics_company VARCHAR(100),
  refund_amount DECIMAL(10,2),
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  inspected_at TIMESTAMPTZ,
  refund_processed_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  reviewed_by UUID,
  inspected_by UUID,
  refund_processed_by UUID,
  review_notes TEXT,
  inspection_notes TEXT,
  dispute_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 退貨項目表
CREATE TABLE IF NOT EXISTS return_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) DEFAULT (SELECT id FROM organizations WHERE slug = 'admin'),
  return_request_id UUID REFERENCES return_requests(id) ON DELETE CASCADE,
  order_item_id UUID,
  product_id UUID,
  sku VARCHAR(100),
  product_name VARCHAR(255) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2),
  reason VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 退貨圖片表
CREATE TABLE IF NOT EXISTS return_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) DEFAULT (SELECT id FROM organizations WHERE slug = 'admin'),
  return_request_id UUID REFERENCES return_requests(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  storage_path TEXT,
  image_type VARCHAR(50) DEFAULT 'product_damage',
  uploaded_by VARCHAR(20) DEFAULT 'customer',
  file_size_bytes INT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 活動日誌表
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) DEFAULT (SELECT id FROM organizations WHERE slug = 'admin'),
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL,
  actor_type VARCHAR(20),
  actor_id UUID,
  actor_name VARCHAR(255),
  old_value JSONB,
  new_value JSONB,
  description TEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 驗貨記錄表
CREATE TABLE IF NOT EXISTS inspection_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) DEFAULT (SELECT id FROM organizations WHERE slug = 'admin'),
  return_request_id UUID REFERENCES return_requests(id) ON DELETE CASCADE,
  inspector_id UUID,
  result VARCHAR(20),
  condition_grade VARCHAR(10),
  checklist JSONB DEFAULT '{}',
  notes TEXT,
  inspector_comment TEXT,
  inspected_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI 分析報告表
CREATE TABLE IF NOT EXISTS ai_analysis_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) DEFAULT (SELECT id FROM organizations WHERE slug = 'admin'),
  report_period VARCHAR(20) NOT NULL,
  report_type VARCHAR(50) DEFAULT 'monthly',
  pain_points JSONB,
  recommendations JSONB,
  sku_analysis JSONB,
  channel_analysis JSONB,
  trend_analysis JSONB,
  raw_prompt TEXT,
  raw_response TEXT,
  total_returns INT,
  total_refund_amount DECIMAL(12,2),
  return_rate DECIMAL(5,2),
  store_credit_rate DECIMAL(5,2),
  generated_by UUID,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 自動產生退貨單號的 Sequence 和 Trigger
CREATE SEQUENCE IF NOT EXISTS return_request_seq START 1;

CREATE OR REPLACE FUNCTION generate_return_request_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.request_number IS NULL THEN
    NEW.request_number := 'RET-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
      LPAD(NEXTVAL('return_request_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_return_request_number ON return_requests;
CREATE TRIGGER set_return_request_number
  BEFORE INSERT ON return_requests
  FOR EACH ROW
  EXECUTE FUNCTION generate_return_request_number();

-- 5. 建立索引提升查詢效能
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_returns_request_number ON return_requests(request_number);
CREATE INDEX IF NOT EXISTS idx_returns_status ON return_requests(status);
CREATE INDEX IF NOT EXISTS idx_returns_created ON return_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_return_images_request ON return_images(return_request_id);

-- 6. 停用 RLS（讓 Service Role 可以操作）
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE return_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE return_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE return_images DISABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE ai_analysis_reports DISABLE ROW LEVEL SECURITY;

-- 完成訊息
DO $$
BEGIN
  RAISE NOTICE '✅ Smart Return System 資料庫設定完成！';
  RAISE NOTICE '請確認已在 Vercel 設定以下環境變數：';
  RAISE NOTICE '- NEXT_PUBLIC_SUPABASE_URL';
  RAISE NOTICE '- NEXT_PUBLIC_SUPABASE_ANON_KEY';
  RAISE NOTICE '- SUPABASE_SERVICE_ROLE_KEY';
END $$;
