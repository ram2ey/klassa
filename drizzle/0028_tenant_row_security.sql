DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'klassa_app') THEN
    CREATE ROLE klassa_app NOLOGIN;
  END IF;
END $$;--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO klassa_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO klassa_app;--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO klassa_app;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO klassa_app;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO klassa_app;--> statement-breakpoint
DO $$
DECLARE
  table_name text;
  scope_expression text :=
    '(current_setting(''app.platform_access'', true) = ''true'' OR organization_id = ANY(COALESCE(string_to_array(NULLIF(current_setting(''app.organization_ids'', true), ''''), '','')::uuid[], ARRAY[]::uuid[])))';
BEGIN
  FOR table_name IN
    SELECT columns.table_name
    FROM information_schema.columns AS columns
    JOIN information_schema.tables AS tables
      ON tables.table_schema = columns.table_schema AND tables.table_name = columns.table_name
    WHERE columns.table_schema = 'public'
      AND columns.column_name = 'organization_id'
      AND tables.table_type = 'BASE TABLE'
      AND columns.table_name NOT IN (
        'organizations', 'users', 'organization_memberships', 'guardians',
        'invitations', 'sms_invitations', 'invitation_sms_limits', 'rate_limit_logs'
      )
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('CREATE POLICY tenant_scope ON public.%I TO klassa_app USING %s WITH CHECK %s',
      table_name, scope_expression, scope_expression);
  END LOOP;
END $$;--> statement-breakpoint
ALTER TABLE public.guardians ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY guardian_read_scope ON public.guardians FOR SELECT TO klassa_app
  USING (
    current_setting('app.platform_access', true) = 'true'
    OR organization_id = ANY(COALESCE(string_to_array(NULLIF(current_setting('app.organization_ids', true), ''), ',')::uuid[], ARRAY[]::uuid[]))
    OR user_id = current_setting('app.user_id', true)
  );--> statement-breakpoint
CREATE POLICY guardian_insert_scope ON public.guardians FOR INSERT TO klassa_app
  WITH CHECK (
    current_setting('app.platform_access', true) = 'true'
    OR organization_id = ANY(COALESCE(string_to_array(NULLIF(current_setting('app.organization_ids', true), ''), ',')::uuid[], ARRAY[]::uuid[]))
  );--> statement-breakpoint
CREATE POLICY guardian_update_scope ON public.guardians FOR UPDATE TO klassa_app
  USING (
    current_setting('app.platform_access', true) = 'true'
    OR organization_id = ANY(COALESCE(string_to_array(NULLIF(current_setting('app.organization_ids', true), ''), ',')::uuid[], ARRAY[]::uuid[]))
  )
  WITH CHECK (
    current_setting('app.platform_access', true) = 'true'
    OR organization_id = ANY(COALESCE(string_to_array(NULLIF(current_setting('app.organization_ids', true), ''), ',')::uuid[], ARRAY[]::uuid[]))
  );--> statement-breakpoint
CREATE POLICY guardian_delete_scope ON public.guardians FOR DELETE TO klassa_app
  USING (
    current_setting('app.platform_access', true) = 'true'
    OR organization_id = ANY(COALESCE(string_to_array(NULLIF(current_setting('app.organization_ids', true), ''), ',')::uuid[], ARRAY[]::uuid[]))
  );
