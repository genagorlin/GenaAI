import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertMessageSchema, insertInsightSchema, insertClientSchema, insertSentimentDataSchema, insertDocumentSectionSchema, registerClientSchema, insertThreadSchema } from "@shared/schema";
import { setupAuth, isAuthenticated, isClientAuthenticated, isAdmin, verifyClientAccess } from "./replitAuth";
import { z } from "zod";
import multer from "multer";
import OpenAI, { toFile } from "openai";
import { detectCoachMention } from "./mentionDetector";

const upload = multer({ storage: multer.memoryStorage() });

async function generateThreadTitle(threadId: string, firstMessage: string): Promise<void> {
  try {
    const openai = new OpenAI({
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    });
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Generate a short, descriptive title (3-6 words max) for a coaching conversation based on the user's first message. The title should capture the main topic or theme. Return only the title, no quotes or punctuation."
        },
        {
          role: "user",
          content: firstMessage
        }
      ],
      max_tokens: 20,
      temperature: 0.7,
    });
    
    const title = response.choices[0]?.message?.content?.trim();
    if (title) {
      await storage.updateThreadTitle(threadId, title);
      console.log(`[ThreadTitle] Generated title for thread ${threadId}: "${title}"`);
    }
  } catch (error) {
    console.error("[ThreadTitle] Error generating title:", error);
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Setup authentication
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Auth status check (no middleware - returns auth state)
  app.get('/api/auth/status', (req: any, res) => {
    const isAuth = req.isAuthenticated?.() && req.user?.claims;
    res.json({ 
      authenticated: !!isAuth,
      email: isAuth ? req.user.claims.email : null
    });
  });

  // Client Routes (protected)
  app.get("/api/clients", isAuthenticated, async (_req, res) => {
    try {
      const clients = await storage.getAllClients();
      res.json(clients);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch clients" });
    }
  });

  app.get("/api/clients/:id", isAuthenticated, async (req, res) => {
    try {
      const client = await storage.getClient(req.params.id);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      res.json(client);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch client" });
    }
  });

  app.post("/api/clients", isAuthenticated, async (req, res) => {
    try {
      const validated = insertClientSchema.parse(req.body);
      const client = await storage.createClient(validated);
      res.status(201).json(client);
    } catch (error) {
      res.status(400).json({ error: "Invalid client data" });
    }
  });

  app.delete("/api/clients/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const client = await storage.getClient(req.params.id);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      await storage.deleteClientWithRelatedData(req.params.id);
      console.log(`[Client] Coach deleted client: ${client.name} (${req.params.id})`);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete client error:", error);
      res.status(500).json({ error: "Failed to delete client" });
    }
  });

  // Client-facing endpoint for chat interface - returns limited client info
  // Protected by verifyClientAccess to ensure only the authorized client can access
  app.get("/api/chat/:clientId/info", verifyClientAccess((req) => req.params.clientId), async (req, res) => {
    try {
      const client = await storage.getClient(req.params.clientId);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      res.json({ id: client.id, name: client.name });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch client" });
    }
  });

  // Public endpoint for mobile app to register clients
  app.post("/api/clients/register", async (req, res) => {
    try {
      const validated = registerClientSchema.parse(req.body);
      const client = await storage.registerClient({
        id: validated.clientId,
        name: validated.name,
        email: validated.email,
        photoUrl: validated.photoUrl,
      });
      res.status(201).json(client);
    } catch (error) {
      console.error("Client registration error:", error);
      res.status(400).json({ error: "Invalid client data" });
    }
  });

  app.patch("/api/clients/:id/activity", async (req, res) => {
    try {
      const { mobileAppConnected } = req.body;
      await storage.updateClientActivity(req.params.id, mobileAppConnected);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update client activity" });
    }
  });

  // Thread Routes (protected for client chat interface)
  app.get("/api/clients/:clientId/threads", verifyClientAccess((req) => req.params.clientId), async (req, res) => {
    try {
      const threads = await storage.getClientThreads(req.params.clientId);
      res.json(threads);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch threads" });
    }
  });

  app.get("/api/threads/:id", async (req, res) => {
    try {
      const thread = await storage.getThread(req.params.id);
      if (!thread) {
        return res.status(404).json({ error: "Thread not found" });
      }
      res.json(thread);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch thread" });
    }
  });

  app.delete("/api/threads/:id", async (req, res) => {
    try {
      const thread = await storage.getThread(req.params.id);
      if (!thread) {
        return res.status(404).json({ error: "Thread not found" });
      }
      await storage.deleteThread(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete thread error:", error);
      res.status(500).json({ error: "Failed to delete thread" });
    }
  });

  app.post("/api/clients/:clientId/threads", verifyClientAccess((req) => req.params.clientId), async (req, res) => {
    try {
      const validated = insertThreadSchema.parse({
        ...req.body,
        clientId: req.params.clientId
      });
      const thread = await storage.createThread(validated);
      
      // Generate AI opening message for the new thread
      // If exerciseId is provided, generate an exercise-specific opening
      const exerciseId = req.body.exerciseId as string | undefined;
      
      try {
        const { promptAssembler } = await import("./promptAssembler");
        const { generateAIResponse } = await import("./modelRouter");
        
        const { systemPrompt } = await promptAssembler.assembleOpeningPrompt(req.params.clientId, exerciseId);
        
        const aiResponseContent = await generateAIResponse({
          systemPrompt,
          conversationHistory: [{ role: "user", content: "." }],
          model: "claude-sonnet-4-5",
          provider: "anthropic",
        });
        
        await storage.createMessage({
          clientId: req.params.clientId,
          threadId: thread.id,
          role: "ai",
          content: aiResponseContent,
          type: "text",
        });
        
        console.log(`[Thread] Created opening message for thread ${thread.id}${exerciseId ? ` (exercise: ${exerciseId})` : ''}`);
      } catch (aiError) {
        console.error("[Thread] Failed to generate opening message:", aiError);
        // Thread is still created, just without opening message
      }
      
      res.status(201).json(thread);
    } catch (error) {
      res.status(400).json({ error: "Invalid thread data" });
    }
  });

  app.patch("/api/threads/:id/title", async (req, res) => {
    try {
      const { title } = z.object({ title: z.string() }).parse(req.body);
      const thread = await storage.updateThreadTitle(req.params.id, title);
      res.json(thread);
    } catch (error) {
      res.status(400).json({ error: "Invalid title" });
    }
  });

  app.get("/api/threads/:threadId/messages", async (req, res) => {
    try {
      const messages = await storage.getThreadMessages(req.params.threadId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // Message Routes (protected for client chat interface)
  app.get("/api/clients/:clientId/messages", verifyClientAccess((req) => req.params.clientId), async (req, res) => {
    try {
      const messages = await storage.getClientMessages(req.params.clientId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.post("/api/clients/:clientId/messages", verifyClientAccess((req) => req.params.clientId), async (req, res) => {
    try {
      const validated = insertMessageSchema.parse({
        ...req.body,
        clientId: req.params.clientId
      });
      
      // Update lastActive when client sends a message
      if (validated.role === "user") {
        await storage.updateClientLastActive(req.params.clientId);
      }
      
      const isFirstMessageInThread = validated.threadId 
        ? (await storage.getThreadMessages(validated.threadId)).length === 0 
        : false;
      
      const mentionsCoach = detectCoachMention(validated.content) ? 1 : 0;
      
      // Get current exercise step ID if in an active exercise session
      let exerciseStepId: string | undefined;
      if (validated.threadId) {
        const activeSession = await storage.getActiveExerciseSession(req.params.clientId, validated.threadId);
        if (activeSession?.currentStepId) {
          exerciseStepId = activeSession.currentStepId;
        }
      }
      
      const message = await storage.createMessage({ ...validated, mentionsCoach, exerciseStepId });
      
      if (mentionsCoach && validated.threadId) {
        await storage.createCoachMention({
          messageId: message.id,
          clientId: req.params.clientId,
          threadId: validated.threadId,
        });
        console.log(`[Mention] Coach mentioned in thread ${validated.threadId}`);
      }
      
      if (validated.role === "user") {
        // Skip AI response if client is addressing the coach directly
        if (mentionsCoach) {
          console.log(`[AI] Skipping AI response - client is addressing coach directly`);
          return res.status(201).json({ userMessage: message, coachMentioned: true });
        }
        
        const { promptAssembler } = await import("./promptAssembler");
        const { routeMessage, generateAIResponse } = await import("./modelRouter");
        
        try {
          const clientContext = await promptAssembler.getClientContext(req.params.clientId);
          const recentMessages = validated.threadId 
            ? await promptAssembler.getThreadMessages(validated.threadId)
            : await promptAssembler.getRecentMessages(req.params.clientId);
          
          // Get exercise context if there's an active exercise in this thread
          const exerciseContext = validated.threadId 
            ? await promptAssembler.getExerciseContext(req.params.clientId, validated.threadId)
            : undefined;
          
          const assembled = await promptAssembler.assemblePrompt({
            clientId: req.params.clientId,
            currentMessage: validated.content,
            currentSpeaker: "client",
            messageAlreadyStored: true, // Message was already saved before this call
            recentMessages,
            documentSections: clientContext.documentSections,
            exerciseContext,
          });
          
          const routing = routeMessage(validated.content);
          console.log(`[AI] Routing: ${routing.reasoning} -> ${routing.model}`);
          
          const aiResponseContent = await generateAIResponse({
            systemPrompt: assembled.systemPrompt,
            conversationHistory: assembled.conversationHistory,
            model: routing.model,
            provider: routing.provider,
          });
          
          const aiMessage = await storage.createMessage({
            clientId: req.params.clientId,
            threadId: validated.threadId,
            exerciseStepId,
            role: "ai",
            content: aiResponseContent,
            type: "text",
          });
          
          if (validated.threadId && isFirstMessageInThread) {
            generateThreadTitle(validated.threadId, validated.content).catch(err => {
              console.error("[ThreadTitle] Failed to generate title:", err);
            });
          }
          
          const { isGoodbyeMessage, summarizeSession, updateDocumentRealtime } = await import("./sessionSummarizer");
          
          updateDocumentRealtime(req.params.clientId, validated.content, aiResponseContent).catch(err => {
            console.error("[RealtimeUpdate] Background update failed:", err);
          });
          
          if (isGoodbyeMessage(validated.content)) {
            console.log(`[SessionEnd] Goodbye detected from client ${req.params.clientId}`);
            summarizeSession(req.params.clientId).catch(err => {
              console.error("[SessionEnd] Background summarization failed:", err);
            });
          }
          
          return res.status(201).json({ userMessage: message, aiMessage });
        } catch (aiError) {
          console.error("AI response error:", aiError);
          return res.status(201).json({ userMessage: message, aiError: "Failed to generate AI response" });
        }
      }
      
      res.status(201).json(message);
    } catch (error) {
      res.status(400).json({ error: "Invalid message data" });
    }
  });

  // Insight Routes (POST is public for AI, GET is protected)
  app.get("/api/clients/:clientId/insights", isAuthenticated, async (req, res) => {
    try {
      const insights = await storage.getClientInsights(req.params.clientId);
      res.json(insights);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch insights" });
    }
  });

  app.post("/api/clients/:clientId/insights", async (req, res) => {
    try {
      const validated = insertInsightSchema.parse({
        ...req.body,
        clientId: req.params.clientId
      });
      const insight = await storage.createInsight(validated);
      res.status(201).json(insight);
    } catch (error) {
      res.status(400).json({ error: "Invalid insight data" });
    }
  });

  // Sentiment Data Routes (POST is public for AI, GET is protected)
  app.get("/api/clients/:clientId/sentiment", isAuthenticated, async (req, res) => {
    try {
      const data = await storage.getClientSentimentData(req.params.clientId);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch sentiment data" });
    }
  });

  app.post("/api/clients/:clientId/sentiment", async (req, res) => {
    try {
      const validated = insertSentimentDataSchema.parse({
        ...req.body,
        clientId: req.params.clientId
      });
      const data = await storage.createSentimentData(validated);
      res.status(201).json(data);
    } catch (error) {
      res.status(400).json({ error: "Invalid sentiment data" });
    }
  });

  // Living Document Routes
  app.get("/api/clients/:clientId/document", isAuthenticated, async (req, res) => {
    try {
      const document = await storage.getOrCreateClientDocument(req.params.clientId);
      const sections = await storage.getDocumentSections(document.id);
      res.json({ document, sections });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch document" });
    }
  });

  // Client document access (protected by verifyClientAccess)
  // Note: Role prompts and task prompts are stored separately and not included in document sections
  app.get("/api/chat/:clientId/document", verifyClientAccess((req) => req.params.clientId), async (req: any, res) => {
    try {
      const client = await storage.getClient(req.params.clientId);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      
      const document = await storage.getOrCreateClientDocument(req.params.clientId);
      const sections = await storage.getDocumentSections(document.id);
      // Remove coach notes from sections for client view
      const clientSections = sections.map(({ coachNotes, ...section }) => section);
      res.json({ document, sections: clientSections });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch document" });
    }
  });

  // Client section update (protected by verifyClientAccess)
  app.patch("/api/chat/:clientId/sections/:sectionId", verifyClientAccess((req) => req.params.clientId), async (req: any, res) => {
    try {
      const client = await storage.getClient(req.params.clientId);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      
      // Verify the section belongs to this client's document
      const document = await storage.getClientDocument(req.params.clientId);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }
      const existingSection = await storage.getSection(req.params.sectionId);
      if (!existingSection || existingSection.documentId !== document.id) {
        return res.status(404).json({ error: "Section not found" });
      }
      const updateSchema = z.object({
        title: z.string().optional(),
        content: z.string().optional(),
      });
      const updates = updateSchema.parse(req.body);
      // Mark as client-edited
      const section = await storage.updateSection(req.params.sectionId, { 
        ...updates, 
        lastUpdatedBy: "client",
        pendingReview: 0 // Client edits don't need coach review
      });
      res.json(section);
    } catch (error) {
      res.status(400).json({ error: "Invalid update data" });
    }
  });

  app.get("/api/clients/:clientId/document/sections", isAuthenticated, async (req, res) => {
    try {
      const document = await storage.getClientDocument(req.params.clientId);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }
      const sections = await storage.getDocumentSections(document.id);
      res.json(sections);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch sections" });
    }
  });

  app.post("/api/clients/:clientId/document/sections", isAuthenticated, async (req, res) => {
    try {
      const document = await storage.getOrCreateClientDocument(req.params.clientId);
      const validated = insertDocumentSectionSchema.parse({
        ...req.body,
        documentId: document.id
      });
      const section = await storage.createSection(validated);
      res.status(201).json(section);
    } catch (error) {
      res.status(400).json({ error: "Invalid section data" });
    }
  });

  app.patch("/api/sections/:id", isAuthenticated, async (req, res) => {
    try {
      const existingSection = await storage.getSection(req.params.id);
      if (!existingSection) {
        return res.status(404).json({ error: "Section not found" });
      }
      const updateSchema = z.object({
        title: z.string().optional(),
        content: z.string().optional(),
        isCollapsed: z.number().optional(),
        sectionType: z.string().optional(),
      });
      const updates = updateSchema.parse(req.body);
      const section = await storage.updateSection(req.params.id, updates);
      res.json(section);
    } catch (error) {
      res.status(400).json({ error: "Invalid update data" });
    }
  });

  app.delete("/api/sections/:id", isAuthenticated, async (req, res) => {
    try {
      const existingSection = await storage.getSection(req.params.id);
      if (!existingSection) {
        return res.status(404).json({ error: "Section not found" });
      }
      await storage.deleteSection(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete section" });
    }
  });

  app.patch("/api/clients/:clientId/document/sections/reorder", isAuthenticated, async (req, res) => {
    try {
      const document = await storage.getClientDocument(req.params.clientId);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }
      const { sectionIds } = z.object({ sectionIds: z.array(z.string()) }).parse(req.body);
      await storage.reorderSections(document.id, sectionIds);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Invalid reorder data" });
    }
  });

  app.post("/api/sections/:id/accept", isAuthenticated, async (req, res) => {
    try {
      const section = await storage.acceptSectionUpdate(req.params.id);
      res.json(section);
    } catch (error) {
      res.status(500).json({ error: "Failed to accept update" });
    }
  });

  app.post("/api/sections/:id/revert", isAuthenticated, async (req, res) => {
    try {
      const section = await storage.revertSectionUpdate(req.params.id);
      res.json(section);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to revert update" });
    }
  });

  // Prompt Layer Routes
  app.get("/api/clients/:clientId/prompts", isAuthenticated, async (req, res) => {
    try {
      const rolePrompt = await storage.getOrCreateRolePrompt(req.params.clientId);
      const taskPrompt = await storage.getOrCreateTaskPrompt(req.params.clientId);
      res.json({ rolePrompt, taskPrompt });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch prompts" });
    }
  });

  app.patch("/api/clients/:clientId/prompts/role", isAuthenticated, async (req, res) => {
    try {
      const { content } = z.object({ content: z.string() }).parse(req.body);
      const rolePrompt = await storage.updateRolePrompt(req.params.clientId, content);
      res.json(rolePrompt);
    } catch (error) {
      res.status(400).json({ error: "Invalid prompt data" });
    }
  });

  app.patch("/api/clients/:clientId/prompts/task", isAuthenticated, async (req, res) => {
    try {
      const { content } = z.object({ content: z.string() }).parse(req.body);
      const taskPrompt = await storage.updateTaskPrompt(req.params.clientId, content);
      res.json(taskPrompt);
    } catch (error) {
      res.status(400).json({ error: "Invalid prompt data" });
    }
  });

  // Admin Routes - User Management
  app.get("/api/admin/users", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const users = await storage.getAllAuthorizedUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.post("/api/admin/users", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { email, role } = z.object({ 
        email: z.string().email(), 
        role: z.enum(["admin", "user"]).default("user") 
      }).parse(req.body);
      const user = await storage.createAuthorizedUser(email, role);
      res.status(201).json(user);
    } catch (error: any) {
      if (error.code === "23505") {
        res.status(409).json({ error: "User with this email already exists" });
      } else {
        res.status(400).json({ error: "Invalid user data" });
      }
    }
  });

  app.delete("/api/admin/users/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      await storage.deleteAuthorizedUser(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // Session End Route (protected by verifyClientAccess)
  app.post("/api/clients/:clientId/session-end", verifyClientAccess((req) => req.params.clientId), async (req, res) => {
    try {
      const { summarizeSession, generateConversationTitle } = await import("./sessionSummarizer");
      const result = await summarizeSession(req.params.clientId);
      
      // Also generate titles for any threads that still have default names
      const threads = await storage.getClientThreads(req.params.clientId);
      for (const thread of threads) {
        if (thread.title === "New conversation" || thread.title === "First conversation") {
          const messages = await storage.getThreadMessages(thread.id);
          if (messages.length >= 2) {
            await generateConversationTitle(thread.id, messages);
          }
        }
      }
      
      if (result.success) {
        console.log(`[SessionEnd] Client ${req.params.clientId}: Updated ${result.updatedSections} sections`);
        res.json({ success: true, updatedSections: result.updatedSections });
      } else {
        console.error(`[SessionEnd] Client ${req.params.clientId}: ${result.error}`);
        res.status(500).json({ error: result.error });
      }
    } catch (error: any) {
      console.error("Session end error:", error);
      res.status(500).json({ error: "Failed to process session end" });
    }
  });

  // Migration Route - Migrate existing messages to threads (one-time use)
  app.post("/api/migrate/messages-to-threads", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const allClients = await storage.getAllClients();
      let migratedCount = 0;
      
      for (const client of allClients) {
        const messages = await storage.getClientMessages(client.id);
        const messagesWithoutThread = messages.filter(m => !m.threadId);
        
        if (messagesWithoutThread.length > 0) {
          const thread = await storage.getOrCreateDefaultThread(client.id);
          
          // Update messages to belong to this thread using raw SQL
          const { db } = await import("./db");
          const { messages: messagesTable } = await import("@shared/schema");
          const { eq, isNull, and } = await import("drizzle-orm");
          
          await db.update(messagesTable)
            .set({ threadId: thread.id })
            .where(and(eq(messagesTable.clientId, client.id), isNull(messagesTable.threadId)));
          
          // Auto-generate title from first message
          const firstMessage = messagesWithoutThread.find(m => m.role === "user");
          if (firstMessage) {
            const title = firstMessage.content.slice(0, 50) + (firstMessage.content.length > 50 ? "..." : "");
            await storage.updateThreadTitle(thread.id, title);
          }
          
          migratedCount++;
        }
      }
      
      res.json({ success: true, clientsMigrated: migratedCount });
    } catch (error: any) {
      console.error("Migration error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Coach Message Route - allows coach to send messages into client threads
  // Also triggers an AI response so the AI can respond to the coach
  app.post("/api/coach/threads/:threadId/messages", isAuthenticated, async (req: any, res) => {
    try {
      const thread = await storage.getThread(req.params.threadId);
      if (!thread) {
        return res.status(404).json({ error: "Thread not found" });
      }

      const { content, triggerAI = true } = z.object({ 
        content: z.string().min(1),
        triggerAI: z.boolean().optional()
      }).parse(req.body);
      
      const coachMessage = await storage.createMessage({
        clientId: thread.clientId,
        threadId: thread.id,
        role: "coach",
        content,
        type: "text",
      });

      console.log(`[Coach] Message sent to thread ${thread.id}`);

      // Generate AI response to the coach's message
      if (triggerAI) {
        try {
          const { routeMessage, generateAIResponse } = await import("./modelRouter");
          const { promptAssembler } = await import("./promptAssembler");
          
          const clientContext = await promptAssembler.getClientContext(thread.clientId);
          const recentMessages = await promptAssembler.getThreadMessages(thread.id);
          
          // Get exercise context if there's an active exercise in this thread
          const exerciseContext = await promptAssembler.getExerciseContext(thread.clientId, thread.id);
          
          const assembled = await promptAssembler.assemblePrompt({
            clientId: thread.clientId,
            currentMessage: content,
            currentSpeaker: "coach",
            messageAlreadyStored: true, // Message was already saved before this call
            recentMessages,
            documentSections: clientContext.documentSections,
            exerciseContext,
          });
          
          const routing = routeMessage(content);
          console.log(`[AI] Coach message routing: ${routing.reasoning} -> ${routing.model}`);
          
          const aiResponseContent = await generateAIResponse({
            systemPrompt: assembled.systemPrompt,
            conversationHistory: assembled.conversationHistory,
            model: routing.model,
            provider: routing.provider,
          });
          
          const aiMessage = await storage.createMessage({
            clientId: thread.clientId,
            threadId: thread.id,
            role: "ai",
            content: aiResponseContent,
            type: "text",
          });
          
          console.log(`[AI] Response to coach in thread ${thread.id}`);
          res.status(201).json({ coachMessage, aiMessage });
        } catch (aiError) {
          console.error("[AI] Failed to generate response to coach:", aiError);
          // Still return the coach message even if AI fails
          res.status(201).json({ coachMessage, aiMessage: null, error: "AI response failed" });
        }
      } else {
        res.status(201).json({ coachMessage });
      }
    } catch (error) {
      console.error("Coach message error:", error);
      res.status(400).json({ error: "Failed to send message" });
    }
  });

  // Coach Mentions API
  app.get("/api/coach/mentions", isAuthenticated, async (_req, res) => {
    try {
      const mentions = await storage.getUnreadMentions();
      res.json(mentions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch mentions" });
    }
  });

  app.get("/api/coach/mentions/count", isAuthenticated, async (_req, res) => {
    try {
      const count = await storage.getUnreadMentionCount();
      res.json({ count });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch mention count" });
    }
  });

  app.patch("/api/coach/mentions/:id/read", isAuthenticated, async (req, res) => {
    try {
      const mention = await storage.markMentionRead(req.params.id);
      res.json(mention);
    } catch (error) {
      res.status(500).json({ error: "Failed to mark mention as read" });
    }
  });

  app.patch("/api/coach/threads/:threadId/mentions/read", isAuthenticated, async (req, res) => {
    try {
      await storage.markThreadMentionsRead(req.params.threadId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to mark mentions as read" });
    }
  });

  // Coach-AI Consultation Routes (private conversations about a client)
  app.get("/api/coach/clients/:clientId/consultations", isAuthenticated, async (req, res) => {
    try {
      const consultations = await storage.getClientConsultations(req.params.clientId);
      res.json(consultations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch consultations" });
    }
  });

  app.post("/api/coach/clients/:clientId/consultations", isAuthenticated, async (req, res) => {
    try {
      const client = await storage.getClient(req.params.clientId);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }

      const { content } = z.object({ content: z.string().min(1) }).parse(req.body);
      
      const { promptAssembler } = await import("./promptAssembler");
      const { generateAIResponse } = await import("./modelRouter");

      const existingConsultations = await storage.getClientConsultations(req.params.clientId);
      const systemPrompt = await promptAssembler.assembleConsultationPrompt(req.params.clientId);
      
      const conversationHistory = [
        ...existingConsultations.map(c => ({
          role: c.role === "coach" ? "user" as const : "assistant" as const,
          content: c.content,
        })),
        { role: "user" as const, content },
      ];

      const aiResponseContent = await generateAIResponse({
        systemPrompt,
        conversationHistory,
        model: "claude-sonnet-4-5",
        provider: "anthropic",
      });

      const coachMessage = await storage.createConsultation({
        clientId: req.params.clientId,
        role: "coach",
        content,
      });

      const aiMessage = await storage.createConsultation({
        clientId: req.params.clientId,
        role: "ai",
        content: aiResponseContent,
      });

      console.log(`[Consultation] Coach consulted about client ${req.params.clientId}`);
      res.status(201).json({ coachMessage, aiMessage });
    } catch (error) {
      console.error("Consultation error:", error);
      res.status(500).json({ error: "Failed to process consultation" });
    }
  });

  app.delete("/api/coach/clients/:clientId/consultations", isAuthenticated, async (req, res) => {
    try {
      await storage.clearClientConsultations(req.params.clientId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to clear consultations" });
    }
  });

  // Reference Documents Routes - Public endpoint for clients to read
  app.get("/api/reference-documents", async (_req, res) => {
    try {
      const docs = await storage.getAllReferenceDocuments();
      res.json(docs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch reference documents" });
    }
  });

  // Reference Documents Routes (coach's writings for AI to reference)
  app.get("/api/coach/reference-documents", isAuthenticated, async (_req, res) => {
    try {
      const docs = await storage.getAllReferenceDocuments();
      res.json(docs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch reference documents" });
    }
  });

  app.get("/api/coach/reference-documents/:id", isAuthenticated, async (req, res) => {
    try {
      const doc = await storage.getReferenceDocument(req.params.id);
      if (!doc) {
        return res.status(404).json({ error: "Document not found" });
      }
      res.json(doc);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch reference document" });
    }
  });

  app.post("/api/coach/reference-documents", isAuthenticated, async (req, res) => {
    try {
      const { insertReferenceDocumentSchema } = await import("@shared/schema");
      const validated = insertReferenceDocumentSchema.parse(req.body);
      const doc = await storage.createReferenceDocument(validated);
      console.log(`[RefDoc] Created reference document: ${doc.title}`);
      res.status(201).json(doc);
    } catch (error) {
      console.error("Create reference document error:", error);
      res.status(400).json({ error: "Failed to create reference document" });
    }
  });

  app.patch("/api/coach/reference-documents/:id", isAuthenticated, async (req, res) => {
    try {
      const doc = await storage.updateReferenceDocument(req.params.id, req.body);
      console.log(`[RefDoc] Updated reference document: ${doc.title}`);
      res.json(doc);
    } catch (error) {
      console.error("Update reference document error:", error);
      res.status(400).json({ error: "Failed to update reference document" });
    }
  });

  app.delete("/api/coach/reference-documents/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteReferenceDocument(req.params.id);
      console.log(`[RefDoc] Deleted reference document: ${req.params.id}`);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete reference document" });
    }
  });

  // Guided Exercises Routes - Public endpoints for clients
  app.get("/api/exercises", async (_req, res) => {
    try {
      const exercises = await storage.getPublishedExercises();
      res.json(exercises);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch exercises" });
    }
  });

  app.get("/api/exercises/:id", async (req, res) => {
    try {
      const exercise = await storage.getGuidedExercise(req.params.id);
      if (!exercise) {
        return res.status(404).json({ error: "Exercise not found" });
      }
      res.json(exercise);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch exercise" });
    }
  });

  app.get("/api/exercises/:id/steps", async (req, res) => {
    try {
      const steps = await storage.getExerciseSteps(req.params.id);
      res.json(steps);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch exercise steps" });
    }
  });

  // Client Exercise Sessions (protected by verifyClientAccess)
  app.get("/api/clients/:clientId/exercise-sessions", verifyClientAccess((req) => req.params.clientId), async (req, res) => {
    try {
      const sessions = await storage.getClientExerciseSessions(req.params.clientId);
      res.json(sessions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch exercise sessions" });
    }
  });

  app.get("/api/clients/:clientId/threads/:threadId/exercise-session", verifyClientAccess((req) => req.params.clientId), async (req, res) => {
    try {
      const session = await storage.getActiveExerciseSession(
        req.params.clientId,
        req.params.threadId
      );
      if (!session) {
        return res.json(null);
      }
      const exercise = await storage.getGuidedExercise(session.exerciseId);
      const currentStep = session.currentStepId 
        ? await storage.getExerciseStep(session.currentStepId) 
        : null;
      const steps = await storage.getExerciseSteps(session.exerciseId);
      res.json({ session, exercise, currentStep, steps });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch active exercise session" });
    }
  });

  app.post("/api/clients/:clientId/exercise-sessions", verifyClientAccess((req) => req.params.clientId), async (req, res) => {
    try {
      const { insertClientExerciseSessionSchema } = await import("@shared/schema");
      const validated = insertClientExerciseSessionSchema.parse({
        ...req.body,
        clientId: req.params.clientId,
      });
      const session = await storage.createExerciseSession(validated);
      console.log(`[Exercise] Client ${req.params.clientId} started exercise session: ${session.id}`);
      
      // Generate AI opening message for the exercise
      try {
        const { promptAssembler } = await import("./promptAssembler");
        const { generateAIResponse } = await import("./modelRouter");
        
        const { systemPrompt } = await promptAssembler.assembleOpeningPrompt(
          req.params.clientId, 
          validated.exerciseId
        );
        
        const aiResponseContent = await generateAIResponse({
          systemPrompt,
          conversationHistory: [{ role: "user", content: "." }],
          model: "claude-sonnet-4-5",
          provider: "anthropic",
        });
        
        await storage.createMessage({
          clientId: req.params.clientId,
          threadId: validated.threadId,
          exerciseStepId: session.currentStepId || undefined,
          role: "ai",
          content: aiResponseContent,
          type: "text",
        });
        
        console.log(`[Exercise] Generated opening message for exercise ${validated.exerciseId} (step: ${session.currentStepId})`);
      } catch (aiError) {
        console.error("[Exercise] Failed to generate exercise opening message:", aiError);
        // Session is still created, just without opening message
      }
      
      res.status(201).json(session);
    } catch (error) {
      console.error("Create exercise session error:", error);
      res.status(400).json({ error: "Failed to start exercise session" });
    }
  });

  app.patch("/api/exercise-sessions/:id", async (req, res) => {
    try {
      const session = await storage.updateExerciseSession(req.params.id, req.body);
      console.log(`[Exercise] Updated session ${req.params.id}: ${JSON.stringify(req.body)}`);
      res.json(session);
    } catch (error) {
      console.error("Update exercise session error:", error);
      res.status(400).json({ error: "Failed to update exercise session" });
    }
  });

  // Guided Exercises Routes - Coach management (protected)
  app.get("/api/coach/exercises", isAuthenticated, async (_req, res) => {
    try {
      const exercises = await storage.getAllGuidedExercises();
      res.json(exercises);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch exercises" });
    }
  });

  app.get("/api/coach/exercises/:id", isAuthenticated, async (req, res) => {
    try {
      const exercise = await storage.getGuidedExercise(req.params.id);
      if (!exercise) {
        return res.status(404).json({ error: "Exercise not found" });
      }
      const steps = await storage.getExerciseSteps(req.params.id);
      res.json({ ...exercise, steps });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch exercise" });
    }
  });

  app.post("/api/coach/exercises", isAuthenticated, async (req, res) => {
    try {
      const { insertGuidedExerciseSchema } = await import("@shared/schema");
      const validated = insertGuidedExerciseSchema.parse(req.body);
      const exercise = await storage.createGuidedExercise(validated);
      console.log(`[Exercise] Coach created exercise: ${exercise.title}`);
      res.status(201).json(exercise);
    } catch (error) {
      console.error("Create exercise error:", error);
      res.status(400).json({ error: "Failed to create exercise" });
    }
  });

  app.patch("/api/coach/exercises/:id", isAuthenticated, async (req, res) => {
    try {
      const exercise = await storage.updateGuidedExercise(req.params.id, req.body);
      console.log(`[Exercise] Coach updated exercise: ${exercise.title}`);
      res.json(exercise);
    } catch (error) {
      console.error("Update exercise error:", error);
      res.status(400).json({ error: "Failed to update exercise" });
    }
  });

  app.delete("/api/coach/exercises/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteGuidedExercise(req.params.id);
      console.log(`[Exercise] Coach deleted exercise: ${req.params.id}`);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete exercise" });
    }
  });

  // Exercise Steps Routes (coach)
  app.post("/api/coach/exercises/:exerciseId/steps", isAuthenticated, async (req, res) => {
    try {
      const { insertExerciseStepSchema } = await import("@shared/schema");
      const validated = insertExerciseStepSchema.parse({
        ...req.body,
        exerciseId: req.params.exerciseId,
      });
      const step = await storage.createExerciseStep(validated);
      console.log(`[Exercise] Coach added step to exercise ${req.params.exerciseId}: ${step.title}`);
      res.status(201).json(step);
    } catch (error) {
      console.error("Create step error:", error);
      res.status(400).json({ error: "Failed to create exercise step" });
    }
  });

  app.patch("/api/coach/steps/:id", isAuthenticated, async (req, res) => {
    try {
      const step = await storage.updateExerciseStep(req.params.id, req.body);
      console.log(`[Exercise] Coach updated step: ${step.title}`);
      res.json(step);
    } catch (error) {
      console.error("Update step error:", error);
      res.status(400).json({ error: "Failed to update exercise step" });
    }
  });

  app.delete("/api/coach/steps/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteExerciseStep(req.params.id);
      console.log(`[Exercise] Coach deleted step: ${req.params.id}`);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete exercise step" });
    }
  });

  app.post("/api/coach/exercises/:exerciseId/reorder-steps", isAuthenticated, async (req, res) => {
    try {
      const { stepIds } = req.body;
      if (!Array.isArray(stepIds)) {
        return res.status(400).json({ error: "stepIds must be an array" });
      }
      await storage.reorderExerciseSteps(req.params.exerciseId, stepIds);
      console.log(`[Exercise] Coach reordered steps for exercise ${req.params.exerciseId}`);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to reorder exercise steps" });
    }
  });

  // Exercise Step Response Routes (client)
  // Get all responses for a session
  app.get("/api/exercises/sessions/:sessionId/responses", async (req, res) => {
    try {
      const responses = await storage.getSessionResponses(req.params.sessionId);
      res.json(responses);
    } catch (error) {
      console.error("Get session responses error:", error);
      res.status(500).json({ error: "Failed to fetch responses" });
    }
  });

  // Get a specific step response
  app.get("/api/exercises/sessions/:sessionId/steps/:stepId/response", async (req, res) => {
    try {
      const response = await storage.getStepResponse(req.params.sessionId, req.params.stepId);
      res.json(response || null);
    } catch (error) {
      console.error("Get step response error:", error);
      res.status(500).json({ error: "Failed to fetch step response" });
    }
  });

  // Submit or update a step response
  app.post("/api/exercises/sessions/:sessionId/steps/:stepId/response", async (req, res) => {
    try {
      const { clientAnswer } = req.body;
      if (typeof clientAnswer !== "string") {
        return res.status(400).json({ error: "clientAnswer is required" });
      }
      
      const response = await storage.upsertStepResponse({
        sessionId: req.params.sessionId,
        stepId: req.params.stepId,
        clientAnswer,
        submittedAt: new Date(),
      });
      
      console.log(`[Exercise] Client submitted answer for step ${req.params.stepId}`);
      res.json(response);
    } catch (error) {
      console.error("Submit step response error:", error);
      res.status(500).json({ error: "Failed to submit response" });
    }
  });

  // AI review of a step response
  app.post("/api/exercises/sessions/:sessionId/steps/:stepId/review", async (req, res) => {
    try {
      const session = await storage.getExerciseSession(req.params.sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      const step = await storage.getExerciseStep(req.params.stepId);
      if (!step) {
        return res.status(404).json({ error: "Step not found" });
      }
      
      const existingResponse = await storage.getStepResponse(req.params.sessionId, req.params.stepId);
      if (!existingResponse || !existingResponse.clientAnswer) {
        return res.status(400).json({ error: "No answer to review" });
      }
      
      // Get exercise for context
      const exercise = await storage.getGuidedExercise(session.exerciseId);
      if (!exercise) {
        return res.status(404).json({ error: "Exercise not found" });
      }
      
      // Build AI review prompt
      const reviewPrompt = `You are reviewing a client's answer for an exercise step.

EXERCISE: ${exercise.title}
STEP: ${step.title}
STEP INSTRUCTIONS: ${step.instructions}
${step.completionCriteria ? `EXPECTED ANSWER TYPE: ${step.completionCriteria}` : ""}

CLIENT'S ANSWER:
${existingResponse.clientAnswer}

Your task: Determine if the answer matches what the step is asking for.
- If the answer is appropriate (matches the type of response requested), respond with: {"needsRevision": false, "feedback": null}
- If the answer doesn't match (e.g., listing feelings when asked for facts, or vice versa), respond with: {"needsRevision": true, "feedback": "Brief, constructive feedback explaining what's needed"}

Be generous - only flag answers that clearly miss the point. Minor imperfections are fine.
Respond with ONLY the JSON object, no other text.`;

      // Call AI for review
      const { routeMessage } = await import("./modelRouter");
      const { tier, model, provider } = routeMessage(existingResponse.clientAnswer);
      
      let reviewResult = { needsRevision: false, feedback: null as string | null };
      
      if (provider === "openai") {
        const OpenAI = (await import("openai")).default;
        const openai = new OpenAI({
          apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
          baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://api.openai.com/v1",
        });
        
        const response = await openai.chat.completions.create({
          model,
          messages: [{ role: "user", content: reviewPrompt }],
          max_tokens: 200,
          temperature: 0.3,
        });
        
        try {
          reviewResult = JSON.parse(response.choices[0]?.message?.content || "{}");
        } catch {
          reviewResult = { needsRevision: false, feedback: null };
        }
      } else {
        const Anthropic = (await import("@anthropic-ai/sdk")).default;
        const anthropic = new Anthropic({
          apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
          baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
        });
        
        const response = await anthropic.messages.create({
          model,
          max_tokens: 200,
          messages: [{ role: "user", content: reviewPrompt }],
        });
        
        try {
          const textContent = response.content.find((c) => c.type === "text");
          reviewResult = JSON.parse(textContent?.text || "{}");
        } catch {
          reviewResult = { needsRevision: false, feedback: null };
        }
      }
      
      // Update the response with AI feedback
      const updatedResponse = await storage.updateStepResponse(existingResponse.id, {
        aiFeedback: reviewResult.feedback,
        needsRevision: reviewResult.needsRevision ? 1 : 0,
      });
      
      console.log(`[Exercise] AI reviewed step ${req.params.stepId}: needsRevision=${reviewResult.needsRevision}`);
      res.json(updatedResponse);
    } catch (error) {
      console.error("Review step response error:", error);
      res.status(500).json({ error: "Failed to review response" });
    }
  });

  // File Attachment Routes (protected - coach only)
  // Get upload URL for object storage
  app.post("/api/coach/files/upload-url", isAuthenticated, async (_req, res) => {
    try {
      const { ObjectStorageService } = await import("./objectStorage");
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Upload URL error:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  // Register uploaded file attachment
  app.post("/api/coach/files", isAuthenticated, async (req: any, res) => {
    try {
      const { filename, originalName, mimeType, size, objectPath, exerciseId, referenceDocumentId } = req.body;
      
      if (!filename || !originalName || !mimeType || !objectPath) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Set ACL policy on the uploaded object
      const { ObjectStorageService } = await import("./objectStorage");
      const objectStorageService = new ObjectStorageService();
      const normalizedPath = await objectStorageService.trySetObjectEntityAclPolicy(objectPath, {
        owner: req.user?.claims?.sub || "coach",
        visibility: "public",
      });

      const attachment = await storage.createFileAttachment({
        filename,
        originalName,
        mimeType,
        size: size || 0,
        objectPath: normalizedPath,
        exerciseId: exerciseId || null,
        referenceDocumentId: referenceDocumentId || null,
        extractedText: null,
      });

      console.log(`[Files] Created attachment: ${originalName} -> ${normalizedPath}`);
      res.status(201).json(attachment);
    } catch (error) {
      console.error("Create attachment error:", error);
      res.status(500).json({ error: "Failed to create file attachment" });
    }
  });

  // Get attachments for an exercise
  app.get("/api/coach/exercises/:exerciseId/files", isAuthenticated, async (req, res) => {
    try {
      const attachments = await storage.getExerciseAttachments(req.params.exerciseId);
      res.json(attachments);
    } catch (error) {
      res.status(500).json({ error: "Failed to get exercise attachments" });
    }
  });

  // Get attachments for a reference document
  app.get("/api/coach/reference-documents/:docId/files", isAuthenticated, async (req, res) => {
    try {
      const attachments = await storage.getReferenceDocumentAttachments(req.params.docId);
      res.json(attachments);
    } catch (error) {
      res.status(500).json({ error: "Failed to get reference document attachments" });
    }
  });

  // Delete a file attachment
  app.delete("/api/coach/files/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteFileAttachment(req.params.id);
      console.log(`[Files] Deleted attachment: ${req.params.id}`);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete file attachment" });
    }
  });

  // Serve uploaded files (public for now - coach uploads are visible)
  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      const { ObjectStorageService, ObjectNotFoundError } = await import("./objectStorage");
      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      objectStorageService.downloadObject(objectFile, res);
    } catch (error: any) {
      console.error("Object serve error:", error);
      if (error.name === "ObjectNotFoundError") {
        return res.status(404).json({ error: "File not found" });
      }
      res.status(500).json({ error: "Failed to serve file" });
    }
  });

  // Dynamic PWA manifest (customizes start_url based on query param)
  app.get("/api/manifest.json", (req, res) => {
    let startUrl = "/";
    
    // Use query parameter if provided
    const startParam = req.query.start as string;
    if (startParam && startParam.startsWith("/chat/")) {
      startUrl = startParam;
    }

    const manifest = {
      name: "GenaGPT - AI Coaching Journal",
      short_name: "GenaGPT",
      description: "Your AI-powered coaching journal and thinking partner",
      start_url: startUrl,
      display: "standalone",
      background_color: "#ffffff",
      theme_color: "#7c3aed",
      orientation: "portrait-primary",
      icons: [
        {
          src: "/icon-192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "any maskable"
        },
        {
          src: "/icon-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any maskable"
        }
      ]
    };

    res.setHeader("Content-Type", "application/manifest+json");
    res.json(manifest);
  });

  // Audio Transcription Route (public for client chat)
  app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No audio file provided" });
      }

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const audioFile = await toFile(req.file.buffer, "audio.webm", {
        type: req.file.mimetype || "audio/webm",
      });

      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: "whisper-1",
      });

      res.json({ text: transcription.text });
    } catch (error) {
      console.error("Transcription error:", error);
      res.status(500).json({ error: "Failed to transcribe audio" });
    }
  });

  return httpServer;
}
