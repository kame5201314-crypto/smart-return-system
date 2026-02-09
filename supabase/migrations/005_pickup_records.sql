-- Create pickup_records table for tracking logistics pickup/collection records
CREATE TABLE IF NOT EXISTS pickup_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_date DATE NOT NULL DEFAULT CURRENT_DATE,
  order_number TEXT NOT NULL,
  tracking_number VARCHAR(100),
  platform VARCHAR(50) NOT NULL DEFAULT '商城',
  logistics_provider VARCHAR(50) NOT NULL DEFAULT '黑貓',
  delivery_status VARCHAR(50) NOT NULL DEFAULT '派車收件',
  received_status VARCHAR(50) NOT NULL DEFAULT '未收到',
  notes TEXT,
  receiver_info VARCHAR(200),
  is_printed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_pickup_records_process_date ON pickup_records(process_date);
CREATE INDEX IF NOT EXISTS idx_pickup_records_order_number ON pickup_records(order_number);
CREATE INDEX IF NOT EXISTS idx_pickup_records_received_status ON pickup_records(received_status);
CREATE INDEX IF NOT EXISTS idx_pickup_records_created_at ON pickup_records(created_at);

-- Enable RLS
ALTER TABLE pickup_records ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users (admin)
CREATE POLICY "Allow all for authenticated users" ON pickup_records
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow service role full access
CREATE POLICY "Allow service role full access" ON pickup_records
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
