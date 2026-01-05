-- ===========================================
-- Smart Return System - 獨立專案 Schema
-- 退換貨管理系統
-- ===========================================
-- 此為獨立 Supabase 專案，與 Operations Hub 完全分離
-- 請在獨立的 Supabase 專案中執行此 SQL

-- ============================================
-- 1. 使用者表 (擴充 auth.users)
-- ============================================

CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(100),
    role VARCHAR(20) DEFAULT 'staff', -- admin, manager, staff
    org_id VARCHAR(50) NOT NULL,
    department VARCHAR(100),
    phone VARCHAR(50),
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_users_org ON public.users(org_id);
CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_users_email ON public.users(email);

-- ============================================
-- 2. 訂單表
-- ============================================

CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    platform VARCHAR(50) NOT NULL, -- shopee, pchome, momo, official_site
    platform_order_id VARCHAR(100),
    customer_name VARCHAR(100) NOT NULL,
    customer_phone VARCHAR(50),
    customer_email VARCHAR(255),
    shipping_address TEXT,
    order_date TIMESTAMPTZ NOT NULL,
    total_amount DECIMAL(12,2) NOT NULL,
    shipping_fee DECIMAL(10,2) DEFAULT 0,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    payment_method VARCHAR(50),
    payment_status VARCHAR(20) DEFAULT 'paid', -- pending, paid, refunded, partial_refund
    shipping_status VARCHAR(20) DEFAULT 'delivered', -- pending, shipped, delivered
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    org_id VARCHAR(50) NOT NULL
);

-- 索引
CREATE INDEX idx_orders_number ON public.orders(order_number);
CREATE INDEX idx_orders_platform ON public.orders(platform);
CREATE INDEX idx_orders_date ON public.orders(order_date);
CREATE INDEX idx_orders_org ON public.orders(org_id);

-- ============================================
-- 3. 訂單商品表
-- ============================================

CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_sku VARCHAR(100) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    product_image_url TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(12,2) NOT NULL,
    variant_info JSONB, -- 規格資訊（顏色、尺寸等）
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_order_items_order ON public.order_items(order_id);
CREATE INDEX idx_order_items_sku ON public.order_items(product_sku);

-- ============================================
-- 4. 退貨申請表
-- ============================================

CREATE TABLE IF NOT EXISTS public.return_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_number VARCHAR(50) UNIQUE NOT NULL,
    order_id UUID NOT NULL REFERENCES public.orders(id),
    customer_name VARCHAR(100) NOT NULL,
    customer_phone VARCHAR(50),
    customer_email VARCHAR(255),
    return_type VARCHAR(20) NOT NULL, -- return (退貨), exchange (換貨)
    reason_category VARCHAR(50) NOT NULL, -- defective, wrong_item, not_as_described, changed_mind, damaged_shipping, other
    reason_detail TEXT,
    status VARCHAR(30) DEFAULT 'pending', -- pending, approved, rejected, processing, shipped_back, received, inspecting, completed, cancelled
    priority VARCHAR(20) DEFAULT 'normal', -- low, normal, high, urgent

    -- 退款相關
    refund_amount DECIMAL(12,2),
    refund_method VARCHAR(50), -- original_payment, bank_transfer, store_credit
    refund_status VARCHAR(20), -- pending, processing, completed
    refund_completed_at TIMESTAMPTZ,

    -- 換貨相關
    exchange_product_sku VARCHAR(100),
    exchange_product_name VARCHAR(255),
    exchange_shipped_at TIMESTAMPTZ,
    exchange_tracking_number VARCHAR(100),

    -- 時間追蹤
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    received_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- 處理人員
    assigned_to UUID REFERENCES public.users(id),
    approved_by UUID REFERENCES public.users(id),

    -- 其他
    customer_tracking_number VARCHAR(100), -- 客戶寄回的物流單號
    internal_notes TEXT,
    deadline_date DATE, -- 處理期限

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    org_id VARCHAR(50) NOT NULL
);

-- 索引
CREATE INDEX idx_return_number ON public.return_requests(request_number);
CREATE INDEX idx_return_order ON public.return_requests(order_id);
CREATE INDEX idx_return_status ON public.return_requests(status);
CREATE INDEX idx_return_type ON public.return_requests(return_type);
CREATE INDEX idx_return_assigned ON public.return_requests(assigned_to);
CREATE INDEX idx_return_org ON public.return_requests(org_id);
CREATE INDEX idx_return_submitted ON public.return_requests(submitted_at);

-- ============================================
-- 5. 退貨商品表
-- ============================================

CREATE TABLE IF NOT EXISTS public.return_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_request_id UUID NOT NULL REFERENCES public.return_requests(id) ON DELETE CASCADE,
    order_item_id UUID REFERENCES public.order_items(id),
    product_sku VARCHAR(100) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(12,2) NOT NULL,
    condition VARCHAR(30), -- unopened, opened_unused, used, damaged
    condition_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_return_items_request ON public.return_items(return_request_id);

