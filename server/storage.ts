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
  type ReferenceDocument,
  type InsertReferenceDocument,
  type GuidedExercise,
  type InsertGuidedExercise,
  type ExerciseStep,
  type InsertExerciseStep,
  type ClientExerciseSession,
  type InsertClientExerciseSession,
  type ExerciseStepResponse,
  type InsertExerciseStepResponse,
  type FileAttachment,
  type InsertFileAttachment,
  type SurveyExercise,
  type InsertSurveyExercise,
  type SurveyQuestion,
  type InsertSurveyQuestion,
  type SurveySession,
  type InsertSurveySession,
  type SurveyResponse,
  type InsertSurveyResponse,
  type ReminderTemplate,
  type InsertReminderTemplate,
  type ClientReminder,
  type InsertClientReminder,
  type ReminderHistory,
  type InsertReminderHistory,
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
  coachConsultations,
  referenceDocuments,
  guidedExercises,
  exerciseSteps,
  clientExerciseSessions,
  exerciseStepResponses,
  fileAttachments,
  surveyExercises,
  surveyQuestions,
  surveySessions,
  surveyResponses,
  reminderTemplates,
  clientReminders,
  reminderHistory
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, and, gt, lte, sql } from "drizzle-orm";

export interface IStorage {
  // Users (Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Clients
  getAllClients(): Promise<Client[]>;
  getClient(id: string): Promise<Client | undefined>;
  getClientByEmail(email: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  registerClient(data: { id: string; name: string; email: string; photoUrl?: string }): Promise<Client>;
  updateClientAuth(id: string, data: { email: string; name: string; photoUrl?: string }): Promise<void>;
  updateClientActivity(id: string, mobileAppConnected: number): Promise<void>;
  updateClientLastActive(id: string): Promise<void>;
  deleteClient(id: string): Promise<void>;
  deleteClientWithRelatedData(id: string): Promise<void>;

  // Threads
  getClientThreads(clientId: string): Promise<Thread[]>;
  getThread(id: string): Promise<Thread | undefined>;
  createThread(thread: InsertThread): Promise<Thread>;
  updateThreadTitle(id: string, title: string): Promise<Thread>;
  updateThreadLastMessage(id: string): Promise<void>;
  getOrCreateDefaultThread(clientId: string): Promise<Thread>;
  deleteThread(id: string): Promise<void>;

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

  // Reference Documents (coach's writings for AI to reference)
  getAllReferenceDocuments(): Promise<ReferenceDocument[]>;
  getReferenceDocument(id: string): Promise<ReferenceDocument | undefined>;
  createReferenceDocument(doc: InsertReferenceDocument): Promise<ReferenceDocument>;
  updateReferenceDocument(id: string, updates: Partial<InsertReferenceDocument>): Promise<ReferenceDocument>;
  deleteReferenceDocument(id: string): Promise<void>;

  // Guided Exercises
  getAllGuidedExercises(): Promise<GuidedExercise[]>;
  getPublishedExercises(): Promise<GuidedExercise[]>;
  getGuidedExercise(id: string): Promise<GuidedExercise | undefined>;
  createGuidedExercise(exercise: InsertGuidedExercise): Promise<GuidedExercise>;
  updateGuidedExercise(id: string, updates: Partial<InsertGuidedExercise>): Promise<GuidedExercise>;
  deleteGuidedExercise(id: string): Promise<void>;

  // Exercise Steps
  getExerciseSteps(exerciseId: string): Promise<ExerciseStep[]>;
  getExerciseStep(id: string): Promise<ExerciseStep | undefined>;
  createExerciseStep(step: InsertExerciseStep): Promise<ExerciseStep>;
  updateExerciseStep(id: string, updates: Partial<InsertExerciseStep>): Promise<ExerciseStep>;
  deleteExerciseStep(id: string): Promise<void>;
  reorderExerciseSteps(exerciseId: string, stepIds: string[]): Promise<void>;

  // Client Exercise Sessions
  getClientExerciseSessions(clientId: string): Promise<ClientExerciseSession[]>;
  getActiveExerciseSession(clientId: string, threadId: string): Promise<ClientExerciseSession | undefined>;
  getExerciseSession(id: string): Promise<ClientExerciseSession | undefined>;
  createExerciseSession(session: InsertClientExerciseSession): Promise<ClientExerciseSession>;
  updateExerciseSession(id: string, updates: Partial<ClientExerciseSession>): Promise<ClientExerciseSession>;

  // Exercise Step Responses
  getSessionStepResponses(sessionId: string): Promise<ExerciseStepResponse[]>;
  getStepResponse(sessionId: string, stepId: string): Promise<ExerciseStepResponse | undefined>;
  upsertStepResponse(data: InsertExerciseStepResponse): Promise<ExerciseStepResponse>;
  updateStepResponseGuidance(id: string, guidance: any[]): Promise<ExerciseStepResponse>;

  // File Attachments
  getFileAttachment(id: string): Promise<FileAttachment | undefined>;
  getExerciseAttachments(exerciseId: string): Promise<FileAttachment[]>;
  getReferenceDocumentAttachments(referenceDocumentId: string): Promise<FileAttachment[]>;
  createFileAttachment(attachment: InsertFileAttachment): Promise<FileAttachment>;
  updateFileAttachment(id: string, updates: Partial<InsertFileAttachment>): Promise<FileAttachment>;
  deleteFileAttachment(id: string): Promise<void>;

  // Survey Exercises
  getAllSurveyExercises(): Promise<SurveyExercise[]>;
  getPublishedSurveyExercises(): Promise<SurveyExercise[]>;
  getSurveyExercise(id: string): Promise<SurveyExercise | undefined>;
  createSurveyExercise(exercise: InsertSurveyExercise): Promise<SurveyExercise>;
  updateSurveyExercise(id: string, updates: Partial<InsertSurveyExercise>): Promise<SurveyExercise>;
  deleteSurveyExercise(id: string): Promise<void>;

  // Survey Questions
  getSurveyQuestions(surveyId: string): Promise<SurveyQuestion[]>;
  getSurveyQuestion(id: string): Promise<SurveyQuestion | undefined>;
  createSurveyQuestion(question: InsertSurveyQuestion): Promise<SurveyQuestion>;
  updateSurveyQuestion(id: string, updates: Partial<InsertSurveyQuestion>): Promise<SurveyQuestion>;
  deleteSurveyQuestion(id: string): Promise<void>;
  reorderSurveyQuestions(surveyId: string, questionIds: string[]): Promise<void>;

  // Survey Sessions
  getClientSurveySessions(clientId: string): Promise<SurveySession[]>;
  getActiveSurveySession(clientId: string, surveyId: string): Promise<SurveySession | undefined>;
  getSurveySession(id: string): Promise<SurveySession | undefined>;
  createSurveySession(session: InsertSurveySession): Promise<SurveySession>;
  updateSurveySession(id: string, updates: Partial<SurveySession>): Promise<SurveySession>;

  // Survey Responses
  getSessionResponses(sessionId: string): Promise<SurveyResponse[]>;
  getSurveyResponse(sessionId: string, questionId: string): Promise<SurveyResponse | undefined>;
  createSurveyResponse(response: InsertSurveyResponse): Promise<SurveyResponse>;
  updateSurveyResponse(id: string, updates: Partial<InsertSurveyResponse>): Promise<SurveyResponse>;

  // Reminder Templates
  getAllReminderTemplates(): Promise<ReminderTemplate[]>;
  getActiveReminderTemplates(): Promise<ReminderTemplate[]>;
  getReminderTemplate(id: string): Promise<ReminderTemplate | undefined>;
  createReminderTemplate(template: InsertReminderTemplate): Promise<ReminderTemplate>;
  updateReminderTemplate(id: string, updates: Partial<InsertReminderTemplate>): Promise<ReminderTemplate>;
  deleteReminderTemplate(id: string): Promise<void>;

  // Client Reminders
  getClientReminders(clientId: string): Promise<(ClientReminder & { template: ReminderTemplate })[]>;
  getClientReminder(id: string): Promise<ClientReminder | undefined>;
  createClientReminder(reminder: InsertClientReminder): Promise<ClientReminder>;
  updateClientReminder(id: string, updates: Partial<ClientReminder>): Promise<ClientReminder>;
  deleteClientReminder(id: string): Promise<void>;
  getDueReminders(): Promise<(ClientReminder & { template: ReminderTemplate; client: Client })[]>;
  getClientsWithTemplate(templateId: string): Promise<(ClientReminder & { client: Client })[]>;

  // Reminder History
  createReminderHistory(history: InsertReminderHistory): Promise<ReminderHistory>;
  getClientReminderHistory(clientId: string): Promise<ReminderHistory[]>;
  getReminderHistory(clientReminderId: string): Promise<ReminderHistory[]>;

  // Client Timezone
  updateClientTimezone(clientId: string, timezone: string): Promise<void>;
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

  async getClientByEmail(email: string): Promise<Client | undefined> {
    // Case-insensitive email lookup
    const result = await db.select().from(clients).where(sql`lower(${clients.email}) = ${email.toLowerCase()}`).limit(1);
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

  async updateClientLastActive(id: string): Promise<void> {
    await db.update(clients)
      .set({ lastActive: new Date() })
      .where(eq(clients.id, id));
  }

  async deleteClient(id: string): Promise<void> {
    await db.delete(clients).where(eq(clients.id, id));
  }

  async deleteClientWithRelatedData(id: string): Promise<void> {
    // All related tables have ON DELETE CASCADE set in the schema,
    // so deleting the client will automatically clean up:
    // threads, messages, insights, sentimentData, livingDocuments,
    // documentSections, rolePrompts, taskPrompts, coachMentions, clientExerciseSessions
    await db.delete(clients).where(eq(clients.id, id));
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

  async getOrCreateDefaultThread(clientId: string): Promise<Thread> {
    const existingThreads = await this.getClientThreads(clientId);
    if (existingThreads.length > 0) {
      return existingThreads[0];
    }
    return await this.createThread({ clientId, title: "First conversation" });
  }

  async deleteThread(id: string): Promise<void> {
    // Delete related messages first
    await db.delete(messages).where(eq(messages.threadId, id));
    // Delete any related exercise sessions
    await db.delete(clientExerciseSessions).where(eq(clientExerciseSessions.threadId, id));
    // Delete the thread
    await db.delete(threads).where(eq(threads.id, id));
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
        { documentId: doc.id, sectionType: "values", title: "Values / Goals / Life Vision", content: "", sortOrder: 4 },
        { documentId: doc.id, sectionType: "beliefs", title: "Target Core Beliefs", content: "", sortOrder: 5 },
        { documentId: doc.id, sectionType: "corrective", title: "Corrective Experiences Needed", content: "", sortOrder: 6 },
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
    // Case-insensitive email lookup
    const [user] = await db.select().from(authorizedUsers).where(sql`lower(${authorizedUsers.email}) = ${email.toLowerCase()}`);
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
      .where(sql`lower(${authorizedUsers.email}) = ${email.toLowerCase()}`);
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

  // Reference Documents
  async getAllReferenceDocuments(): Promise<ReferenceDocument[]> {
    return await db.select().from(referenceDocuments).orderBy(desc(referenceDocuments.createdAt));
  }

  async getReferenceDocument(id: string): Promise<ReferenceDocument | undefined> {
    const [result] = await db.select().from(referenceDocuments).where(eq(referenceDocuments.id, id));
    return result;
  }

  async createReferenceDocument(doc: InsertReferenceDocument): Promise<ReferenceDocument> {
    const [result] = await db.insert(referenceDocuments).values(doc).returning();
    return result;
  }

  async updateReferenceDocument(id: string, updates: Partial<InsertReferenceDocument>): Promise<ReferenceDocument> {
    const [result] = await db.update(referenceDocuments)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(referenceDocuments.id, id))
      .returning();
    return result;
  }

  async deleteReferenceDocument(id: string): Promise<void> {
    await db.delete(referenceDocuments).where(eq(referenceDocuments.id, id));
  }

  // Guided Exercises
  async getAllGuidedExercises(): Promise<GuidedExercise[]> {
    return await db.select().from(guidedExercises).orderBy(asc(guidedExercises.sortOrder));
  }

  async getPublishedExercises(): Promise<GuidedExercise[]> {
    return await db.select().from(guidedExercises)
      .where(eq(guidedExercises.isPublished, 1))
      .orderBy(asc(guidedExercises.sortOrder));
  }

  async getGuidedExercise(id: string): Promise<GuidedExercise | undefined> {
    const [result] = await db.select().from(guidedExercises).where(eq(guidedExercises.id, id));
    return result;
  }

  async createGuidedExercise(exercise: InsertGuidedExercise): Promise<GuidedExercise> {
    const [result] = await db.insert(guidedExercises).values(exercise).returning();
    return result;
  }

  async updateGuidedExercise(id: string, updates: Partial<InsertGuidedExercise>): Promise<GuidedExercise> {
    const [result] = await db.update(guidedExercises)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(guidedExercises.id, id))
      .returning();
    return result;
  }

  async deleteGuidedExercise(id: string): Promise<void> {
    await db.delete(guidedExercises).where(eq(guidedExercises.id, id));
  }

  // Exercise Steps
  async getExerciseSteps(exerciseId: string): Promise<ExerciseStep[]> {
    return await db.select().from(exerciseSteps)
      .where(eq(exerciseSteps.exerciseId, exerciseId))
      .orderBy(asc(exerciseSteps.stepOrder));
  }

  async getExerciseStep(id: string): Promise<ExerciseStep | undefined> {
    const [result] = await db.select().from(exerciseSteps).where(eq(exerciseSteps.id, id));
    return result;
  }

  async createExerciseStep(step: InsertExerciseStep): Promise<ExerciseStep> {
    const [result] = await db.insert(exerciseSteps).values(step).returning();
    return result;
  }

  async updateExerciseStep(id: string, updates: Partial<InsertExerciseStep>): Promise<ExerciseStep> {
    const [result] = await db.update(exerciseSteps)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(exerciseSteps.id, id))
      .returning();
    return result;
  }

  async deleteExerciseStep(id: string): Promise<void> {
    await db.delete(exerciseSteps).where(eq(exerciseSteps.id, id));
  }

  async reorderExerciseSteps(exerciseId: string, stepIds: string[]): Promise<void> {
    for (let i = 0; i < stepIds.length; i++) {
      await db.update(exerciseSteps)
        .set({ stepOrder: i })
        .where(and(eq(exerciseSteps.id, stepIds[i]), eq(exerciseSteps.exerciseId, exerciseId)));
    }
  }

  // Client Exercise Sessions
  async getClientExerciseSessions(clientId: string): Promise<ClientExerciseSession[]> {
    return await db.select().from(clientExerciseSessions)
      .where(eq(clientExerciseSessions.clientId, clientId))
      .orderBy(desc(clientExerciseSessions.startedAt));
  }

  async getActiveExerciseSession(clientId: string, threadId: string): Promise<ClientExerciseSession | undefined> {
    const [result] = await db.select().from(clientExerciseSessions)
      .where(and(
        eq(clientExerciseSessions.clientId, clientId),
        eq(clientExerciseSessions.threadId, threadId),
        eq(clientExerciseSessions.status, "in_progress")
      ));
    return result;
  }

  async getExerciseSession(id: string): Promise<ClientExerciseSession | undefined> {
    const [result] = await db.select().from(clientExerciseSessions).where(eq(clientExerciseSessions.id, id));
    return result;
  }

  async createExerciseSession(session: InsertClientExerciseSession): Promise<ClientExerciseSession> {
    const [result] = await db.insert(clientExerciseSessions).values(session).returning();
    return result;
  }

  async updateExerciseSession(id: string, updates: Partial<ClientExerciseSession>): Promise<ClientExerciseSession> {
    const [result] = await db.update(clientExerciseSessions)
      .set(updates)
      .where(eq(clientExerciseSessions.id, id))
      .returning();
    return result;
  }

  // Exercise Step Responses
  async getSessionStepResponses(sessionId: string): Promise<ExerciseStepResponse[]> {
    return await db.select().from(exerciseStepResponses)
      .where(eq(exerciseStepResponses.sessionId, sessionId))
      .orderBy(asc(exerciseStepResponses.createdAt));
  }

  async getStepResponse(sessionId: string, stepId: string): Promise<ExerciseStepResponse | undefined> {
    const [result] = await db.select().from(exerciseStepResponses)
      .where(and(
        eq(exerciseStepResponses.sessionId, sessionId),
        eq(exerciseStepResponses.stepId, stepId)
      ));
    return result;
  }

  async upsertStepResponse(data: InsertExerciseStepResponse): Promise<ExerciseStepResponse> {
    // Try to find existing response
    const existing = await this.getStepResponse(data.sessionId, data.stepId);
    if (existing) {
      const [result] = await db.update(exerciseStepResponses)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(exerciseStepResponses.id, existing.id))
        .returning();
      return result;
    }
    const [result] = await db.insert(exerciseStepResponses).values(data).returning();
    return result;
  }

