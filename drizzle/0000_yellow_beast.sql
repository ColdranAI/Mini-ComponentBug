CREATE TABLE "bug_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"page_url" text NOT NULL,
	"user_agent" text NOT NULL,
	"video_url" text,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"target_region" jsonb,
	"captured_elements" jsonb,
	"environment" jsonb
);
--> statement-breakpoint
CREATE TABLE "console_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bug_report_id" uuid NOT NULL,
	"level" text NOT NULL,
	"message" text NOT NULL,
	"args" jsonb,
	"timestamp" timestamp NOT NULL,
	"is_error" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "network_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bug_report_id" uuid NOT NULL,
	"request_id" text NOT NULL,
	"url" text NOT NULL,
	"method" text NOT NULL,
	"status" integer,
	"status_text" text,
	"error" text,
	"duration" integer,
	"timestamp" timestamp NOT NULL,
	"request_headers" jsonb,
	"request_body" jsonb,
	"response_headers" jsonb,
	"response_body" jsonb,
	"is_failed" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "console_logs" ADD CONSTRAINT "console_logs_bug_report_id_bug_reports_id_fk" FOREIGN KEY ("bug_report_id") REFERENCES "public"."bug_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "network_requests" ADD CONSTRAINT "network_requests_bug_report_id_bug_reports_id_fk" FOREIGN KEY ("bug_report_id") REFERENCES "public"."bug_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bug_reports_created_at_idx" ON "bug_reports" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "bug_reports_status_idx" ON "bug_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "console_logs_bug_report_idx" ON "console_logs" USING btree ("bug_report_id");--> statement-breakpoint
CREATE INDEX "console_logs_level_idx" ON "console_logs" USING btree ("level");--> statement-breakpoint
CREATE INDEX "console_logs_error_idx" ON "console_logs" USING btree ("is_error");--> statement-breakpoint
CREATE INDEX "console_logs_timestamp_idx" ON "console_logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "network_requests_bug_report_idx" ON "network_requests" USING btree ("bug_report_id");--> statement-breakpoint
CREATE INDEX "network_requests_failed_idx" ON "network_requests" USING btree ("is_failed");--> statement-breakpoint
CREATE INDEX "network_requests_timestamp_idx" ON "network_requests" USING btree ("timestamp");