-- Track AI analysis usage for quota, cost monitoring, and cache hit visibility.

CREATE TABLE IF NOT EXISTS public.ai_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature TEXT NOT NULL CHECK (feature IN ('return_ai_analysis')),
  report_period TEXT,
  model TEXT NOT NULL,
  request_fingerprint TEXT,
  cached BOOLEAN NOT NULL DEFAULT FALSE,
  success BOOLEAN NOT NULL DEFAULT TRUE,
  prompt_token_count INTEGER NOT NULL DEFAULT 0 CHECK (prompt_token_count >= 0),
  candidates_token_count INTEGER NOT NULL DEFAULT 0 CHECK (candidates_token_count >= 0),
  total_token_count INTEGER NOT NULL DEFAULT 0 CHECK (total_token_count >= 0),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_created_at
ON public.ai_usage_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_feature_period
ON public.ai_usage_events(feature, report_period, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_fingerprint
ON public.ai_usage_events(request_fingerprint);

ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ai_usage_events'
      AND policyname = 'Allow authenticated read on ai_usage_events'
  ) THEN
    CREATE POLICY "Allow authenticated read on ai_usage_events"
      ON public.ai_usage_events
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ai_usage_events'
      AND policyname = 'Allow service role full access on ai_usage_events'
  ) THEN
    CREATE POLICY "Allow service role full access on ai_usage_events"
      ON public.ai_usage_events
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;
