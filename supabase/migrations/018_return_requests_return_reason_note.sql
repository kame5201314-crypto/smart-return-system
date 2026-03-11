ALTER TABLE public.return_requests
ADD COLUMN IF NOT EXISTS return_reason_note TEXT;
