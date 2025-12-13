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

export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  photoUrl: text("photo_url"),
  status: text("status").notNull().default("active"),
  lastActive: timestamp("last_active").defaultNow(),
  mobileAppConnected: integer("mobile_app_connected").notNull().default(0),
});

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // "user" or "ai"
  content: text("content").notNull(),
  type: text("type").notNull().default("text"), // "text" or "audio"
  duration: text("duration"), // for audio messages
  timestamp: timestamp("timestamp").notNull().defaultNow(),
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
  sortOrder: integer("sort_order").notNull().default(0),
  isCollapsed: integer("is_collapsed").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertClientSchema = createInsertSchema(clients).omit({ id: true, lastActive: true });
export const registerClientSchema = z.object({
  clientId: z.string(),
  name: z.string(),
  email: z.string().email(),
  photoUrl: z.string().optional(),
});
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, timestamp: true });
export const insertInsightSchema = createInsertSchema(insights).omit({ id: true, timestamp: true });
export const insertSentimentDataSchema = createInsertSchema(sentimentData).omit({ id: true });
export const insertClientDocumentSchema = createInsertSchema(clientDocuments).omit({ id: true, lastUpdated: true, createdAt: true });
export const insertDocumentSectionSchema = createInsertSchema(documentSections).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

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
