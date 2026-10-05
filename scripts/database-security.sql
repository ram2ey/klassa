-- Reconcile permissions after restoring archives whose migration ledger is already complete.
-- Run as the migration owner, never as an application/worker account.
DO $$ BEGIN
  IF current_user IN ('klassa_app', 'klassa_sms_worker') THEN
    RAISE EXCEPTION 'Security setup requires the migration owner';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN ('klassa_app', 'klassa_sms_worker')
    AND (rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb)) THEN
    RAISE EXCEPTION 'Application roles have unsafe cluster privileges';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid = m.member
    WHERE r.rolname IN ('klassa_app', 'klassa_sms_worker')) THEN
    RAISE EXCEPTION 'Application roles must not inherit other roles';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_roles r ON r.oid = c.relowner
    JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public'
    AND r.rolname IN ('klassa_app', 'klassa_sms_worker')) THEN
    RAISE EXCEPTION 'Application roles must not own tables';
  END IF;
END $$;
GRANT USAGE ON SCHEMA public TO klassa_app, klassa_sms_worker;
REVOKE CREATE ON SCHEMA public FROM PUBLIC, klassa_app, klassa_sms_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO klassa_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO klassa_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO klassa_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO klassa_app;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM klassa_sms_worker;
GRANT SELECT, UPDATE ON public.sms_dispatches, public.sms_invitations, public.sms_worker_status TO klassa_sms_worker;
REVOKE ALL ON FUNCTION public.klassa_claim_sms_dispatch(uuid) FROM PUBLIC, klassa_app;
GRANT EXECUTE ON FUNCTION public.klassa_claim_sms_dispatch(uuid) TO klassa_sms_worker;
DO $$ BEGIN
  IF has_function_privilege('klassa_app', 'public.klassa_claim_sms_dispatch(uuid)', 'EXECUTE')
    OR NOT has_function_privilege('klassa_sms_worker', 'public.klassa_claim_sms_dispatch(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'SMS function permissions are unsafe';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid WHERE n.nspname = 'public' AND c.relkind = 'r'
    AND a.attname = 'organization_id' AND NOT a.attisdropped
    AND c.relname NOT IN ('organizations', 'users', 'organization_memberships', 'invitations',
      'sms_invitations', 'invitation_sms_limits', 'rate_limit_logs')
    AND (NOT c.relrowsecurity OR NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid))) THEN
    RAISE EXCEPTION 'Restored database lacks tenant row security';
  END IF;
END $$;
