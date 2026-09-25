CREATE TYPE "public"."platform_incident_severity" AS ENUM('warning', 'critical');--> statement-breakpoint
CREATE TABLE "platform_incident_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_id" uuid NOT NULL,
	"action" varchar(40) NOT NULL,
	"actor_user_id" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(80) NOT NULL,
	"title" varchar(180) NOT NULL,
	"severity" "platform_incident_severity" NOT NULL,
	"details" text NOT NULL,
	"triggered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"acknowledged_by" text,
	"resolved_at" timestamp with time zone,
	"resolved_by" text,
	"resolution_note" text
);
--> statement-breakpoint
ALTER TABLE "platform_incident_events" ADD CONSTRAINT "platform_incident_events_incident_id_platform_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."platform_incidents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_incident_events" ADD CONSTRAINT "platform_incident_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_incidents" ADD CONSTRAINT "platform_incidents_acknowledged_by_users_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_incidents" ADD CONSTRAINT "platform_incidents_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "platform_incident_events_incident_idx" ON "platform_incident_events" USING btree ("incident_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_incidents_active_code_unique" ON "platform_incidents" USING btree ("code") WHERE "platform_incidents"."resolved_at" is null;--> statement-breakpoint
CREATE INDEX "platform_incidents_triggered_idx" ON "platform_incidents" USING btree ("triggered_at");