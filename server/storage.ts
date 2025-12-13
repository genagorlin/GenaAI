import { 
  type Client, 
  type InsertClient, 
  type Message, 
  type InsertMessage,
  type Insight,
  type InsertInsight,
  type SentimentData,
  type InsertSentimentData,
  type User,
  type UpsertUser,
  type ClientDocument,
  type InsertClientDocument,
  type DocumentSection,
  type InsertDocumentSection,
  clients,
  messages,
  insights,
  sentimentData,
  users,
  clientDocuments,
  documentSections
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc } from "drizzle-orm";

export interface IStorage {
  // Users (Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Clients
  getAllClients(): Promise<Client[]>;
  getClient(id: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClientActivity(id: string, mobileAppConnected: number): Promise<void>;

  // Messages
  getClientMessages(clientId: string): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;

  // Insights
  getClientInsights(clientId: string): Promise<Insight[]>;
  createInsight(insight: InsertInsight): Promise<Insight>;

  // Sentiment Data
  getClientSentimentData(clientId: string): Promise<SentimentData[]>;
  createSentimentData(data: InsertSentimentData): Promise<SentimentData>;

  // Living Documents
  getClientDocument(clientId: string): Promise<ClientDocument | undefined>;
  getOrCreateClientDocument(clientId: string): Promise<ClientDocument>;
  getDocumentSections(documentId: string): Promise<DocumentSection[]>;
  createSection(section: InsertDocumentSection): Promise<DocumentSection>;
  updateSection(id: string, updates: Partial<DocumentSection>): Promise<DocumentSection>;
  deleteSection(id: string): Promise<void>;
  reorderSections(documentId: string, sectionIds: string[]): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Users (Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Clients
  async getAllClients(): Promise<Client[]> {
    return await db.select().from(clients).orderBy(desc(clients.lastActive));
  }

  async getClient(id: string): Promise<Client | undefined> {
    const result = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
    return result[0];
  }

  async createClient(insertClient: InsertClient): Promise<Client> {
    const result = await db.insert(clients).values(insertClient).returning();
    return result[0];
  }

  async updateClientActivity(id: string, mobileAppConnected: number): Promise<void> {
    await db.update(clients)
      .set({ lastActive: new Date(), mobileAppConnected })
      .where(eq(clients.id, id));
  }

  // Messages
  async getClientMessages(clientId: string): Promise<Message[]> {
    return await db.select().from(messages)
      .where(eq(messages.clientId, clientId))
      .orderBy(messages.timestamp);
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const result = await db.insert(messages).values(insertMessage).returning();
    return result[0];
  }

  // Insights
  async getClientInsights(clientId: string): Promise<Insight[]> {
    return await db.select().from(insights)
      .where(eq(insights.clientId, clientId))
      .orderBy(desc(insights.timestamp));
  }

  async createInsight(insertInsight: InsertInsight): Promise<Insight> {
    const result = await db.insert(insights).values(insertInsight).returning();
    return result[0];
  }

  // Sentiment Data
  async getClientSentimentData(clientId: string): Promise<SentimentData[]> {
    return await db.select().from(sentimentData)
      .where(eq(sentimentData.clientId, clientId));
  }

  async createSentimentData(data: InsertSentimentData): Promise<SentimentData> {
    const result = await db.insert(sentimentData).values(data).returning();
    return result[0];
  }

  // Living Documents
  async getClientDocument(clientId: string): Promise<ClientDocument | undefined> {
    const [doc] = await db.select().from(clientDocuments).where(eq(clientDocuments.clientId, clientId));
    return doc;
  }

  async getOrCreateClientDocument(clientId: string): Promise<ClientDocument> {
    let doc = await this.getClientDocument(clientId);
    if (!doc) {
      const [newDoc] = await db.insert(clientDocuments).values({ clientId }).returning();
      doc = newDoc;
      // Create default sections for new documents
      const defaultSections = [
        { documentId: doc.id, sectionType: "summary", title: "Overview", content: "", sortOrder: 0 },
        { documentId: doc.id, sectionType: "highlight", title: "Key Highlights", content: "", sortOrder: 1 },
        { documentId: doc.id, sectionType: "focus", title: "Current Focus Areas", content: "", sortOrder: 2 },
        { documentId: doc.id, sectionType: "context", title: "Background & Context", content: "", sortOrder: 3 },
      ];
      await db.insert(documentSections).values(defaultSections);
    }
    return doc;
  }

  async getDocumentSections(documentId: string): Promise<DocumentSection[]> {
    return await db.select().from(documentSections)
      .where(eq(documentSections.documentId, documentId))
      .orderBy(asc(documentSections.sortOrder));
  }

  async createSection(section: InsertDocumentSection): Promise<DocumentSection> {
    const [result] = await db.insert(documentSections).values(section).returning();
    await db.update(clientDocuments)
      .set({ lastUpdated: new Date() })
      .where(eq(clientDocuments.id, section.documentId));
    return result;
  }

  async updateSection(id: string, updates: Partial<DocumentSection>): Promise<DocumentSection> {
    const [result] = await db.update(documentSections)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(documentSections.id, id))
      .returning();
    if (result) {
      await db.update(clientDocuments)
        .set({ lastUpdated: new Date() })
        .where(eq(clientDocuments.id, result.documentId));
    }
    return result;
  }

  async deleteSection(id: string): Promise<void> {
    const [section] = await db.select().from(documentSections).where(eq(documentSections.id, id));
    if (section) {
      await db.delete(documentSections).where(eq(documentSections.id, id));
      await db.update(clientDocuments)
        .set({ lastUpdated: new Date() })
        .where(eq(clientDocuments.id, section.documentId));
    }
  }

  async reorderSections(documentId: string, sectionIds: string[]): Promise<void> {
    for (let i = 0; i < sectionIds.length; i++) {
      await db.update(documentSections)
        .set({ sortOrder: i })
        .where(eq(documentSections.id, sectionIds[i]));
    }
    await db.update(clientDocuments)
      .set({ lastUpdated: new Date() })
      .where(eq(clientDocuments.id, documentId));
  }
}

export const storage = new DatabaseStorage();