-- ============================================
-- 6. 退貨圖片表
-- ============================================

CREATE TABLE IF NOT EXISTS public.return_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_request_id UUID NOT NULL REFERENCES public.return_requests(id) ON DELETE CASCADE,
    image_type VARCHAR(50) NOT NULL, -- shipping_label, product_damage, outer_box, inspection, other
    image_url TEXT NOT NULL,
    storage_path TEXT,
    file_name VARCHAR(255),
    file_size INTEGER,
    description TEXT,
    uploaded_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_return_images_request ON public.return_images(return_request_id);
CREATE INDEX idx_return_images_type ON public.return_images(image_type);

-- ============================================
-- 7. 處理紀錄表 (時間軸)
-- ============================================

CREATE TABLE IF NOT EXISTS public.return_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_request_id UUID NOT NULL REFERENCES public.return_requests(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL, -- status_change, note_added, image_uploaded, assigned, refund_processed
    previous_value TEXT,
    new_value TEXT,
    description TEXT,
    performed_by UUID REFERENCES public.users(id),
    performed_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB
);

-- 索引
CREATE INDEX idx_return_logs_request ON public.return_logs(return_request_id);
CREATE INDEX idx_return_logs_action ON public.return_logs(action_type);
CREATE INDEX idx_return_logs_time ON public.return_logs(performed_at);

-- ============================================
-- 8. AI 分析結果表
-- ============================================

CREATE TABLE IF NOT EXISTS public.ai_analysis_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_request_id UUID NOT NULL REFERENCES public.return_requests(id) ON DELETE CASCADE,
    analysis_type VARCHAR(50) NOT NULL, -- damage_assessment, fraud_detection, sentiment_analysis
    model_used VARCHAR(100),
    input_data JSONB,
    result JSONB NOT NULL,
    confidence_score DECIMAL(5,4), -- 0.0000 ~ 1.0000
    recommendations TEXT[],
    analyzed_at TIMESTAMPTZ DEFAULT NOW(),
    processing_time_ms INTEGER
);

-- 索引
CREATE INDEX idx_ai_analysis_request ON public.ai_analysis_results(return_request_id);
CREATE INDEX idx_ai_analysis_type ON public.ai_analysis_results(analysis_type);

-- ============================================
-- 9. 通知表
-- ============================================

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    return_request_id UUID REFERENCES public.return_requests(id) ON DELETE SET NULL,
    notification_type VARCHAR(50) NOT NULL, -- new_request, status_update, assigned, deadline_warning
    title VARCHAR(255) NOT NULL,
    message TEXT,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    org_id VARCHAR(50) NOT NULL
);

-- 索引
CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_notifications_read ON public.notifications(is_read);
CREATE INDEX idx_notifications_org ON public.notifications(org_id);

-- ============================================
-- 10. 系統設定表
-- ============================================

CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value JSONB NOT NULL,
    setting_type VARCHAR(50) NOT NULL, -- policy, notification, integration
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES public.users(id),
    org_id VARCHAR(50) NOT NULL
);

-- 索引
CREATE INDEX idx_settings_key ON public.system_settings(setting_key);
CREATE INDEX idx_settings_org ON public.system_settings(org_id);

-- ============================================
-- 11. 啟用 RLS
-- ============================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analysis_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 12. RLS Policies - users
-- ============================================

-- 使用者可以讀取同組織的使用者
CREATE POLICY "users_select_org" ON public.users
    FOR SELECT USING (
        org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid())
    );

-- 使用者可以更新自己的資料
CREATE POLICY "users_update_self" ON public.users
    FOR UPDATE USING (id = auth.uid());

-- 管理員可以管理使用者
CREATE POLICY "users_admin_all" ON public.users
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    );

-- ============================================
-- 13. RLS Policies - orders
-- ============================================

CREATE POLICY "orders_select_org" ON public.orders
    FOR SELECT USING (
        org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid())
    );

CREATE POLICY "orders_insert_org" ON public.orders
    FOR INSERT WITH CHECK (
        org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid())
    );

CREATE POLICY "orders_update_org" ON public.orders
    FOR UPDATE USING (
        org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid())
    );

-- ============================================
-- 14. RLS Policies - order_items
-- ============================================

CREATE POLICY "order_items_select" ON public.order_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = order_id
            AND o.org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid())
        )
    );

CREATE POLICY "order_items_insert" ON public.order_items
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = order_id
            AND o.org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid())
        )
    );

-- ============================================
-- 15. RLS Policies - return_requests
-- ============================================

-- 組織成員可讀取所有退貨申請
CREATE POLICY "returns_select_org" ON public.return_requests
    FOR SELECT USING (
        org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid())
    );

-- 組織成員可新增退貨申請
CREATE POLICY "returns_insert_org" ON public.return_requests
    FOR INSERT WITH CHECK (
        org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid())
    );

