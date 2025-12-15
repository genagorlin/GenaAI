import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertMessageSchema, insertInsightSchema, insertClientSchema, insertSentimentDataSchema, insertDocumentSectionSchema, registerClientSchema, insertThreadSchema } from "@shared/schema";
import { setupAuth, isAuthenticated, isAdmin } from "./replitAuth";
import { z } from "zod";
import multer from "multer";
import OpenAI, { toFile } from "openai";

const upload = multer({ storage: multer.memoryStorage() });

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

  // Public endpoint for chat interface - returns limited client info
  app.get("/api/chat/:clientId/info", async (req, res) => {
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

  // Thread Routes (public for client chat interface)
  app.get("/api/clients/:clientId/threads", async (req, res) => {
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

  app.post("/api/clients/:clientId/threads", async (req, res) => {
    try {
      const validated = insertThreadSchema.parse({
        ...req.body,
        clientId: req.params.clientId
      });
      const thread = await storage.createThread(validated);
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

  // Message Routes (public for client chat interface)
  app.get("/api/clients/:clientId/messages", async (req, res) => {
    try {
      const messages = await storage.getClientMessages(req.params.clientId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.post("/api/clients/:clientId/messages", async (req, res) => {
    try {
      const validated = insertMessageSchema.parse({
        ...req.body,
        clientId: req.params.clientId
      });
      const message = await storage.createMessage(validated);
      
      if (validated.role === "user") {
        const { promptAssembler } = await import("./promptAssembler");
        const { routeMessage, generateAIResponse } = await import("./modelRouter");
        
        try {
          const clientContext = await promptAssembler.getClientContext(req.params.clientId);
          const recentMessages = validated.threadId 
            ? await promptAssembler.getThreadMessages(validated.threadId)
            : await promptAssembler.getRecentMessages(req.params.clientId);
          
          const assembled = await promptAssembler.assemblePrompt({
            clientId: req.params.clientId,
            currentMessage: validated.content,
            recentMessages,
            documentSections: clientContext.documentSections,
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
            role: "ai",
            content: aiResponseContent,
            type: "text",
          });
          
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

  // Session End Route (public - called when client session ends)
  app.post("/api/clients/:clientId/session-end", async (req, res) => {
    try {
      const { summarizeSession } = await import("./sessionSummarizer");
      const result = await summarizeSession(req.params.clientId);
      
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
