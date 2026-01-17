-- Create shopee_returns table for storing imported Shopee return orders
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

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_shopee_returns_order_number ON shopee_returns(order_number);
CREATE INDEX IF NOT EXISTS idx_shopee_returns_is_processed ON shopee_returns(is_processed);
CREATE INDEX IF NOT EXISTS idx_shopee_returns_imported_at ON shopee_returns(imported_at);

-- Enable RLS
ALTER TABLE shopee_returns ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users (admin)
CREATE POLICY "Allow all for authenticated users" ON shopee_returns
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
