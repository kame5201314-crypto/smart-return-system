-- Align inspection_records with app schema so inspection submissions can store checklist data.

ALTER TABLE public.inspection_records
ADD COLUMN IF NOT EXISTS checklist JSONB DEFAULT '{
  "packaging_intact": null,
  "product_intact": null,
  "accessories_complete": null,
  "matches_photos": null,
  "resellable": null
}'::jsonb;

ALTER TABLE public.inspection_records
ADD COLUMN IF NOT EXISTS notes TEXT;
