import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, index, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for Replit Auth (coaches)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Authorized users allowlist for login restriction
export const authorizedUsers = pgTable("authorized_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  role: text("role").notNull().default("user"), // "admin" or "user"
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAuthorizedUserSchema = createInsertSchema(authorizedUsers).omit({ id: true, lastLogin: true, createdAt: true });
export type InsertAuthorizedUser = z.infer<typeof insertAuthorizedUserSchema>;
export type AuthorizedUser = typeof authorizedUsers.$inferSelect;

export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  photoUrl: text("photo_url"),
  status: text("status").notNull().default("active"),
  lastActive: timestamp("last_active").defaultNow(),
  mobileAppConnected: integer("mobile_app_connected").notNull().default(0),
  lastSummarizedAt: timestamp("last_summarized_at"),
});

// Conversation threads - each client can have multiple threads
export const threads = pgTable("threads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  title: text("title").notNull().default("New conversation"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastMessageAt: timestamp("last_message_at").notNull().defaultNow(),
});

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  threadId: varchar("thread_id").references(() => threads.id, { onDelete: "cascade" }),
  exerciseStepId: varchar("exercise_step_id"), // Links message to specific exercise step (for step-grouped display)
  role: text("role").notNull(), // "user", "ai", or "coach"
  content: text("content").notNull(),
  type: text("type").notNull().default("text"), // "text" or "audio"
  duration: text("duration"), // for audio messages
  mentionsCoach: integer("mentions_coach").notNull().default(0), // 1 if message contains @gena or @coach
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

