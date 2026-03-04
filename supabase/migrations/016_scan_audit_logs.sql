-- Audit log for manual scan bindings and status changes.

CREATE TABLE IF NOT EXISTS public.scan_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type VARCHAR(40) NOT NULL CHECK (
    action_type IN (
      'manual_bind_unmatched',
      'update_shopee_status',
      'update_pickup_status'
    )
  ),
  entity_table VARCHAR(40) NOT NULL CHECK (
    entity_table IN (
      'shopee_returns',
      'pickup_records',
      'shopee_unmatched_scans'
    )
  ),
  entity_id UUID NOT NULL,
  actor TEXT NOT NULL DEFAULT 'system',
  reason TEXT,
  before_state JSONB,
  after_state JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scan_audit_logs_created_at
ON public.scan_audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_scan_audit_logs_action_type
ON public.scan_audit_logs(action_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_scan_audit_logs_entity
ON public.scan_audit_logs(entity_table, entity_id, created_at DESC);

ALTER TABLE public.scan_audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'scan_audit_logs'
      AND policyname = 'Allow authenticated read on scan_audit_logs'
  ) THEN
    CREATE POLICY "Allow authenticated read on scan_audit_logs"
      ON public.scan_audit_logs
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'scan_audit_logs'
      AND policyname = 'Allow service role full access on scan_audit_logs'
  ) THEN
    CREATE POLICY "Allow service role full access on scan_audit_logs"
      ON public.scan_audit_logs
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;