  async updateStepResponseGuidance(id: string, guidance: any[]): Promise<ExerciseStepResponse> {
    const [result] = await db.update(exerciseStepResponses)
      .set({ aiGuidance: guidance, updatedAt: new Date() })
      .where(eq(exerciseStepResponses.id, id))
      .returning();
    return result;
  }

  // File Attachments
  async getFileAttachment(id: string): Promise<FileAttachment | undefined> {
    const [result] = await db.select().from(fileAttachments).where(eq(fileAttachments.id, id));
    return result;
  }

  async getExerciseAttachments(exerciseId: string): Promise<FileAttachment[]> {
    return await db.select().from(fileAttachments)
      .where(eq(fileAttachments.exerciseId, exerciseId))
      .orderBy(desc(fileAttachments.createdAt));
  }

  async getReferenceDocumentAttachments(referenceDocumentId: string): Promise<FileAttachment[]> {
    return await db.select().from(fileAttachments)
      .where(eq(fileAttachments.referenceDocumentId, referenceDocumentId))
      .orderBy(desc(fileAttachments.createdAt));
  }

  async createFileAttachment(attachment: InsertFileAttachment): Promise<FileAttachment> {
    const [result] = await db.insert(fileAttachments).values(attachment).returning();
    return result;
  }

  async updateFileAttachment(id: string, updates: Partial<InsertFileAttachment>): Promise<FileAttachment> {
    const [result] = await db.update(fileAttachments)
      .set(updates)
      .where(eq(fileAttachments.id, id))
      .returning();
    return result;
  }

