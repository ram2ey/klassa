CREATE TABLE "platform_request_metrics" (
	"minute" timestamp with time zone NOT NULL,
	"instance_id" varchar(120) NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "platform_request_metrics_minute_instance_id_pk" PRIMARY KEY("minute","instance_id")
);
