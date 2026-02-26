-- Separate inbound status from scan status for shopee returns.
-- Scan (`is_scanned`) means barcode matched.
-- Inbound (`is_inbound`) means physically stocked in warehouse.

ALTER TABLE public.shopee_returns
ADD COLUMN IF NOT EXISTS is_inbound BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.shopee_returns
ADD COLUMN IF NOT EXISTS inbound_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_shopee_returns_is_inbound
ON public.shopee_returns(is_inbound);
