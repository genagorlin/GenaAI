CREATE TABLE "client_reminders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"template_id" varchar NOT NULL,
	"schedule_type" text NOT NULL,
	"schedule_days" jsonb,
	"schedule_time" text NOT NULL,
	"custom_interval_days" integer,
	"timezone" text DEFAULT 'America/New_York' NOT NULL,
	"is_enabled" integer DEFAULT 1 NOT NULL,
	"is_paused" integer DEFAULT 0 NOT NULL,
	"paused_until" timestamp,
	"last_sent_at" timestamp,
	"next_scheduled_at" timestamp,
	"subject_override" text,
	"body_override" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "exercise_step_responses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"step_id" varchar NOT NULL,
	"response" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"ai_guidance" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "magic_link_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"token" text NOT NULL,
	"code" text DEFAULT '000000' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "magic_link_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "reminder_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_reminder_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"template_id" varchar,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"recipient_email" text NOT NULL,
	"status" text NOT NULL,
	"error_message" text,
	"sent_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reminder_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"category" text,
	"is_active" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "timezone" text DEFAULT 'America/New_York';--> statement-breakpoint
ALTER TABLE "client_reminders" ADD CONSTRAINT "client_reminders_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_reminders" ADD CONSTRAINT "client_reminders_template_id_reminder_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."reminder_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_step_responses" ADD CONSTRAINT "exercise_step_responses_session_id_client_exercise_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."client_exercise_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_step_responses" ADD CONSTRAINT "exercise_step_responses_step_id_exercise_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."exercise_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_history" ADD CONSTRAINT "reminder_history_client_reminder_id_client_reminders_id_fk" FOREIGN KEY ("client_reminder_id") REFERENCES "public"."client_reminders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_history" ADD CONSTRAINT "reminder_history_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_history" ADD CONSTRAINT "reminder_history_template_id_reminder_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."reminder_templates"("id") ON DELETE set null ON UPDATE no action;