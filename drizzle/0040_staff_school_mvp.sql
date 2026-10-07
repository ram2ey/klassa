ALTER TABLE "terms" ADD COLUMN "classwork_weight" integer DEFAULT 40 NOT NULL;
ALTER TABLE "terms" ADD CONSTRAINT "terms_classwork_weight_check" CHECK (classwork_weight BETWEEN 1 AND 99);
ALTER TABLE "report_cards" ADD COLUMN "source_fingerprint" text;
ALTER TABLE "report_cards" ADD COLUMN "days_excused" integer DEFAULT 0 NOT NULL;
ALTER TABLE "report_card_subject_grades" ALTER COLUMN "letter_grade" DROP NOT NULL;
ALTER TABLE "report_card_subject_grades" ADD COLUMN "classwork_score" numeric(5,2);
ALTER TABLE "report_card_subject_grades" ADD COLUMN "exam_score" numeric(5,2);
ALTER TABLE "report_card_subject_grades" ADD COLUMN "classwork_weight" integer;
ALTER TABLE "report_card_subject_grades" ADD COLUMN "subject_name" varchar(120);
--> statement-breakpoint
CREATE TABLE "class_subjects" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
 "class_id" uuid NOT NULL REFERENCES "classes"("id") ON DELETE CASCADE, "subject_id" uuid NOT NULL REFERENCES "subjects"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "class_subjects_unique" ON "class_subjects" (organization_id, class_id, subject_id);
INSERT INTO class_subjects (organization_id, class_id, subject_id)
 SELECT DISTINCT organization_id, class_id, subject_id FROM teacher_class_assignments WHERE subject_id IS NOT NULL ON CONFLICT DO NOTHING;
--> statement-breakpoint
CREATE TABLE "term_marks" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
 "class_id" uuid NOT NULL REFERENCES "classes"("id") ON DELETE RESTRICT, "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE RESTRICT,
 "term_id" uuid NOT NULL REFERENCES "terms"("id") ON DELETE RESTRICT, "subject_id" uuid NOT NULL REFERENCES "subjects"("id") ON DELETE RESTRICT,
 "classwork_score" numeric(5,2), "exam_score" numeric(5,2), "remark" text DEFAULT '' NOT NULL,
 "updated_by" text NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
 "created_at" timestamptz DEFAULT now() NOT NULL, "updated_at" timestamptz DEFAULT now() NOT NULL,
 CHECK (classwork_score BETWEEN 0 AND 100), CHECK (exam_score BETWEEN 0 AND 100)
);
CREATE UNIQUE INDEX "term_marks_unique" ON "term_marks" (organization_id, student_id, term_id, subject_id);
CREATE INDEX "term_marks_class_term_idx" ON "term_marks" (organization_id, class_id, term_id);
--> statement-breakpoint
CREATE TABLE "fee_definitions" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
 "class_id" uuid NOT NULL REFERENCES "classes"("id") ON DELETE RESTRICT, "term_id" uuid NOT NULL REFERENCES "terms"("id") ON DELETE RESTRICT,
 "name" varchar(120) NOT NULL, "amount_pesewas" bigint NOT NULL CHECK (amount_pesewas BETWEEN 1 AND 100000000000),
 "created_at" timestamptz DEFAULT now() NOT NULL, "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "fee_definitions_unique" ON "fee_definitions" (organization_id, class_id, term_id, name);
--> statement-breakpoint
CREATE TABLE "fee_entries" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
 "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE RESTRICT, "term_id" uuid REFERENCES "terms"("id") ON DELETE RESTRICT,
 "definition_id" uuid REFERENCES "fee_definitions"("id") ON DELETE RESTRICT, "kind" varchar(20) NOT NULL CHECK (kind IN ('charge','opening','adjustment')),
 "label" varchar(120) NOT NULL, "amount_pesewas" bigint NOT NULL CHECK (amount_pesewas <> 0 AND amount_pesewas BETWEEN -100000000000 AND 100000000000),
 "reason" text DEFAULT '' NOT NULL, "entry_date" date NOT NULL, "recorded_by" text NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
 "created_at" timestamptz DEFAULT now() NOT NULL,
 CHECK ((kind = 'charge' AND definition_id IS NOT NULL AND amount_pesewas > 0) OR (kind = 'opening' AND definition_id IS NULL AND amount_pesewas > 0) OR (kind = 'adjustment' AND definition_id IS NULL))
);
CREATE INDEX "fee_entries_student_idx" ON "fee_entries" (organization_id, student_id);
CREATE UNIQUE INDEX "fee_entries_charge_unique" ON "fee_entries" (organization_id, student_id, definition_id);
CREATE UNIQUE INDEX "fee_entries_opening_unique" ON "fee_entries" (organization_id, student_id) WHERE kind = 'opening';
--> statement-breakpoint
CREATE TABLE "fee_payments" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
 "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE RESTRICT,
 "amount_pesewas" bigint NOT NULL CHECK (amount_pesewas BETWEEN 1 AND 100000000000), "balance_after_pesewas" bigint NOT NULL,
 "receipt_number" varchar(40) NOT NULL, "payment_date" date NOT NULL, "method" varchar(20) NOT NULL CHECK (method IN ('cash','mobile_money','bank')),
 "reference" varchar(120) DEFAULT '' NOT NULL, "recorded_by" text NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
 "voided_at" timestamptz, "voided_by" text REFERENCES "users"("id") ON DELETE RESTRICT, "void_reason" text,
 "created_at" timestamptz DEFAULT now() NOT NULL,
 CHECK ((voided_at IS NULL AND voided_by IS NULL AND void_reason IS NULL) OR (voided_at IS NOT NULL AND voided_by IS NOT NULL AND length(trim(void_reason)) >= 4))
);
CREATE UNIQUE INDEX "fee_payments_receipt_unique" ON "fee_payments" (organization_id, receipt_number);
CREATE INDEX "fee_payments_student_idx" ON "fee_payments" (organization_id, student_id);
--> statement-breakpoint
CREATE TABLE "fee_counters" (
 "organization_id" uuid PRIMARY KEY REFERENCES "organizations"("id") ON DELETE CASCADE, "next_number" bigint DEFAULT 1 NOT NULL CHECK (next_number > 0)
);
CREATE TABLE "mvp_operations" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
 "request_id" uuid NOT NULL, "actor_id" text NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT, "fingerprint" text NOT NULL,
 "result" jsonb NOT NULL, "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "mvp_operations_request_unique" ON "mvp_operations" (organization_id, request_id);
