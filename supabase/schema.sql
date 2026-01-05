-- =====================================================
-- Smart Return System (ORS) - Database Schema
-- Version: 1.0.0
-- Updated: Based on Andy's strategic optimization
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. organizations - Multi-tenant support
-- =====================================================
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default organization
INSERT INTO organizations (name, slug) VALUES ('Default Organization', 'admin');

-- =====================================================
-- 2. users - Admin/Staff accounts
-- =====================================================
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id) DEFAULT (SELECT id FROM organizations WHERE slug = 'admin'),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  role VARCHAR(20) CHECK (role IN ('admin', 'staff')) DEFAULT 'staff',
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 3. customers - Customer records
-- =====================================================
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) DEFAULT (SELECT id FROM organizations WHERE slug = 'admin'),
  phone VARCHAR(20) NOT NULL,
  name VARCHAR(255),
  email VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, phone)
);

-- =====================================================
-- 4. products - Product/SKU catalog
-- =====================================================
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) DEFAULT (SELECT id FROM organizations WHERE slug = 'admin'),
  sku VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  price DECIMAL(10,2),
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, sku)
);

-- =====================================================
-- 5. orders - Order records
-- =====================================================
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) DEFAULT (SELECT id FROM organizations WHERE slug = 'admin'),
  order_number VARCHAR(100) NOT NULL,
  customer_id UUID REFERENCES customers(id),

  -- Channel source (Andy's optimization)
  channel_source VARCHAR(50) CHECK (channel_source IN ('shopee', 'official', 'momo', 'dealer', 'other')) NOT NULL,

  status VARCHAR(30) DEFAULT 'completed',
  total_amount DECIMAL(10,2),
  order_date TIMESTAMPTZ,
  shipping_address TEXT,
  customer_phone VARCHAR(20) NOT NULL,
  customer_name VARCHAR(255),

  -- For return eligibility check (7-day policy)
  delivered_at TIMESTAMPTZ,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, order_number)
);

-- =====================================================
-- 6. order_items - Order line items
-- =====================================================
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) DEFAULT (SELECT id FROM organizations WHERE slug = 'admin'),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  sku VARCHAR(100),
  product_name VARCHAR(255) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 7. return_requests - Core return management (OPTIMIZED)
-- =====================================================
CREATE TABLE return_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) DEFAULT (SELECT id FROM organizations WHERE slug = 'admin'),
  request_number VARCHAR(50) UNIQUE NOT NULL,
  order_id UUID REFERENCES orders(id),
  customer_id UUID REFERENCES customers(id),

  -- ========================================
  -- 7-Stage Status Machine (Andy's Version)
  -- ========================================
  status VARCHAR(30) CHECK (status IN (
    'pending_review',           -- 待審核: Customer just submitted
    'approved_waiting_shipping',-- 審核通過，待寄回: Approved, waiting for return shipment
    'shipping_in_transit',      -- 退貨運輸中: Package is on the way back
    'received_inspecting',      -- 倉庫收貨，驗收中: Warehouse received, inspection in progress
    'abnormal_disputed',        -- 異常/爭議: Escalated to supervisor
    'refund_processing',        -- 退款處理中: Handed to Finance (婷)
    'completed'                 -- 已結案: Closed
  )) DEFAULT 'pending_review',

  -- ========================================
  -- Channel & Refund (Andy's Optimization)
  -- ========================================
  channel_source VARCHAR(50) CHECK (channel_source IN ('shopee', 'official', 'momo', 'dealer', 'other')),

  -- Refund method (strategy: guide customers to store credit)
  refund_type VARCHAR(30) CHECK (refund_type IN (
    'original_payment',    -- 原路退刷
    'store_credit',        -- 轉為官網購物金
    'bank_transfer',       -- 銀行轉帳
    'pending'              -- 待決定
  )) DEFAULT 'pending',

  -- AI analysis tag (auto-filled by AI)
  ai_analysis_tag VARCHAR(100),

  -- ========================================
  -- Return Information
  -- ========================================
  reason_category VARCHAR(100),
  reason_detail TEXT,

  -- Return shipping method
  return_shipping_method VARCHAR(50) CHECK (return_shipping_method IN (
    'self_ship',           -- 客戶自行寄回
    'convenience_store',   -- 超商交貨便
    'company_pickup'       -- 公司派車回收
  )),

  -- Logistics tracking
  tracking_number VARCHAR(100),
  logistics_company VARCHAR(100),

  -- Financial
  refund_amount DECIMAL(10,2),

  -- ========================================
  -- Timestamps for each stage
  -- ========================================
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  inspected_at TIMESTAMPTZ,
  refund_processed_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,

  -- Handlers
  reviewed_by UUID REFERENCES users(id),
  inspected_by UUID REFERENCES users(id),
  refund_processed_by UUID REFERENCES users(id),

  -- Notes
  review_notes TEXT,
  inspection_notes TEXT,
  dispute_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 8. return_items - Items being returned
-- =====================================================
CREATE TABLE return_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) DEFAULT (SELECT id FROM organizations WHERE slug = 'admin'),
  return_request_id UUID REFERENCES return_requests(id) ON DELETE CASCADE,
  order_item_id UUID REFERENCES order_items(id),
  product_id UUID REFERENCES products(id),
  sku VARCHAR(100),
  product_name VARCHAR(255) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2),
  reason VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 9. return_images - Photos (3-5 required)
