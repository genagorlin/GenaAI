CREATE TABLE "authorized_users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"last_login" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "authorized_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "client_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"title" text DEFAULT 'Client Profile' NOT NULL,
	"last_updated" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "client_documents_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE "client_exercise_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"exercise_id" varchar NOT NULL,
	"thread_id" varchar,
	"current_step_id" varchar,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"summary" text
);
--> statement-breakpoint
CREATE TABLE "client_methodologies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"methodology_id" varchar NOT NULL,
	"is_active" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"photo_url" text,
	"status" text DEFAULT 'active' NOT NULL,
	"last_active" timestamp DEFAULT now(),
	"mobile_app_connected" integer DEFAULT 0 NOT NULL,
	"last_summarized_at" timestamp,
	CONSTRAINT "clients_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "coach_consultations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coach_mentions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"thread_id" varchar,
	"is_read" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_sections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" varchar NOT NULL,
	"section_type" text DEFAULT 'custom' NOT NULL,
	"title" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"previous_content" text,
	"last_updated_by" text DEFAULT 'coach',
	"pending_review" integer DEFAULT 0 NOT NULL,
	"coach_notes" text DEFAULT '',
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_collapsed" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "exercise_steps" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exercise_id" varchar NOT NULL,
	"title" text NOT NULL,
	"instructions" text NOT NULL,
	"completion_criteria" text,
	"supporting_material" text,
	"step_order" integer DEFAULT 0 NOT NULL,
	"next_step_id" varchar,
	"branching_rules" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "file_attachments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"filename" text NOT NULL,
	"original_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"object_path" text NOT NULL,
	"extracted_text" text,
	"exercise_id" varchar,
	"reference_document_id" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "guided_exercises" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"category" text,
	"estimated_minutes" integer,
	"system_prompt" text DEFAULT '' NOT NULL,
	"is_published" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "insights" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"thread_id" varchar,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"type" text DEFAULT 'text' NOT NULL,
	"duration" text,
	"mentions_coach" integer DEFAULT 0 NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "methodology_frames" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"content" text NOT NULL,
	"is_active" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reference_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"description" text,
	"tags" text[],
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "role_prompts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"content" text DEFAULT 'You are an assistant to Dr. Gena Gorlin, who provides coaching to ambitious founders and builders. You are familiar with Gena''s online writing on the "psychology of ambition," including her "builder''s mindset" framework. You do not prescribe advice. You ask clarifying questions when needed.' NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "role_prompts_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE "sentiment_data" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"date" text NOT NULL,
	"sentiment_score" integer NOT NULL,
	"intensity_score" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "survey_exercises" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"category" text,
	"estimated_minutes" integer,
	"summary_prompt" text,
	"is_published" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "survey_questions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"survey_id" varchar NOT NULL,
	"question_text" text NOT NULL,
	"question_type" text NOT NULL,
	"options" jsonb,
	"rating_min" integer,
	"rating_max" integer,
	"rating_labels" jsonb,
	"is_required" integer DEFAULT 1 NOT NULL,
	"question_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "survey_responses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"question_id" varchar NOT NULL,
	"text_response" text,
	"selected_options" jsonb,
	"rating_value" integer,
	"answered_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "survey_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"survey_id" varchar NOT NULL,
	"current_question_id" varchar,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"ai_summary" text
);
--> statement-breakpoint
CREATE TABLE "task_prompts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"content" text DEFAULT 'Open each new conversation with the client exactly as follows: "Hi [client name], welcome to your AI-assisted coaching log. By default, I''ll mostly listen and hang back to give you space to self-reflect. Let me know if you''d like me to assist you in any other way, such as by helping you identify and interrogate what you''re feeling, or work through a difficult decision in a manner that aligns with your goals and values, or track down relevant insights from Gena''s writing on the "builder''s mindset" or your prior coaching sessions. You can also call Gena into this chat directly by typing "@coach" at any point.

Now, what would you like to log or reflect on today?"

By default, you serve mainly as a "scribe" who listens quietly and records the client''s journaling: you may occasionally provide brief, tentative reflections of what the client is sharing as and when it feels natural, but you mostly hang back and give brief responses like "go on, I''m listening" unless the client specifically requests something different. If and only if the client specifically requests it, you can: 1) offer reminders of what has been discussed in the client''s coaching sessions with Gena so far (based on the living document); 2) answer the client''s questions to the best of your ability, offering quotes or close paraphrases from Gena''s writing on the builder''s mindset and the psychology of ambition where applicable; 3) ask clarifying questions to better understand the client''s question or request; 4) help the client identify and process feelings, reality-check a perspective, or think through a decision in a values-based manner. Whenever there''s an open question or issue raised that might be helpful for the client to discuss with Gena in their next coaching session, add this to the "Open questions to discuss with Gena" section of the profile document.' NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "task_prompts_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE "threads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"title" text DEFAULT 'New conversation' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_message_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "client_documents" ADD CONSTRAINT "client_documents_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_exercise_sessions" ADD CONSTRAINT "client_exercise_sessions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_exercise_sessions" ADD CONSTRAINT "client_exercise_sessions_exercise_id_guided_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."guided_exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_exercise_sessions" ADD CONSTRAINT "client_exercise_sessions_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_exercise_sessions" ADD CONSTRAINT "client_exercise_sessions_current_step_id_exercise_steps_id_fk" FOREIGN KEY ("current_step_id") REFERENCES "public"."exercise_steps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_methodologies" ADD CONSTRAINT "client_methodologies_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_methodologies" ADD CONSTRAINT "client_methodologies_methodology_id_methodology_frames_id_fk" FOREIGN KEY ("methodology_id") REFERENCES "public"."methodology_frames"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_consultations" ADD CONSTRAINT "coach_consultations_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_mentions" ADD CONSTRAINT "coach_mentions_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_mentions" ADD CONSTRAINT "coach_mentions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_mentions" ADD CONSTRAINT "coach_mentions_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_sections" ADD CONSTRAINT "document_sections_document_id_client_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."client_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_steps" ADD CONSTRAINT "exercise_steps_exercise_id_guided_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."guided_exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_attachments" ADD CONSTRAINT "file_attachments_exercise_id_guided_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."guided_exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_attachments" ADD CONSTRAINT "file_attachments_reference_document_id_reference_documents_id_fk" FOREIGN KEY ("reference_document_id") REFERENCES "public"."reference_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insights" ADD CONSTRAINT "insights_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_prompts" ADD CONSTRAINT "role_prompts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sentiment_data" ADD CONSTRAINT "sentiment_data_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_questions" ADD CONSTRAINT "survey_questions_survey_id_survey_exercises_id_fk" FOREIGN KEY ("survey_id") REFERENCES "public"."survey_exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_session_id_survey_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."survey_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_question_id_survey_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."survey_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_sessions" ADD CONSTRAINT "survey_sessions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_sessions" ADD CONSTRAINT "survey_sessions_survey_id_survey_exercises_id_fk" FOREIGN KEY ("survey_id") REFERENCES "public"."survey_exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_sessions" ADD CONSTRAINT "survey_sessions_current_question_id_survey_questions_id_fk" FOREIGN KEY ("current_question_id") REFERENCES "public"."survey_questions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_prompts" ADD CONSTRAINT "task_prompts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");