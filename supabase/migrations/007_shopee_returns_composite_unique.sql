-- Change unique constraint from order_number alone to (order_number, option_sku)
-- This allows the same order to have multiple return records for different products (SKUs)

-- Drop the old unique constraint on order_number
ALTER TABLE shopee_returns DROP CONSTRAINT IF EXISTS shopee_returns_order_number_key;

-- Add composite unique constraint on order_number + option_sku
ALTER TABLE shopee_returns ADD CONSTRAINT shopee_returns_order_number_option_sku_key UNIQUE (order_number, option_sku);