// Coach mentions - tracks when coach is tagged in conversations
export const coachMentions = pgTable("coach_mentions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: varchar("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  threadId: varchar("thread_id").references(() => threads.id, { onDelete: "cascade" }),
  isRead: integer("is_read").notNull().default(0), // 0 = unread, 1 = read
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insights = pgTable("insights", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  category: text("category").notNull(), // "Emotional Spike", "Recurring Theme", "Shift", "Contradiction"
  title: text("title").notNull(),
  description: text("description").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const sentimentData = pgTable("sentiment_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  date: text("date").notNull(), // e.g., "Mon", "Tue"
  sentimentScore: integer("sentiment_score").notNull(), // 0-100
  intensityScore: integer("intensity_score").notNull(), // 0-100
});

// Living Document - the evolving summary of everything known about a client
export const clientDocuments = pgTable("client_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }).unique(),
  title: text("title").notNull().default("Client Profile"),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Sections within a living document (coach can add/reorder)
export const documentSections = pgTable("document_sections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").notNull().references(() => clientDocuments.id, { onDelete: "cascade" }),
  sectionType: text("section_type").notNull().default("custom"), // "highlight", "focus", "context", "summary", "custom"
  title: text("title").notNull(),
  content: text("content").notNull().default(""), // Rich text content
  previousContent: text("previous_content"), // Content before last AI update (for revert)
  lastUpdatedBy: text("last_updated_by").default("coach"), // "ai" or "coach" - tracks who made the last edit
  pendingReview: integer("pending_review").notNull().default(0), // 1 if AI update needs coach review
  coachNotes: text("coach_notes").default(""), // Private notes visible only to coach
  sortOrder: integer("sort_order").notNull().default(0),
  isCollapsed: integer("is_collapsed").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Coach Consultations - private coach-AI conversations about a client
export const coachConsultations = pgTable("coach_consultations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // "coach" or "ai"
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

// Role Prompts - AI personality/behavior per client (~500 tokens)
export const rolePrompts = pgTable("role_prompts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }).unique(),
  content: text("content").notNull().default(`You are an assistant to Dr. Gena Gorlin, who provides coaching to ambitious founders and builders. You are familiar with Gena's online writing on the "psychology of ambition," including her "builder's mindset" framework. You do not prescribe advice. You ask clarifying questions when needed.`),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Task Prompts - Response instructions per client (~500 tokens)
export const taskPrompts = pgTable("task_prompts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }).unique(),
  content: text("content").notNull().default(`Open each new conversation with the client exactly as follows: "Hi [client name], welcome to your AI-assisted coaching log. By default, I'll mostly listen and hang back to give you space to self-reflect. Let me know if you'd like me to assist you in any other way, such as by helping you identify and interrogate what you're feeling, or work through a difficult decision in a manner that aligns with your goals and values, or track down relevant insights from Gena's writing on the "builder's mindset" or your prior coaching sessions. You can also call Gena into this chat directly by typing "@coach" at any point.

Now, what would you like to log or reflect on today?"

By default, you serve mainly as a "scribe" who listens quietly and records the client's journaling: you may occasionally provide brief, tentative reflections of what the client is sharing as and when it feels natural, but you mostly hang back and give brief responses like "go on, I'm listening" unless the client specifically requests something different. If and only if the client specifically requests it, you can: 1) offer reminders of what has been discussed in the client's coaching sessions with Gena so far (based on the living document); 2) answer the client's questions to the best of your ability, offering quotes or close paraphrases from Gena's writing on the builder's mindset and the psychology of ambition where applicable; 3) ask clarifying questions to better understand the client's question or request; 4) help the client identify and process feelings, reality-check a perspective, or think through a decision in a values-based manner. Whenever there's an open question or issue raised that might be helpful for the client to discuss with Gena in their next coaching session, add this to the "Open questions to discuss with Gena" section of the profile document.`),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Methodology Frames - Coaching frameworks (one-to-many for future expansion, ~2000 tokens)
export const methodologyFrames = pgTable("methodology_frames", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  content: text("content").notNull(), // The actual methodology prompt text
  isActive: integer("is_active").notNull().default(1),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Junction table to assign methodologies to clients
export const clientMethodologies = pgTable("client_methodologies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  methodologyId: varchar("methodology_id").notNull().references(() => methodologyFrames.id, { onDelete: "cascade" }),
  isActive: integer("is_active").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertClientSchema = createInsertSchema(clients).omit({ id: true, lastActive: true });
export const registerClientSchema = z.object({
  clientId: z.string(),
  name: z.string(),
  email: z.string().email(),
  photoUrl: z.string().optional(),
});
export const insertThreadSchema = createInsertSchema(threads).omit({ id: true, createdAt: true, lastMessageAt: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, timestamp: true });
export const insertInsightSchema = createInsertSchema(insights).omit({ id: true, timestamp: true });
export const insertSentimentDataSchema = createInsertSchema(sentimentData).omit({ id: true });
export const insertClientDocumentSchema = createInsertSchema(clientDocuments).omit({ id: true, lastUpdated: true, createdAt: true });
export const insertDocumentSectionSchema = createInsertSchema(documentSections).omit({ id: true, createdAt: true, updatedAt: true });
export const insertRolePromptSchema = createInsertSchema(rolePrompts).omit({ id: true, updatedAt: true });
export const insertTaskPromptSchema = createInsertSchema(taskPrompts).omit({ id: true, updatedAt: true });
export const insertMethodologyFrameSchema = createInsertSchema(methodologyFrames).omit({ id: true, createdAt: true, updatedAt: true });
export const insertClientMethodologySchema = createInsertSchema(clientMethodologies).omit({ id: true, createdAt: true });
export const insertCoachMentionSchema = createInsertSchema(coachMentions).omit({ id: true, createdAt: true });
export const insertCoachConsultationSchema = createInsertSchema(coachConsultations).omit({ id: true, timestamp: true });

// Reference Documents - coach's writings that the AI can reference when talking to clients
export const referenceDocuments = pgTable("reference_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  content: text("content").notNull(),
  description: text("description"), // Optional short description/summary
  tags: text("tags").array(), // Optional tags for categorization
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertReferenceDocumentSchema = createInsertSchema(referenceDocuments).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertReferenceDocument = z.infer<typeof insertReferenceDocumentSchema>;
export type ReferenceDocument = typeof referenceDocuments.$inferSelect;

export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

export type InsertThread = z.infer<typeof insertThreadSchema>;
export type Thread = typeof threads.$inferSelect;

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

export type InsertInsight = z.infer<typeof insertInsightSchema>;
export type Insight = typeof insights.$inferSelect;

export type InsertSentimentData = z.infer<typeof insertSentimentDataSchema>;
export type SentimentData = typeof sentimentData.$inferSelect;

export type InsertClientDocument = z.infer<typeof insertClientDocumentSchema>;
export type ClientDocument = typeof clientDocuments.$inferSelect;

export type InsertDocumentSection = z.infer<typeof insertDocumentSectionSchema>;
export type DocumentSection = typeof documentSections.$inferSelect;

export type InsertRolePrompt = z.infer<typeof insertRolePromptSchema>;
export type RolePrompt = typeof rolePrompts.$inferSelect;

export type InsertTaskPrompt = z.infer<typeof insertTaskPromptSchema>;
export type TaskPrompt = typeof taskPrompts.$inferSelect;

export type InsertMethodologyFrame = z.infer<typeof insertMethodologyFrameSchema>;
export type MethodologyFrame = typeof methodologyFrames.$inferSelect;

export type InsertClientMethodology = z.infer<typeof insertClientMethodologySchema>;
export type ClientMethodology = typeof clientMethodologies.$inferSelect;

export type InsertCoachMention = z.infer<typeof insertCoachMentionSchema>;
export type CoachMention = typeof coachMentions.$inferSelect;

export type InsertCoachConsultation = z.infer<typeof insertCoachConsultationSchema>;
export type CoachConsultation = typeof coachConsultations.$inferSelect;

// Guided Exercises - structured coaching exercises that clients can work through
export const guidedExercises = pgTable("guided_exercises", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull(), // What clients see when choosing
  category: text("category"), // e.g., "Values", "Emotions", "Beliefs", "Goals", "Habits"
  estimatedMinutes: integer("estimated_minutes"), // Approximate time to complete
  systemPrompt: text("system_prompt").notNull().default(""), // Overall instructions for AI during this exercise
  isPublished: integer("is_published").notNull().default(0), // 0 = draft, 1 = visible to clients
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Exercise Steps - ordered steps within an exercise (supports branching)
export const exerciseSteps = pgTable("exercise_steps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  exerciseId: varchar("exercise_id").notNull().references(() => guidedExercises.id, { onDelete: "cascade" }),
  title: text("title").notNull(), // e.g., "Step 1: Surface your values"
  instructions: text("instructions").notNull(), // AI instructions for this step
  completionCriteria: text("completion_criteria"), // Hints for AI on when to advance
  supportingMaterial: text("supporting_material"), // Optional reference content for this step
  stepOrder: integer("step_order").notNull().default(0),
  nextStepId: varchar("next_step_id"), // Default next step (null = end of exercise)
  branchingRules: jsonb("branching_rules"), // Optional: { conditions: [{ if: "...", thenStepId: "..." }] }
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Client Exercise Sessions - tracks when a client starts/completes an exercise
export const clientExerciseSessions = pgTable("client_exercise_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  exerciseId: varchar("exercise_id").notNull().references(() => guidedExercises.id, { onDelete: "cascade" }),
  threadId: varchar("thread_id").references(() => threads.id, { onDelete: "cascade" }),
  currentStepId: varchar("current_step_id").references(() => exerciseSteps.id, { onDelete: "set null" }),
  status: text("status").notNull().default("in_progress"), // "in_progress", "completed", "abandoned"
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  summary: text("summary"), // AI-generated summary upon completion
});

export const insertGuidedExerciseSchema = createInsertSchema(guidedExercises).omit({ id: true, createdAt: true, updatedAt: true });
export const insertExerciseStepSchema = createInsertSchema(exerciseSteps).omit({ id: true, createdAt: true, updatedAt: true });
export const insertClientExerciseSessionSchema = createInsertSchema(clientExerciseSessions).omit({ id: true, startedAt: true, completedAt: true });

// Exercise Step Responses - stores client answers and AI feedback for each step
export const exerciseStepResponses = pgTable("exercise_step_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => clientExerciseSessions.id, { onDelete: "cascade" }),
  stepId: varchar("step_id").notNull().references(() => exerciseSteps.id, { onDelete: "cascade" }),
  clientAnswer: text("client_answer").notNull().default(""), // The client's fill-in-the-blank response
  aiFeedback: text("ai_feedback"), // AI's review/feedback (null if no feedback needed)
  needsRevision: integer("needs_revision").notNull().default(0), // 1 if AI flagged the answer for revision
  submittedAt: timestamp("submitted_at"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertExerciseStepResponseSchema = createInsertSchema(exerciseStepResponses).omit({ id: true, updatedAt: true });

export type InsertGuidedExercise = z.infer<typeof insertGuidedExerciseSchema>;
export type GuidedExercise = typeof guidedExercises.$inferSelect;

export type InsertExerciseStep = z.infer<typeof insertExerciseStepSchema>;
export type ExerciseStep = typeof exerciseSteps.$inferSelect;

export type InsertClientExerciseSession = z.infer<typeof insertClientExerciseSessionSchema>;
export type ClientExerciseSession = typeof clientExerciseSessions.$inferSelect;

export type InsertExerciseStepResponse = z.infer<typeof insertExerciseStepResponseSchema>;
export type ExerciseStepResponse = typeof exerciseStepResponses.$inferSelect;

// File Attachments - uploaded files linked to exercises or reference documents
export const fileAttachments = pgTable("file_attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  objectPath: text("object_path").notNull(),
  extractedText: text("extracted_text"),
  exerciseId: varchar("exercise_id").references(() => guidedExercises.id, { onDelete: "cascade" }),
  referenceDocumentId: varchar("reference_document_id").references(() => referenceDocuments.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFileAttachmentSchema = createInsertSchema(fileAttachments).omit({ id: true, createdAt: true });
export type InsertFileAttachment = z.infer<typeof insertFileAttachmentSchema>;
export type FileAttachment = typeof fileAttachments.$inferSelect;
