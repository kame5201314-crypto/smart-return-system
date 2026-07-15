-- DRAFT: Allow the application service role to read Google trial quota state.
-- Apply only to SaaS project auyznbwtjvemyamujmgt after explicit owner authorization.
-- Do not apply to the master/live/internal Supabase project.

REVOKE ALL ON TABLE public.saas_self_service_trial_claims FROM anon, authenticated;
GRANT SELECT ON TABLE public.saas_self_service_trial_claims TO service_role;

COMMENT ON TABLE public.saas_self_service_trial_claims IS
  'One-time self-service trial claims. Direct reads are limited to service_role; writes use service-role-only RPCs.';