--> statement-breakpoint
DO $$ DECLARE tab text; scope text := '(organization_id = ANY(COALESCE(string_to_array(NULLIF(current_setting(''app.organization_ids'', true), ''''), '','')::uuid[], ARRAY[]::uuid[])))';
BEGIN
 FOREACH tab IN ARRAY ARRAY['class_subjects','term_marks','mvp_operations'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tab);
  EXECUTE format('CREATE POLICY tenant_scope ON %I TO klassa_app USING %s WITH CHECK %s', tab, scope, scope);
 END LOOP;
 FOREACH tab IN ARRAY ARRAY['fee_definitions','fee_entries','fee_payments','fee_counters'] LOOP
  scope := format('(organization_id = ANY(COALESCE(string_to_array(NULLIF(current_setting(''app.organization_ids'', true), ''''), '','')::uuid[], ARRAY[]::uuid[])) AND EXISTS (SELECT 1 FROM organization_memberships m WHERE m.organization_id = %I.organization_id AND m.user_id = current_setting(''app.user_id'',true) AND m.role IN (''school_admin'',''office_staff'')))', tab);
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tab);
  EXECUTE format('CREATE POLICY tenant_scope ON %I TO klassa_app USING %s WITH CHECK %s', tab, scope, scope);
 END LOOP;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON class_subjects, term_marks, fee_definitions, fee_entries, fee_payments, fee_counters, mvp_operations TO klassa_app;
--> statement-breakpoint
CREATE FUNCTION klassa_mvp_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF current_user <> 'klassa_app' THEN
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
 END IF;
 IF TG_TABLE_NAME = 'fee_entries' OR TG_TABLE_NAME = 'mvp_operations' THEN RAISE EXCEPTION 'Posted ledger entries and request receipts are immutable'; END IF;
 IF TG_TABLE_NAME = 'fee_payments' THEN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Void a payment instead of deleting it'; END IF;
  IF OLD.voided_at IS NOT NULL OR NEW.voided_at IS NULL OR (to_jsonb(OLD) - ARRAY['voided_at','voided_by','void_reason']) IS DISTINCT FROM (to_jsonb(NEW) - ARRAY['voided_at','voided_by','void_reason']) THEN
   RAISE EXCEPTION 'Only void details can change on a payment';
  END IF;
 END IF;
 IF TG_TABLE_NAME = 'report_cards' THEN
  IF OLD.status = 'published' AND OLD.source_fingerprint IS NOT NULL THEN RAISE EXCEPTION 'Published reports are immutable'; END IF;
 END IF;
 IF TG_TABLE_NAME = 'report_card_subject_grades' THEN
  IF EXISTS (SELECT 1 FROM report_cards WHERE id = CASE WHEN TG_OP = 'INSERT' THEN NEW.report_card_id ELSE OLD.report_card_id END AND status = 'published' AND source_fingerprint IS NOT NULL) THEN RAISE EXCEPTION 'Published subject results are immutable'; END IF;
  IF TG_OP = 'UPDATE' THEN
   IF EXISTS (SELECT 1 FROM report_cards WHERE id = NEW.report_card_id AND status = 'published' AND source_fingerprint IS NOT NULL) THEN RAISE EXCEPTION 'Published subject results are immutable'; END IF;
  END IF;
 END IF;
 IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE TRIGGER fee_entries_immutable BEFORE UPDATE OR DELETE ON fee_entries FOR EACH ROW EXECUTE FUNCTION klassa_mvp_immutable();
CREATE TRIGGER mvp_operations_immutable BEFORE UPDATE OR DELETE ON mvp_operations FOR EACH ROW EXECUTE FUNCTION klassa_mvp_immutable();
CREATE TRIGGER fee_payments_immutable BEFORE UPDATE OR DELETE ON fee_payments FOR EACH ROW EXECUTE FUNCTION klassa_mvp_immutable();
CREATE TRIGGER report_cards_immutable BEFORE UPDATE OR DELETE ON report_cards FOR EACH ROW EXECUTE FUNCTION klassa_mvp_immutable();
CREATE TRIGGER report_subjects_immutable BEFORE INSERT OR UPDATE OR DELETE ON report_card_subject_grades FOR EACH ROW EXECUTE FUNCTION klassa_mvp_immutable();