  async deleteFileAttachment(id: string): Promise<void> {
    await db.delete(fileAttachments).where(eq(fileAttachments.id, id));
  }

  // Survey Exercises
  async getAllSurveyExercises(): Promise<SurveyExercise[]> {
    return await db.select().from(surveyExercises).orderBy(asc(surveyExercises.sortOrder));
  }

  async getPublishedSurveyExercises(): Promise<SurveyExercise[]> {
    return await db.select().from(surveyExercises)
      .where(eq(surveyExercises.isPublished, 1))
      .orderBy(asc(surveyExercises.sortOrder));
  }

  async getSurveyExercise(id: string): Promise<SurveyExercise | undefined> {
    const [result] = await db.select().from(surveyExercises).where(eq(surveyExercises.id, id));
    return result;
  }

  async createSurveyExercise(exercise: InsertSurveyExercise): Promise<SurveyExercise> {
    const [result] = await db.insert(surveyExercises).values(exercise).returning();
    return result;
  }

  async updateSurveyExercise(id: string, updates: Partial<InsertSurveyExercise>): Promise<SurveyExercise> {
    const [result] = await db.update(surveyExercises)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(surveyExercises.id, id))
      .returning();
    return result;
  }

  async deleteSurveyExercise(id: string): Promise<void> {
    await db.delete(surveyExercises).where(eq(surveyExercises.id, id));
  }

  // Survey Questions
  async getSurveyQuestions(surveyId: string): Promise<SurveyQuestion[]> {
    return await db.select().from(surveyQuestions)
      .where(eq(surveyQuestions.surveyId, surveyId))
      .orderBy(asc(surveyQuestions.questionOrder));
  }

  async getSurveyQuestion(id: string): Promise<SurveyQuestion | undefined> {
    const [result] = await db.select().from(surveyQuestions).where(eq(surveyQuestions.id, id));
    return result;
  }

  async createSurveyQuestion(question: InsertSurveyQuestion): Promise<SurveyQuestion> {
    const [result] = await db.insert(surveyQuestions).values(question).returning();
    return result;
  }

  async updateSurveyQuestion(id: string, updates: Partial<InsertSurveyQuestion>): Promise<SurveyQuestion> {
    const [result] = await db.update(surveyQuestions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(surveyQuestions.id, id))
      .returning();
    return result;
  }

  async deleteSurveyQuestion(id: string): Promise<void> {
    await db.delete(surveyQuestions).where(eq(surveyQuestions.id, id));
  }

  async reorderSurveyQuestions(surveyId: string, questionIds: string[]): Promise<void> {
    for (let i = 0; i < questionIds.length; i++) {
      await db.update(surveyQuestions)
        .set({ questionOrder: i })
        .where(and(eq(surveyQuestions.id, questionIds[i]), eq(surveyQuestions.surveyId, surveyId)));
    }
  }

  // Survey Sessions
  async getClientSurveySessions(clientId: string): Promise<SurveySession[]> {
    return await db.select().from(surveySessions)
      .where(eq(surveySessions.clientId, clientId))
      .orderBy(desc(surveySessions.startedAt));
  }

  async getActiveSurveySession(clientId: string, surveyId: string): Promise<SurveySession | undefined> {
    const [result] = await db.select().from(surveySessions)
      .where(and(
        eq(surveySessions.clientId, clientId),
        eq(surveySessions.surveyId, surveyId),
        eq(surveySessions.status, "in_progress")
      ));
    return result;
  }

  async getSurveySession(id: string): Promise<SurveySession | undefined> {
    const [result] = await db.select().from(surveySessions).where(eq(surveySessions.id, id));
    return result;
  }

  async createSurveySession(session: InsertSurveySession): Promise<SurveySession> {
    const [result] = await db.insert(surveySessions).values(session).returning();
    return result;
  }

  async updateSurveySession(id: string, updates: Partial<SurveySession>): Promise<SurveySession> {
    const [result] = await db.update(surveySessions)
      .set(updates)
      .where(eq(surveySessions.id, id))
      .returning();
    return result;
  }

  // Survey Responses
  async getSessionResponses(sessionId: string): Promise<SurveyResponse[]> {
    return await db.select().from(surveyResponses)
      .where(eq(surveyResponses.sessionId, sessionId))
      .orderBy(asc(surveyResponses.answeredAt));
  }

  async getSurveyResponse(sessionId: string, questionId: string): Promise<SurveyResponse | undefined> {
    const [result] = await db.select().from(surveyResponses)
      .where(and(
        eq(surveyResponses.sessionId, sessionId),
        eq(surveyResponses.questionId, questionId)
      ));
    return result;
  }

  async createSurveyResponse(response: InsertSurveyResponse): Promise<SurveyResponse> {
    const [result] = await db.insert(surveyResponses).values(response).returning();
    return result;
  }

  async updateSurveyResponse(id: string, updates: Partial<InsertSurveyResponse>): Promise<SurveyResponse> {
    const [result] = await db.update(surveyResponses)
      .set({ ...updates, answeredAt: new Date() })
      .where(eq(surveyResponses.id, id))
      .returning();
    return result;
  }

  // Reminder Templates
  async getAllReminderTemplates(): Promise<ReminderTemplate[]> {
    return await db.select().from(reminderTemplates).orderBy(asc(reminderTemplates.sortOrder));
  }

  async getActiveReminderTemplates(): Promise<ReminderTemplate[]> {
    return await db.select().from(reminderTemplates)
      .where(eq(reminderTemplates.isActive, 1))
      .orderBy(asc(reminderTemplates.sortOrder));
  }

  async getReminderTemplate(id: string): Promise<ReminderTemplate | undefined> {
    const [result] = await db.select().from(reminderTemplates).where(eq(reminderTemplates.id, id));
    return result;
  }

  async createReminderTemplate(template: InsertReminderTemplate): Promise<ReminderTemplate> {
    const [result] = await db.insert(reminderTemplates).values(template).returning();
    return result;
  }

  async updateReminderTemplate(id: string, updates: Partial<InsertReminderTemplate>): Promise<ReminderTemplate> {
    const [result] = await db.update(reminderTemplates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(reminderTemplates.id, id))
      .returning();
    return result;
  }

  async deleteReminderTemplate(id: string): Promise<void> {
    await db.delete(reminderTemplates).where(eq(reminderTemplates.id, id));
  }

  // Client Reminders
  async getClientReminders(clientId: string): Promise<(ClientReminder & { template: ReminderTemplate })[]> {
    const results = await db.select()
      .from(clientReminders)
      .innerJoin(reminderTemplates, eq(clientReminders.templateId, reminderTemplates.id))
      .where(eq(clientReminders.clientId, clientId))
      .orderBy(desc(clientReminders.createdAt));
    return results.map((r: { client_reminders: ClientReminder; reminder_templates: ReminderTemplate }) => ({
      ...r.client_reminders,
      template: r.reminder_templates
    }));
  }

  async getClientReminder(id: string): Promise<ClientReminder | undefined> {
    const [result] = await db.select().from(clientReminders).where(eq(clientReminders.id, id));
    return result;
  }

  async createClientReminder(reminder: InsertClientReminder): Promise<ClientReminder> {
    const [result] = await db.insert(clientReminders).values(reminder).returning();
    return result;
  }

  async updateClientReminder(id: string, updates: Partial<ClientReminder>): Promise<ClientReminder> {
    const [result] = await db.update(clientReminders)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(clientReminders.id, id))
      .returning();
    return result;
  }

  async deleteClientReminder(id: string): Promise<void> {
    await db.delete(clientReminders).where(eq(clientReminders.id, id));
  }

  async getDueReminders(): Promise<(ClientReminder & { template: ReminderTemplate; client: Client })[]> {
    const now = new Date();
    const results = await db.select()
      .from(clientReminders)
      .innerJoin(reminderTemplates, eq(clientReminders.templateId, reminderTemplates.id))
      .innerJoin(clients, eq(clientReminders.clientId, clients.id))
      .where(and(
        eq(clientReminders.isEnabled, 1),
        eq(clientReminders.isPaused, 0),
        lte(clientReminders.nextScheduledAt, now)
      ));
    return results.map((r: { client_reminders: ClientReminder; reminder_templates: ReminderTemplate; clients: Client }) => ({
      ...r.client_reminders,
      template: r.reminder_templates,
      client: r.clients
    }));
  }

  async getClientsWithTemplate(templateId: string): Promise<(ClientReminder & { client: Client })[]> {
    const results = await db.select()
      .from(clientReminders)
      .innerJoin(clients, eq(clientReminders.clientId, clients.id))
      .where(eq(clientReminders.templateId, templateId));
    return results.map((r: { client_reminders: ClientReminder; clients: Client }) => ({
      ...r.client_reminders,
      client: r.clients
    }));
  }

  // Reminder History
  async createReminderHistory(history: InsertReminderHistory): Promise<ReminderHistory> {
    const [result] = await db.insert(reminderHistory).values(history).returning();
    return result;
  }

  async getClientReminderHistory(clientId: string): Promise<ReminderHistory[]> {
    return await db.select().from(reminderHistory)
      .where(eq(reminderHistory.clientId, clientId))
      .orderBy(desc(reminderHistory.sentAt));
  }

  async getReminderHistory(clientReminderId: string): Promise<ReminderHistory[]> {
    return await db.select().from(reminderHistory)
      .where(eq(reminderHistory.clientReminderId, clientReminderId))
      .orderBy(desc(reminderHistory.sentAt));
  }

  // Client Timezone
  async updateClientTimezone(clientId: string, timezone: string): Promise<void> {
    await db.update(clients)
      .set({ timezone })
      .where(eq(clients.id, clientId));
  }
}

export const storage = new DatabaseStorage();