-- =====================================================
CREATE TABLE return_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) DEFAULT (SELECT id FROM organizations WHERE slug = 'admin'),
  return_request_id UUID REFERENCES return_requests(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  storage_path TEXT,
  image_type VARCHAR(50) CHECK (image_type IN (
    'shipping_label',    -- 物流面單
    'product_damage',    -- 商品損壞處
    'outer_box',         -- 外箱狀況
    'inspection',        -- 驗貨照片 (staff)
    'other'
  )),
  uploaded_by VARCHAR(20) CHECK (uploaded_by IN ('customer', 'staff')),
  file_size_bytes INT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 10. inspection_records - 驗貨紀錄
-- =====================================================
CREATE TABLE inspection_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) DEFAULT (SELECT id FROM organizations WHERE slug = 'admin'),
  return_request_id UUID REFERENCES return_requests(id) ON DELETE CASCADE,
  inspector_id UUID REFERENCES users(id),

  result VARCHAR(20) CHECK (result IN ('passed', 'failed', 'partial')),
  condition_grade VARCHAR(10) CHECK (condition_grade IN ('A', 'B', 'C', 'D', 'F')),

  -- Inspection checklist
  checklist JSONB DEFAULT '{
    "packaging_intact": null,
    "product_intact": null,
    "accessories_complete": null,
    "matches_photos": null,
    "resellable": null
  }',

  notes TEXT,
  inspector_comment TEXT,

  inspected_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 11. ai_analysis_reports - AI monthly reports
-- =====================================================
CREATE TABLE ai_analysis_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) DEFAULT (SELECT id FROM organizations WHERE slug = 'admin'),

  report_period VARCHAR(20) NOT NULL,  -- e.g., '2024-01'
  report_type VARCHAR(50) DEFAULT 'monthly',

  -- AI Analysis Results
  pain_points JSONB,          -- Core pain point diagnosis
  recommendations JSONB,      -- Optimization suggestions
  sku_analysis JSONB,         -- SKU-specific analysis
  channel_analysis JSONB,     -- Channel-specific analysis
  trend_analysis JSONB,       -- Trend analysis
  raw_prompt TEXT,            -- AI prompt used
  raw_response TEXT,          -- Raw AI response

  -- Statistics Snapshot
  total_returns INT,
  total_refund_amount DECIMAL(12,2),
  return_rate DECIMAL(5,2),
  store_credit_rate DECIMAL(5,2),  -- % converted to store credit

  generated_by UUID REFERENCES users(id),
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 12. activity_logs - Audit trail
-- =====================================================
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) DEFAULT (SELECT id FROM organizations WHERE slug = 'admin'),

  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL,

  actor_type VARCHAR(20) CHECK (actor_type IN ('user', 'customer', 'system')),
  actor_id UUID,
  actor_name VARCHAR(255),

  old_value JSONB,
  new_value JSONB,
  description TEXT,
  ip_address VARCHAR(45),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES for Performance
-- =====================================================
CREATE INDEX idx_orders_org_number ON orders(org_id, order_number);
CREATE INDEX idx_orders_customer_phone ON orders(customer_phone);
CREATE INDEX idx_orders_channel ON orders(channel_source);
CREATE INDEX idx_orders_delivered ON orders(delivered_at);

CREATE INDEX idx_returns_org_status ON return_requests(org_id, status);
CREATE INDEX idx_returns_channel ON return_requests(channel_source);
CREATE INDEX idx_returns_created ON return_requests(created_at DESC);
CREATE INDEX idx_returns_request_number ON return_requests(request_number);

CREATE INDEX idx_return_items_sku ON return_items(sku);
CREATE INDEX idx_return_items_product ON return_items(product_id);

CREATE INDEX idx_return_images_request ON return_images(return_request_id);

CREATE INDEX idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX idx_activity_logs_created ON activity_logs(created_at DESC);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_analysis_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view own org data" ON users
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

-- RLS Policies for return_requests
CREATE POLICY "Staff can view own org returns" ON return_requests
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Staff can insert returns" ON return_requests
  FOR INSERT WITH CHECK (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Staff can update own org returns" ON return_requests
  FOR UPDATE USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Auto-generate request number
CREATE OR REPLACE FUNCTION generate_return_request_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.request_number := 'RET-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
    LPAD(NEXTVAL('return_request_seq')::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE IF NOT EXISTS return_request_seq START 1;

CREATE TRIGGER set_return_request_number
  BEFORE INSERT ON return_requests
  FOR EACH ROW
  WHEN (NEW.request_number IS NULL)
  EXECUTE FUNCTION generate_return_request_number();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_return_requests_updated_at
  BEFORE UPDATE ON return_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- STORAGE BUCKET (run in Supabase Dashboard)
-- =====================================================
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('return-images', 'return-images', false);
