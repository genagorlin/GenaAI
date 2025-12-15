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

// Role Prompts - AI personality/behavior per client (~500 tokens)
export const rolePrompts = pgTable("role_prompts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }).unique(),
  content: text("content").notNull().default("You are an empathetic thinking partner. Do not prescribe advice. Ask clarifying questions when needed."),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Task Prompts - Response instructions per client (~500 tokens)
export const taskPrompts = pgTable("task_prompts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }).unique(),
  content: text("content").notNull().default("Respond reflectively and explore meaning without telling the client what to do. If helpful, ask a clarifying question to deepen understanding."),
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