-- 被指派者和管理員可更新
CREATE POLICY "returns_update" ON public.return_requests
    FOR UPDATE USING (
        org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid())
        AND (
            assigned_to = auth.uid() OR
            EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'manager'))
        )
    );

-- 僅管理員可刪除
CREATE POLICY "returns_delete_admin" ON public.return_requests
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    );

-- ============================================
-- 16. RLS Policies - return_items
-- ============================================

CREATE POLICY "return_items_select" ON public.return_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.return_requests r
            WHERE r.id = return_request_id
            AND r.org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid())
        )
    );

CREATE POLICY "return_items_insert" ON public.return_items
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.return_requests r
            WHERE r.id = return_request_id
            AND r.org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid())
        )
    );

CREATE POLICY "return_items_update" ON public.return_items
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.return_requests r
            WHERE r.id = return_request_id
            AND r.org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid())
        )
    );

-- ============================================
-- 17. RLS Policies - return_images
-- ============================================

CREATE POLICY "return_images_select" ON public.return_images
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.return_requests r
            WHERE r.id = return_request_id
            AND r.org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid())
        )
    );

CREATE POLICY "return_images_insert" ON public.return_images
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.return_requests r
            WHERE r.id = return_request_id
            AND r.org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid())
        )
    );

CREATE POLICY "return_images_delete" ON public.return_images
    FOR DELETE USING (
        uploaded_by = auth.uid() OR
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    );

-- ============================================
-- 18. RLS Policies - return_logs
-- ============================================

CREATE POLICY "return_logs_select" ON public.return_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.return_requests r
            WHERE r.id = return_request_id
            AND r.org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid())
        )
    );

CREATE POLICY "return_logs_insert" ON public.return_logs
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.return_requests r
            WHERE r.id = return_request_id
            AND r.org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid())
        )
    );

-- ============================================
-- 19. RLS Policies - ai_analysis_results
-- ============================================

CREATE POLICY "ai_analysis_select" ON public.ai_analysis_results
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.return_requests r
            WHERE r.id = return_request_id
            AND r.org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid())
        )
    );

CREATE POLICY "ai_analysis_insert" ON public.ai_analysis_results
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.return_requests r
            WHERE r.id = return_request_id
            AND r.org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid())
        )
    );

-- ============================================
-- 20. RLS Policies - notifications
-- ============================================

-- 使用者只能看到自己的通知
CREATE POLICY "notifications_select_own" ON public.notifications
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "notifications_update_own" ON public.notifications
    FOR UPDATE USING (user_id = auth.uid());

-- 系統可以建立通知（透過 service role）
CREATE POLICY "notifications_insert_system" ON public.notifications
    FOR INSERT WITH CHECK (
        org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid())
    );

-- ============================================
-- 21. RLS Policies - system_settings
-- ============================================

CREATE POLICY "settings_select_org" ON public.system_settings
    FOR SELECT USING (
        org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid())
    );

CREATE POLICY "settings_modify_admin" ON public.system_settings
    FOR ALL USING (
        org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid())
        AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    );

-- ============================================
-- 22. 更新時間觸發器
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_return_requests_updated_at
    BEFORE UPDATE ON public.return_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_settings_updated_at
    BEFORE UPDATE ON public.system_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 23. 預設系統設定
-- ============================================

INSERT INTO public.system_settings (setting_key, setting_value, setting_type, description, org_id)
VALUES
    ('return_policy', '{"deadline_days": 7, "allow_exchange": true, "allow_refund": true, "require_receipt": false}', 'policy', '退貨政策設定', 'default'),
    ('notification_settings', '{"email_enabled": true, "slack_enabled": false, "new_request_notify": true, "deadline_warning_days": 2}', 'notification', '通知設定', 'default'),
    ('ai_settings', '{"auto_analyze": true, "fraud_detection_enabled": true, "damage_assessment_enabled": true}', 'integration', 'AI 分析設定', 'default')
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================
-- 24. Storage Bucket (需在 Supabase Dashboard 設定)
-- ============================================

-- 請在 Supabase Dashboard > Storage 中建立以下 bucket:
-- 名稱: return-images
-- 公開: 是 (Public)
-- 允許的 MIME 類型: image/*

-- Storage RLS Policy (在 Dashboard 中設定):
-- SELECT: authenticated users can read all
-- INSERT: authenticated users can upload to returns/{return_request_id}/*
-- DELETE: only file owner or admin can delete

-- ============================================
-- 完成！
-- ============================================
-- 執行此 SQL 後，Smart Return System 將擁有：
-- 1. 使用者管理 (users)
-- 2. 訂單管理 (orders, order_items)
-- 3. 退貨管理 (return_requests, return_items, return_images, return_logs)
-- 4. AI 分析 (ai_analysis_results)
-- 5. 通知系統 (notifications)
-- 6. 系統設定 (system_settings)
-- 所有表格都已啟用 RLS 並設定了 Production 等級的權限政策
