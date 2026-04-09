CREATE TABLE IF NOT EXISTS "journal_entries" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" varchar NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
  "title" text DEFAULT 'Untitled' NOT NULL,
  "content" text DEFAULT '' NOT NULL,
  "ai_guidance" jsonb,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
