import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
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

export const insertClientSchema = createInsertSchema(clients).omit({ id: true, lastActive: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, timestamp: true });
export const insertInsightSchema = createInsertSchema(insights).omit({ id: true, timestamp: true });
export const insertSentimentDataSchema = createInsertSchema(sentimentData).omit({ id: true });

export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

export type InsertInsight = z.infer<typeof insertInsightSchema>;
export type Insight = typeof insights.$inferSelect;

export type InsertSentimentData = z.infer<typeof insertSentimentDataSchema>;
export type SentimentData = typeof sentimentData.$inferSelect;
