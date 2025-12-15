import { 
  type Client, 
  type InsertClient, 
  type Thread,
  type InsertThread,
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
  type RolePrompt,
  type TaskPrompt,
  type MethodologyFrame,
  type ClientMethodology,
  type AuthorizedUser,
  type CoachMention,
  type InsertCoachMention,
  type CoachConsultation,
  type InsertCoachConsultation,
  clients,
  threads,
  messages,
  insights,
  sentimentData,
  users,
  clientDocuments,
  documentSections,
  rolePrompts,
  taskPrompts,
  methodologyFrames,
  clientMethodologies,
  authorizedUsers,
  coachMentions,
  coachConsultations
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, and, gt } from "drizzle-orm";

export interface IStorage {
  // Users (Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Clients
  getAllClients(): Promise<Client[]>;
  getClient(id: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  registerClient(data: { id: string; name: string; email: string; photoUrl?: string }): Promise<Client>;
  updateClientAuth(id: string, data: { email: string; name: string; photoUrl?: string }): Promise<void>;
  updateClientActivity(id: string, mobileAppConnected: number): Promise<void>;

  // Threads
  getClientThreads(clientId: string): Promise<Thread[]>;
  getThread(id: string): Promise<Thread | undefined>;
  createThread(thread: InsertThread): Promise<Thread>;
  updateThreadTitle(id: string, title: string): Promise<Thread>;
  updateThreadLastMessage(id: string): Promise<void>;
  getOrCreateDefaultThread(clientId: string): Promise<Thread>;

  // Messages
  getClientMessages(clientId: string): Promise<Message[]>;
  getThreadMessages(threadId: string): Promise<Message[]>;
  getMessagesSinceSummarization(clientId: string): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  
  // Session management
  updateClientLastSummarized(clientId: string): Promise<void>;

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
  getSection(id: string): Promise<DocumentSection | undefined>;
  createSection(section: InsertDocumentSection): Promise<DocumentSection>;
  updateSection(id: string, updates: Partial<DocumentSection>): Promise<DocumentSection>;
  updateSectionByAI(id: string, newContent: string): Promise<DocumentSection>;
  deleteSection(id: string): Promise<void>;
  reorderSections(documentId: string, sectionIds: string[]): Promise<void>;
  acceptSectionUpdate(id: string): Promise<DocumentSection>;
  revertSectionUpdate(id: string): Promise<DocumentSection>;

  // Prompt Layers
  getOrCreateRolePrompt(clientId: string): Promise<RolePrompt>;
  updateRolePrompt(clientId: string, content: string): Promise<RolePrompt>;
  getOrCreateTaskPrompt(clientId: string): Promise<TaskPrompt>;
  updateTaskPrompt(clientId: string, content: string): Promise<TaskPrompt>;
  getAllMethodologyFrames(): Promise<MethodologyFrame[]>;
  getActiveMethodologyFrames(): Promise<MethodologyFrame[]>;
  getClientMethodologies(clientId: string): Promise<(ClientMethodology & { methodology: MethodologyFrame })[]>;

  // Authorized Users (login allowlist)
  getAuthorizedUserByEmail(email: string): Promise<AuthorizedUser | undefined>;
  getAllAuthorizedUsers(): Promise<AuthorizedUser[]>;
  createAuthorizedUser(email: string, role: string): Promise<AuthorizedUser>;
  deleteAuthorizedUser(id: string): Promise<void>;
  updateAuthorizedUserLastLogin(email: string): Promise<void>;

  // Coach Mentions
  createCoachMention(mention: InsertCoachMention): Promise<CoachMention>;
  getUnreadMentions(): Promise<(CoachMention & { message: Message; client: Client })[]>;
  getUnreadMentionCount(): Promise<number>;
  markMentionRead(id: string): Promise<CoachMention>;
  markThreadMentionsRead(threadId: string): Promise<void>;

  // Coach Consultations (private coach-AI conversations about a client)
  getClientConsultations(clientId: string): Promise<CoachConsultation[]>;
  createConsultation(consultation: InsertCoachConsultation): Promise<CoachConsultation>;
  clearClientConsultations(clientId: string): Promise<void>;
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

  async registerClient(data: { id: string; name: string; email: string; photoUrl?: string }): Promise<Client> {
    const [client] = await db
      .insert(clients)
      .values({
        id: data.id,
        name: data.name,
        email: data.email,
        photoUrl: data.photoUrl,
        mobileAppConnected: 1,
      })
      .onConflictDoUpdate({
        target: clients.id,
        set: {
          name: data.name,
          email: data.email,
          photoUrl: data.photoUrl,
          lastActive: new Date(),
          mobileAppConnected: 1,
        },
      })
      .returning();
    return client;
  }

  async updateClientAuth(id: string, data: { email: string; name: string; photoUrl?: string }): Promise<void> {
    await db.update(clients)
      .set({ 
        email: data.email, 
        name: data.name, 
        photoUrl: data.photoUrl,
        lastActive: new Date() 
      })
      .where(eq(clients.id, id));
  }

  async updateClientActivity(id: string, mobileAppConnected: number): Promise<void> {
    await db.update(clients)
      .set({ lastActive: new Date(), mobileAppConnected })
      .where(eq(clients.id, id));
  }

  // Threads
  async getClientThreads(clientId: string): Promise<Thread[]> {
    return await db.select().from(threads)
      .where(eq(threads.clientId, clientId))
      .orderBy(desc(threads.lastMessageAt));
  }

  async getThread(id: string): Promise<Thread | undefined> {
    const [thread] = await db.select().from(threads).where(eq(threads.id, id));
    return thread;
  }

  async createThread(insertThread: InsertThread): Promise<Thread> {
    const [thread] = await db.insert(threads).values(insertThread).returning();
    return thread;
  }

  async updateThreadTitle(id: string, title: string): Promise<Thread> {
    const [thread] = await db.update(threads)
      .set({ title })
      .where(eq(threads.id, id))
      .returning();
    return thread;
  }

  async updateThreadLastMessage(id: string): Promise<void> {
    await db.update(threads)
      .set({ lastMessageAt: new Date() })
      .where(eq(threads.id, id));
  }

  async deleteThread(id: string): Promise<void> {
    await db.delete(messages).where(eq(messages.threadId, id));
    await db.delete(threads).where(eq(threads.id, id));
  }

  async getOrCreateDefaultThread(clientId: string): Promise<Thread> {
    const existingThreads = await this.getClientThreads(clientId);
    if (existingThreads.length > 0) {
      return existingThreads[0];
    }
    return await this.createThread({ clientId, title: "First conversation" });
  }

  // Messages
  async getClientMessages(clientId: string): Promise<Message[]> {
    return await db.select().from(messages)
      .where(eq(messages.clientId, clientId))
      .orderBy(messages.timestamp);
  }

  async getThreadMessages(threadId: string): Promise<Message[]> {
    return await db.select().from(messages)
      .where(eq(messages.threadId, threadId))
      .orderBy(messages.timestamp);
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const result = await db.insert(messages).values(insertMessage).returning();
    if (insertMessage.threadId) {
      await this.updateThreadLastMessage(insertMessage.threadId);
    }
    return result[0];
  }

  async getMessagesSinceSummarization(clientId: string): Promise<Message[]> {
    const client = await this.getClient(clientId);
    if (!client) return [];
    
    const query = db.select().from(messages)
      .where(eq(messages.clientId, clientId))
      .orderBy(messages.timestamp);
    
    if (client.lastSummarizedAt) {
      return await db.select().from(messages)
        .where(and(eq(messages.clientId, clientId), gt(messages.timestamp, client.lastSummarizedAt)))
        .orderBy(messages.timestamp);
    }
    
    return await query;
  }

  async updateClientLastSummarized(clientId: string): Promise<void> {
    await db.update(clients)
      .set({ lastSummarizedAt: new Date() })
      .where(eq(clients.id, clientId));
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

  async getSection(id: string): Promise<DocumentSection | undefined> {
    const [section] = await db.select().from(documentSections).where(eq(documentSections.id, id));
    return section;
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
      .set({ ...updates, updatedAt: new Date(), lastUpdatedBy: "coach", pendingReview: 0 })
      .where(eq(documentSections.id, id))
      .returning();
    if (result) {
      await db.update(clientDocuments)
        .set({ lastUpdated: new Date() })
        .where(eq(clientDocuments.id, result.documentId));
    }
    return result;
  }

  async updateSectionByAI(id: string, newContent: string): Promise<DocumentSection> {
    const [section] = await db.select().from(documentSections).where(eq(documentSections.id, id));
    if (!section) {
      throw new Error("Section not found");
    }
    const [result] = await db.update(documentSections)
      .set({ 
        previousContent: section.content,
        content: newContent,
        lastUpdatedBy: "ai",
        pendingReview: 1,
        updatedAt: new Date()
      })
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

  async acceptSectionUpdate(id: string): Promise<DocumentSection> {
    const [result] = await db.update(documentSections)
      .set({ 
        pendingReview: 0,
        previousContent: null,
        updatedAt: new Date()
      })
      .where(eq(documentSections.id, id))
      .returning();
    return result;
  }

  async revertSectionUpdate(id: string): Promise<DocumentSection> {
    const [section] = await db.select().from(documentSections).where(eq(documentSections.id, id));
    if (!section || !section.previousContent) {
      throw new Error("No previous content to revert to");
    }
    const [result] = await db.update(documentSections)
      .set({ 
        content: section.previousContent,
        previousContent: null,
        pendingReview: 0,
        lastUpdatedBy: "coach",
        updatedAt: new Date()
      })
      .where(eq(documentSections.id, id))
      .returning();
    return result;
  }

  // Prompt Layers
  async getOrCreateRolePrompt(clientId: string): Promise<RolePrompt> {
    const [existing] = await db.select().from(rolePrompts).where(eq(rolePrompts.clientId, clientId));
    if (existing) return existing;
    const [created] = await db.insert(rolePrompts).values({ clientId }).returning();
    return created;
  }

  async updateRolePrompt(clientId: string, content: string): Promise<RolePrompt> {
    const [result] = await db
      .insert(rolePrompts)
      .values({ clientId, content })
      .onConflictDoUpdate({
        target: rolePrompts.clientId,
        set: { content, updatedAt: new Date() },
      })
      .returning();
    return result;
  }

  async getOrCreateTaskPrompt(clientId: string): Promise<TaskPrompt> {
    const [existing] = await db.select().from(taskPrompts).where(eq(taskPrompts.clientId, clientId));
    if (existing) return existing;
    const [created] = await db.insert(taskPrompts).values({ clientId }).returning();
    return created;
  }

  async updateTaskPrompt(clientId: string, content: string): Promise<TaskPrompt> {
    const [result] = await db
      .insert(taskPrompts)
      .values({ clientId, content })
      .onConflictDoUpdate({
        target: taskPrompts.clientId,
        set: { content, updatedAt: new Date() },
      })
      .returning();
    return result;
  }

  async getAllMethodologyFrames(): Promise<MethodologyFrame[]> {
    return await db.select().from(methodologyFrames).orderBy(asc(methodologyFrames.sortOrder));
  }

  async getActiveMethodologyFrames(): Promise<MethodologyFrame[]> {
    return await db.select().from(methodologyFrames)
      .where(eq(methodologyFrames.isActive, 1))
      .orderBy(asc(methodologyFrames.sortOrder));
  }

  async getClientMethodologies(clientId: string): Promise<(ClientMethodology & { methodology: MethodologyFrame })[]> {
    const results = await db.select()
      .from(clientMethodologies)
      .innerJoin(methodologyFrames, eq(clientMethodologies.methodologyId, methodologyFrames.id))
      .where(eq(clientMethodologies.clientId, clientId));
    return results.map((r: { client_methodologies: ClientMethodology; methodology_frames: MethodologyFrame }) => ({ 
      ...r.client_methodologies, 
      methodology: r.methodology_frames 
    }));
  }

  // Authorized Users (login allowlist)
  async getAuthorizedUserByEmail(email: string): Promise<AuthorizedUser | undefined> {
    const [user] = await db.select().from(authorizedUsers).where(eq(authorizedUsers.email, email.toLowerCase()));
    return user;
  }

  async getAllAuthorizedUsers(): Promise<AuthorizedUser[]> {
    return await db.select().from(authorizedUsers).orderBy(desc(authorizedUsers.createdAt));
  }

  async createAuthorizedUser(email: string, role: string): Promise<AuthorizedUser> {
    const [user] = await db.insert(authorizedUsers).values({ email: email.toLowerCase(), role }).returning();
    return user;
  }

  async deleteAuthorizedUser(id: string): Promise<void> {
    await db.delete(authorizedUsers).where(eq(authorizedUsers.id, id));
  }

  async updateAuthorizedUserLastLogin(email: string): Promise<void> {
    await db.update(authorizedUsers)
      .set({ lastLogin: new Date() })
      .where(eq(authorizedUsers.email, email.toLowerCase()));
  }

  // Coach Mentions
  async createCoachMention(mention: InsertCoachMention): Promise<CoachMention> {
    const [result] = await db.insert(coachMentions).values(mention).returning();
    return result;
  }

  async getUnreadMentions(): Promise<(CoachMention & { message: Message; client: Client })[]> {
    const results = await db.select()
      .from(coachMentions)
      .innerJoin(messages, eq(coachMentions.messageId, messages.id))
      .innerJoin(clients, eq(coachMentions.clientId, clients.id))
      .where(eq(coachMentions.isRead, 0))
      .orderBy(desc(coachMentions.createdAt));
    return results.map((r: { coach_mentions: CoachMention; messages: Message; clients: Client }) => ({
      ...r.coach_mentions,
      message: r.messages,
      client: r.clients
    }));
  }

  async getUnreadMentionCount(): Promise<number> {
    const results = await db.select()
      .from(coachMentions)
      .where(eq(coachMentions.isRead, 0));
    return results.length;
  }

  async markMentionRead(id: string): Promise<CoachMention> {
    const [result] = await db.update(coachMentions)
      .set({ isRead: 1 })
      .where(eq(coachMentions.id, id))
      .returning();
    return result;
  }

  async markThreadMentionsRead(threadId: string): Promise<void> {
    await db.update(coachMentions)
      .set({ isRead: 1 })
      .where(eq(coachMentions.threadId, threadId));
  }

  // Coach Consultations
  async getClientConsultations(clientId: string): Promise<CoachConsultation[]> {
    return await db.select().from(coachConsultations)
      .where(eq(coachConsultations.clientId, clientId))
      .orderBy(asc(coachConsultations.timestamp));
  }

  async createConsultation(consultation: InsertCoachConsultation): Promise<CoachConsultation> {
    const [result] = await db.insert(coachConsultations).values(consultation).returning();
    return result;
  }

  async clearClientConsultations(clientId: string): Promise<void> {
    await db.delete(coachConsultations).where(eq(coachConsultations.clientId, clientId));
  }
}

export const storage = new DatabaseStorage();
