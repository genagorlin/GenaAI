import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertMessageSchema, insertInsightSchema, insertClientSchema, insertSentimentDataSchema, insertDocumentSectionSchema, registerClientSchema, insertThreadSchema, insertReminderTemplateSchema, insertClientReminderSchema, users } from "@shared/schema";
import { setupAuth, isAuthenticated, isClientAuthenticated, isAdmin, verifyClientAccess } from "./magicLinkAuth";
import { z } from "zod";
import multer from "multer";
import OpenAI, { toFile } from "openai";
import { detectCoachMention } from "./mentionDetector";
import { db } from "./db";
import { eq } from "drizzle-orm";

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

  // Auth routes - use isClientAuthenticated to allow both coaches and clients
  app.get('/api/auth/user', isClientAuthenticated, async (req: any, res) => {
    try {
      const email = req.user.claims.email;
      // Look up user by email (not ID) since migrated users have different IDs
      const [user] = await db.select().from(users).where(eq(users.email, email));
      if (!user) {
        // Create user if doesn't exist
        const [newUser] = await db.insert(users).values({
          id: email,
          email,
          firstName: null,
          lastName: null,
          profileImageUrl: null,
        }).returning();
        return res.json(newUser);
      }
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Auth status check (no middleware - returns auth state)
  app.get('/api/auth/status', (req: any, res) => {
    const session = req.session as any;
    const isAuth = !!session?.user?.email;
    res.json({
      authenticated: isAuth,
      email: isAuth ? session.user.email : null,
      role: isAuth ? session.user.role : null,
      clientId: isAuth ? session.user.clientId : null,
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

  // Public endpoint for web client self-registration
  app.post("/api/clients/register-web", async (req, res) => {
    try {
      const { name, email, about } = z.object({
        name: z.string().min(1, "Name is required"),
        email: z.string().email("Valid email is required"),
        about: z.string().optional(),
      }).parse(req.body);

      const normalizedEmail = email.toLowerCase().trim();
      const trimmedName = name.trim();
      const trimmedAbout = about?.trim();

      // Check if client already exists
      const existingClient = await storage.getClientByEmail(normalizedEmail);

      if (!existingClient) {
        // Create new client
        const newClient = await storage.createClient({
          name: trimmedName,
          email: normalizedEmail,
        });
        console.log(`[Registration] New web client created: ${trimmedName} (${normalizedEmail})`);

        // If they provided an "about" response, create their document with an About Me section
        if (trimmedAbout) {
          try {
            const document = await storage.getOrCreateClientDocument(newClient.id);
            await storage.createSection({
              documentId: document.id,
              sectionType: "context",
              title: "About Me",
              content: trimmedAbout,
              sortOrder: -1, // Put it at the top
              lastUpdatedBy: "client",
            });
            console.log(`[Registration] Created About Me section for client ${newClient.id}`);
          } catch (docError) {
            console.error(`[Registration] Failed to create About Me section:`, docError);
            // Don't fail registration if document creation fails
          }
        }
      } else {
        console.log(`[Registration] Existing client requested magic link: ${normalizedEmail}`);
      }

      // Send magic link regardless of whether client existed (prevents email enumeration)
      const { createMagicLinkToken, sendMagicLinkEmail } = await import("./magicLinkAuth");
      const { token, code } = await createMagicLinkToken(normalizedEmail);
      const emailResult = await sendMagicLinkEmail(normalizedEmail, token, code);

      if (!emailResult.success) {
        console.error(`[Registration] Failed to send magic link to ${normalizedEmail}:`, emailResult.error);
        // Still return success to prevent email enumeration
      }

      // Always return success for security
      res.json({ success: true, message: "If this email is valid, you will receive a sign-in link." });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: error.errors[0]?.message || "Invalid input" });
      }
      console.error("Web registration error:", error);
      res.status(500).json({ error: "Registration failed" });
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
      const message = await storage.createMessage({ ...validated, mentionsCoach });
      
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
          
          console.log(`[AI] Exercise context for thread ${validated.threadId}:`, exerciseContext ? `exercise="${exerciseContext.exerciseTitle}", step=${exerciseContext.currentStepOrder}` : 'none');
          
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
      // Use getThreadExerciseSession to return any session (including completed)
      const session = await storage.getThreadExerciseSession(
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
      res.status(500).json({ error: "Failed to fetch exercise session" });
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

  // Exercise Step Responses - Survey-style exercise flow
  app.get("/api/exercise-sessions/:sessionId/responses", async (req, res) => {
    try {
      const responses = await storage.getSessionStepResponses(req.params.sessionId);
      res.json(responses);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch step responses" });
    }
  });

  app.get("/api/exercise-sessions/:sessionId/responses/:stepId", async (req, res) => {
    try {
      const response = await storage.getStepResponse(req.params.sessionId, req.params.stepId);
      res.json(response || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch step response" });
    }
  });

  app.put("/api/exercise-sessions/:sessionId/responses/:stepId", async (req, res) => {
    try {
      const { response, status } = req.body;
      const stepResponse = await storage.upsertStepResponse({
        sessionId: req.params.sessionId,
        stepId: req.params.stepId,
        response: response || "",
        status: status || "in_progress",
      });
      res.json(stepResponse);
    } catch (error) {
      console.error("Upsert step response error:", error);
      res.status(400).json({ error: "Failed to save step response" });
    }
  });

  // AI Guidance for specific step
  app.post("/api/exercise-sessions/:sessionId/responses/:stepId/guidance", async (req, res) => {
    try {
      const { message } = req.body;
      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      const session = await storage.getExerciseSession(req.params.sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      const step = await storage.getExerciseStep(req.params.stepId);
      if (!step) {
        return res.status(404).json({ error: "Step not found" });
      }

      const exercise = await storage.getGuidedExercise(session.exerciseId);
      const stepResponse = await storage.getStepResponse(req.params.sessionId, req.params.stepId);

      // Build guidance conversation history
      const existingGuidance = (stepResponse?.aiGuidance as any[]) || [];
      const newGuidance = [
        ...existingGuidance,
        { role: "user", content: message, timestamp: new Date().toISOString() }
      ];

      // Generate AI response
      const { generateAIResponse } = await import("./modelRouter");

      const systemPrompt = `You are a supportive coaching assistant helping a client through an exercise called "${exercise?.title || 'this exercise'}".

Current step: ${step.title}
Instructions: ${step.instructions}
${step.completionCriteria ? `Completion criteria: ${step.completionCriteria}` : ''}
${step.supportingMaterial ? `Supporting material: ${step.supportingMaterial}` : ''}

The client's current response to this step:
"${stepResponse?.response || '(no response yet)'}"

Your role:
- Stay focused on THIS specific step
- Defer to the step instructions - don't add your own requirements
- Gently prompt if the client seems stuck or has missed key parts of the instructions
- Keep responses brief and supportive (2-4 sentences typically)
- Don't repeat what the client has already written unless clarifying`;

      const conversationHistory = existingGuidance.map((g: any) => ({
        role: g.role === "user" ? "user" as const : "assistant" as const,
        content: g.content
      }));
      conversationHistory.push({ role: "user" as const, content: message });

      const aiResponse = await generateAIResponse({
        systemPrompt,
        conversationHistory,
        model: "claude-sonnet-4-5",
        provider: "anthropic",
      });

      // Add AI response to guidance history
      newGuidance.push({ role: "ai", content: aiResponse, timestamp: new Date().toISOString() });

      // Save updated guidance
      if (stepResponse) {
        await storage.updateStepResponseGuidance(stepResponse.id, newGuidance);
      } else {
        // Create step response if it doesn't exist
        await storage.upsertStepResponse({
          sessionId: req.params.sessionId,
          stepId: req.params.stepId,
          response: "",
          status: "in_progress",
          aiGuidance: newGuidance,
        });
      }

      console.log(`[Exercise] AI guidance for session ${req.params.sessionId}, step ${req.params.stepId}`);
      res.json({ guidance: newGuidance, latestResponse: aiResponse });
    } catch (error) {
      console.error("Step guidance error:", error);
      res.status(500).json({ error: "Failed to get AI guidance" });
    }
  });

  // Generate exercise summary
  app.post("/api/exercise-sessions/:sessionId/summary", async (req, res) => {
    try {
      const session = await storage.getExerciseSession(req.params.sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      const exercise = await storage.getGuidedExercise(session.exerciseId);
      const steps = await storage.getExerciseSteps(session.exerciseId);
      const responses = await storage.getSessionStepResponses(req.params.sessionId);

      // Build summary of all responses
      const responseSummary = steps.map(step => {
        const response = responses.find(r => r.stepId === step.id);
        return {
          stepTitle: step.title,
          response: response?.response || "(skipped)",
          status: response?.status || "skipped"
        };
      });

      // Generate AI summary
      const { generateAIResponse } = await import("./modelRouter");

      const systemPrompt = `You are a thoughtful coaching assistant creating a summary of a client's completed exercise.

Exercise: ${exercise?.title || 'Coaching Exercise'}
${exercise?.description ? `Description: ${exercise.description}` : ''}

The client's responses to each step:
${responseSummary.map(r => `
### ${r.stepTitle}
${r.status === "skipped" ? "(Client skipped this step)" : r.response}
`).join('\n')}

Create a brief, supportive summary (3-5 sentences) that:
- Synthesizes the key themes from their responses
- Stays close to the client's own words and insights
- Highlights any patterns or connections you notice
- Ends with an encouraging observation about their reflection

Do NOT:
- Add new advice or suggestions
- Be overly complimentary
- Make assumptions beyond what they wrote`;

      const summary = await generateAIResponse({
        systemPrompt,
        conversationHistory: [{ role: "user", content: "Please summarize my exercise responses." }],
        model: "claude-sonnet-4-5",
        provider: "anthropic",
      });

      // Save summary to session
      await storage.updateExerciseSession(req.params.sessionId, {
        summary,
        status: "completed",
        completedAt: new Date()
      });

      console.log(`[Exercise] Generated summary for session ${req.params.sessionId}`);
      res.json({ summary });
    } catch (error) {
      console.error("Generate summary error:", error);
      res.status(500).json({ error: "Failed to generate summary" });
    }
  });

  // Get session with full data for exercise player
  app.get("/api/exercise-sessions/:sessionId/full", async (req, res) => {
    try {
      const session = await storage.getExerciseSession(req.params.sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      const exercise = await storage.getGuidedExercise(session.exerciseId);
      const steps = await storage.getExerciseSteps(session.exerciseId);
      const responses = await storage.getSessionStepResponses(req.params.sessionId);

      res.json({ session, exercise, steps, responses });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch exercise session" });
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

  // ============ SURVEY EXERCISES ROUTES ============

  // Survey Exercises - Public endpoints for clients
  app.get("/api/surveys", async (_req, res) => {
    try {
      const surveys = await storage.getPublishedSurveyExercises();
      res.json(surveys);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch surveys" });
    }
  });

  app.get("/api/surveys/:id", async (req, res) => {
    try {
      const survey = await storage.getSurveyExercise(req.params.id);
      if (!survey) {
        return res.status(404).json({ error: "Survey not found" });
      }
      const questions = await storage.getSurveyQuestions(req.params.id);
      res.json({ ...survey, questions });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch survey" });
    }
  });

  // Client survey sessions
  app.get("/api/clients/:clientId/survey-sessions", verifyClientAccess((req) => req.params.clientId), async (req, res) => {
    try {
      const sessions = await storage.getClientSurveySessions(req.params.clientId);
      res.json(sessions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch survey sessions" });
    }
  });

  app.get("/api/clients/:clientId/survey-sessions/:surveyId/active", verifyClientAccess((req) => req.params.clientId), async (req, res) => {
    try {
      const session = await storage.getActiveSurveySession(req.params.clientId, req.params.surveyId);
      res.json(session || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch active survey session" });
    }
  });

  app.post("/api/clients/:clientId/survey-sessions", verifyClientAccess((req) => req.params.clientId), async (req, res) => {
    try {
      const { insertSurveySessionSchema } = await import("@shared/schema");
      const validated = insertSurveySessionSchema.parse({
        ...req.body,
        clientId: req.params.clientId,
      });
      const session = await storage.createSurveySession(validated);
      console.log(`[Survey] Client ${req.params.clientId} started survey session: ${session.id}`);
      res.status(201).json(session);
    } catch (error) {
      console.error("Create survey session error:", error);
      res.status(400).json({ error: "Failed to start survey session" });
    }
  });

  app.get("/api/survey-sessions/:id", async (req, res) => {
    try {
      const session = await storage.getSurveySession(req.params.id);
      if (!session) {
        return res.status(404).json({ error: "Survey session not found" });
      }
      const responses = await storage.getSessionResponses(req.params.id);
      res.json({ ...session, responses });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch survey session" });
    }
  });

  app.patch("/api/survey-sessions/:id", async (req, res) => {
    try {
      const session = await storage.updateSurveySession(req.params.id, req.body);
      console.log(`[Survey] Updated session ${req.params.id}: ${JSON.stringify(req.body)}`);
      res.json(session);
    } catch (error) {
      console.error("Update survey session error:", error);
      res.status(400).json({ error: "Failed to update survey session" });
    }
  });

  // Survey responses
  app.post("/api/survey-sessions/:sessionId/responses", async (req, res) => {
    try {
      const { insertSurveyResponseSchema } = await import("@shared/schema");
      const validated = insertSurveyResponseSchema.parse({
        ...req.body,
        sessionId: req.params.sessionId,
      });
      // Check if response already exists (update) or create new
      const existing = await storage.getSurveyResponse(req.params.sessionId, validated.questionId);
      if (existing) {
        const updated = await storage.updateSurveyResponse(existing.id, validated);
        res.json(updated);
      } else {
        const response = await storage.createSurveyResponse(validated);
        res.status(201).json(response);
      }
    } catch (error) {
      console.error("Create/update survey response error:", error);
      res.status(400).json({ error: "Failed to save survey response" });
    }
  });

  app.get("/api/survey-sessions/:sessionId/responses", async (req, res) => {
    try {
      const responses = await storage.getSessionResponses(req.params.sessionId);
      res.json(responses);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch survey responses" });
    }
  });

  app.post("/api/ai/summarize-survey", async (req: any, res) => {
    try {
      if (!req.session?.user?.email) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { responses, prompt } = req.body;
      if (!responses || !prompt) {
        return res.status(400).json({ error: "Missing responses or prompt" });
      }

      const { OpenAI } = await import("openai");
      const openai = new OpenAI({ apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY });

      const systemPrompt = `You are a thoughtful coaching assistant. Your task is to summarize survey responses for a coaching client. ${prompt}`;
      const userMessage = `Here are the survey responses:\n\n${responses}`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        max_tokens: 500,
        temperature: 0.7
      });

      const summary = completion.choices[0]?.message?.content || "Unable to generate summary";
      res.json({ summary });
    } catch (error) {
      console.error("Survey summarization error:", error);
      res.status(500).json({ error: "Failed to generate summary" });
    }
  });

  // Survey Exercises - Coach management (protected)
  app.get("/api/coach/surveys", isAuthenticated, async (_req, res) => {
    try {
      const surveys = await storage.getAllSurveyExercises();
      res.json(surveys);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch surveys" });
    }
  });

  app.get("/api/coach/surveys/:id", isAuthenticated, async (req, res) => {
    try {
      const survey = await storage.getSurveyExercise(req.params.id);
      if (!survey) {
        return res.status(404).json({ error: "Survey not found" });
      }
      const questions = await storage.getSurveyQuestions(req.params.id);
      res.json({ ...survey, questions });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch survey" });
    }
  });

  app.post("/api/coach/surveys", isAuthenticated, async (req, res) => {
    try {
      const { insertSurveyExerciseSchema } = await import("@shared/schema");
      const validated = insertSurveyExerciseSchema.parse(req.body);
      const survey = await storage.createSurveyExercise(validated);
      console.log(`[Survey] Coach created survey: ${survey.title}`);
      res.status(201).json(survey);
    } catch (error) {
      console.error("Create survey error:", error);
      res.status(400).json({ error: "Failed to create survey" });
    }
  });

  app.patch("/api/coach/surveys/:id", isAuthenticated, async (req, res) => {
    try {
      const survey = await storage.updateSurveyExercise(req.params.id, req.body);
      console.log(`[Survey] Coach updated survey: ${survey.title}`);
      res.json(survey);
    } catch (error) {
      console.error("Update survey error:", error);
      res.status(400).json({ error: "Failed to update survey" });
    }
  });

  app.delete("/api/coach/surveys/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteSurveyExercise(req.params.id);
      console.log(`[Survey] Coach deleted survey: ${req.params.id}`);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete survey" });
    }
  });

  // Survey Questions Routes (coach)
  app.get("/api/coach/surveys/:surveyId/questions", isAuthenticated, async (req, res) => {
    try {
      const questions = await storage.getSurveyQuestions(req.params.surveyId);
      res.json(questions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch survey questions" });
    }
  });

  app.post("/api/coach/surveys/:surveyId/questions", isAuthenticated, async (req, res) => {
    try {
      const { insertSurveyQuestionSchema } = await import("@shared/schema");
      const validated = insertSurveyQuestionSchema.parse({
        ...req.body,
        surveyId: req.params.surveyId,
      });
      const question = await storage.createSurveyQuestion(validated);
      console.log(`[Survey] Coach added question to survey ${req.params.surveyId}`);
      res.status(201).json(question);
    } catch (error) {
      console.error("Create question error:", error);
      res.status(400).json({ error: "Failed to create survey question" });
    }
  });

  app.patch("/api/coach/questions/:id", isAuthenticated, async (req, res) => {
    try {
      const question = await storage.updateSurveyQuestion(req.params.id, req.body);
      console.log(`[Survey] Coach updated question: ${req.params.id}`);
      res.json(question);
    } catch (error) {
      console.error("Update question error:", error);
      res.status(400).json({ error: "Failed to update survey question" });
    }
  });

  app.delete("/api/coach/questions/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteSurveyQuestion(req.params.id);
      console.log(`[Survey] Coach deleted question: ${req.params.id}`);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete survey question" });
    }
  });

  app.post("/api/coach/surveys/:surveyId/reorder-questions", isAuthenticated, async (req, res) => {
    try {
      const { questionIds } = req.body;
      if (!Array.isArray(questionIds)) {
        return res.status(400).json({ error: "questionIds must be an array" });
      }
      await storage.reorderSurveyQuestions(req.params.surveyId, questionIds);
      console.log(`[Survey] Coach reordered questions for survey ${req.params.surveyId}`);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to reorder survey questions" });
    }
  });

  // ============ EMAIL REMINDERS ROUTES ============

  // Reminder Templates (coach)
  app.get("/api/coach/reminder-templates", isAuthenticated, async (_req, res) => {
    try {
      const templates = await storage.getAllReminderTemplates();
      res.json(templates);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch reminder templates" });
    }
  });

  app.get("/api/coach/reminder-templates/:id", isAuthenticated, async (req, res) => {
    try {
      const template = await storage.getReminderTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch reminder template" });
    }
  });

  app.post("/api/coach/reminder-templates", isAuthenticated, async (req, res) => {
    try {
      const validated = insertReminderTemplateSchema.parse(req.body);
      const template = await storage.createReminderTemplate(validated);
      console.log(`[Reminder] Coach created template: ${template.title}`);
      res.status(201).json(template);
    } catch (error) {
      console.error("Create reminder template error:", error);
      res.status(400).json({ error: "Failed to create reminder template" });
    }
  });

  app.patch("/api/coach/reminder-templates/:id", isAuthenticated, async (req, res) => {
    try {
      const template = await storage.updateReminderTemplate(req.params.id, req.body);
      console.log(`[Reminder] Coach updated template: ${template.title}`);
      res.json(template);
    } catch (error) {
      console.error("Update reminder template error:", error);
      res.status(400).json({ error: "Failed to update reminder template" });
    }
  });

  app.delete("/api/coach/reminder-templates/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteReminderTemplate(req.params.id);
      console.log(`[Reminder] Coach deleted template: ${req.params.id}`);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete reminder template" });
    }
  });

  // Preview template with sample data
  app.post("/api/coach/reminder-templates/:id/preview", isAuthenticated, async (req, res) => {
    try {
      const template = await storage.getReminderTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }

      // Use sample data for preview
      const sampleData = {
        clientName: "Sample Client",
        clientFirstName: "Sample",
        coachName: "Coach",
        lastActiveDate: new Date().toLocaleDateString(),
        daysSinceLastActive: "3",
      };

      // Replace variables in subject and body
      let subject = template.subject;
      let body = template.body;
      for (const [key, value] of Object.entries(sampleData)) {
        const regex = new RegExp(`{{${key}}}`, "g");
        subject = subject.replace(regex, value);
        body = body.replace(regex, value);
      }

      res.json({ subject, body });
    } catch (error) {
      res.status(500).json({ error: "Failed to preview template" });
    }
  });

  // Get clients assigned to a template
  app.get("/api/coach/reminder-templates/:id/clients", isAuthenticated, async (req, res) => {
    try {
      const assignments = await storage.getClientsWithTemplate(req.params.id);
      res.json(assignments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch template assignments" });
    }
  });

  // Bulk assign template to multiple clients
  app.post("/api/coach/reminder-templates/:id/assign", isAuthenticated, async (req, res) => {
    try {
      const { clientIds, scheduleType, scheduleTime, scheduleDays, customIntervalDays } = req.body;

      if (!Array.isArray(clientIds) || clientIds.length === 0) {
        return res.status(400).json({ error: "clientIds must be a non-empty array" });
      }

      const { initializeReminderSchedule } = await import("./reminderScheduler");
      const results = [];
      for (const clientId of clientIds) {
        const client = await storage.getClient(clientId);
        if (!client) continue;

        const tz = client.timezone || "America/New_York";
        const sType = scheduleType || "weekly";
        const sTime = scheduleTime || "09:00";
        const sDays = scheduleDays || ["monday"];

        const nextScheduledAt = initializeReminderSchedule({
          scheduleType: sType,
          scheduleTime: sTime,
          scheduleDays: sDays,
          customIntervalDays,
          timezone: tz,
        });

        const reminder = await storage.createClientReminder({
          clientId,
          templateId: req.params.id,
          scheduleType: sType,
          scheduleDays: sDays,
          scheduleTime: sTime,
          customIntervalDays,
          timezone: tz,
          nextScheduledAt,
        });
        results.push(reminder);
      }

      console.log(`[Reminder] Coach assigned template ${req.params.id} to ${results.length} clients`);
      res.status(201).json(results);
    } catch (error) {
      console.error("Bulk assign template error:", error);
      res.status(400).json({ error: "Failed to assign template to clients" });
    }
  });

  // Client Reminders
  app.get("/api/coach/clients/:clientId/reminders", isAuthenticated, async (req, res) => {
    try {
      const reminders = await storage.getClientReminders(req.params.clientId);
      res.json(reminders);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch client reminders" });
    }
  });

  app.post("/api/coach/clients/:clientId/reminders", isAuthenticated, async (req, res) => {
    try {
      const client = await storage.getClient(req.params.clientId);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }

      const { initializeReminderSchedule } = await import("./reminderScheduler");
      const tz = req.body.timezone || client.timezone || "America/New_York";

      const nextScheduledAt = initializeReminderSchedule({
        scheduleType: req.body.scheduleType,
        scheduleTime: req.body.scheduleTime,
        scheduleDays: req.body.scheduleDays,
        customIntervalDays: req.body.customIntervalDays,
        timezone: tz,
      });

      const validated = insertClientReminderSchema.parse({
        ...req.body,
        clientId: req.params.clientId,
        timezone: tz,
        nextScheduledAt,
      });
      const reminder = await storage.createClientReminder(validated);
      console.log(`[Reminder] Coach assigned reminder to client ${req.params.clientId}`);
      res.status(201).json(reminder);
    } catch (error) {
      console.error("Create client reminder error:", error);
      res.status(400).json({ error: "Failed to create client reminder" });
    }
  });

  app.patch("/api/coach/reminders/:id", isAuthenticated, async (req, res) => {
    try {
      const reminder = await storage.updateClientReminder(req.params.id, req.body);
      console.log(`[Reminder] Coach updated reminder: ${req.params.id}`);
      res.json(reminder);
    } catch (error) {
      console.error("Update reminder error:", error);
      res.status(400).json({ error: "Failed to update reminder" });
    }
  });

  app.delete("/api/coach/reminders/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteClientReminder(req.params.id);
      console.log(`[Reminder] Coach deleted reminder: ${req.params.id}`);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete reminder" });
    }
  });

  // Pause reminder
  app.post("/api/coach/reminders/:id/pause", isAuthenticated, async (req, res) => {
    try {
      const { pausedUntil } = req.body;
      const reminder = await storage.updateClientReminder(req.params.id, {
        isPaused: 1,
        pausedUntil: pausedUntil ? new Date(pausedUntil) : null,
      });
      console.log(`[Reminder] Paused reminder ${req.params.id}${pausedUntil ? ` until ${pausedUntil}` : ''}`);
      res.json(reminder);
    } catch (error) {
      res.status(500).json({ error: "Failed to pause reminder" });
    }
  });

  // Resume reminder
  app.post("/api/coach/reminders/:id/resume", isAuthenticated, async (req, res) => {
    try {
      const reminder = await storage.updateClientReminder(req.params.id, {
        isPaused: 0,
        pausedUntil: null,
      });
      console.log(`[Reminder] Resumed reminder ${req.params.id}`);
      res.json(reminder);
    } catch (error) {
      res.status(500).json({ error: "Failed to resume reminder" });
    }
  });

  // Send test email to coach
  app.post("/api/coach/reminders/:id/send-test", isAuthenticated, async (req: any, res) => {
    try {
      const reminder = await storage.getClientReminder(req.params.id);
      if (!reminder) {
        return res.status(404).json({ error: "Reminder not found" });
      }

      const template = await storage.getReminderTemplate(reminder.templateId);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }

      const client = await storage.getClient(reminder.clientId);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }

      // Get coach email from session
      const coachEmail = req.session?.user?.email;
      if (!coachEmail) {
        return res.status(401).json({ error: "Coach email not found in session" });
      }

      // Send test email using the reminder email service
      const { sendReminderEmail } = await import("./reminderEmail");
      const result = await sendReminderEmail({
        to: coachEmail,
        subject: `[TEST] ${reminder.subjectOverride || template.subject}`,
        body: reminder.bodyOverride || template.body,
        clientName: client.name,
        coachName: "Coach",
      });

      if (result.success) {
        console.log(`[Reminder] Sent test email to ${coachEmail}`);
        res.json({ success: true, message: "Test email sent to coach" });
      } else {
        res.status(500).json({ error: result.error || "Failed to send test email" });
      }
    } catch (error: any) {
      console.error("Send test reminder error:", error);
      res.status(500).json({ error: error.message || "Failed to send test email" });
    }
  });

  // Reminder History
  app.get("/api/coach/clients/:clientId/reminder-history", isAuthenticated, async (req, res) => {
    try {
      const history = await storage.getClientReminderHistory(req.params.clientId);
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch reminder history" });
    }
  });

  // Client Timezone
  app.patch("/api/coach/clients/:clientId/timezone", isAuthenticated, async (req, res) => {
    try {
      const { timezone } = z.object({ timezone: z.string() }).parse(req.body);
      await storage.updateClientTimezone(req.params.clientId, timezone);
      console.log(`[Client] Updated timezone for ${req.params.clientId}: ${timezone}`);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Failed to update timezone" });
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
      name: "GenaAI - AI Coaching Journal",
      short_name: "GenaAI",
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

  // Contact Gena - sends feedback email
  app.post("/api/contact-gena", async (req, res) => {
    try {
      const { message, clientId } = z.object({
        message: z.string().min(1, "Message is required"),
        clientId: z.string().optional(),
      }).parse(req.body);

      // Get client info if clientId provided
      let clientInfo = "";
      if (clientId) {
        const client = await storage.getClient(clientId);
        if (client) {
          clientInfo = `\n\nFrom: ${client.name} (${client.email || "no email"})`;
        }
      }

      // Get sender email from session if available
      const session = req.session as any;
      const senderEmail = session?.user?.email;
      if (senderEmail && !clientInfo) {
        clientInfo = `\n\nFrom: ${senderEmail}`;
      }

      // Send email using Resend
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      const emailFrom = process.env.EMAIL_FROM || "onboarding@resend.dev";

      await resend.emails.send({
        from: emailFrom,
        to: "gena.gorlin@gmail.com",
        subject: "GenaAI Feedback",
        text: `${message}${clientInfo}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #333; margin-bottom: 16px;">New feedback from GenaAI</h2>
            <div style="background-color: #f3f4f6; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
              <p style="color: #374151; white-space: pre-wrap; margin: 0;">${message}</p>
            </div>
            ${clientInfo ? `<p style="color: #6b7280; font-size: 14px;">${clientInfo.trim()}</p>` : ""}
          </div>
        `,
      });

      console.log(`[Contact] Feedback sent from ${senderEmail || clientId || "anonymous"}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Contact Gena error:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Message is required" });
      }
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  // Text-to-Speech Route (public for client chat)
  app.post("/api/tts", async (req, res) => {
    try {
      const { text, voice = "alloy" } = req.body;
      
      if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "Text is required" });
      }

      if (!process.env.OPENAI_API_KEY) {
        console.error("[TTS] OPENAI_API_KEY not configured");
        return res.status(500).json({ error: "Voice synthesis not configured" });
      }

      // Limit text length to prevent excessive costs (roughly 4000 chars = ~$0.06)
      const truncatedText = text.slice(0, 4000);
      console.log("[TTS] Generating speech for", truncatedText.length, "characters");

      const openai = new OpenAI({ 
        apiKey: process.env.OPENAI_API_KEY 
      });

      const mp3 = await openai.audio.speech.create({
        model: "tts-1",
        voice: voice as "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer",
        input: truncatedText,
      });

      // Get the audio as a buffer
      const buffer = Buffer.from(await mp3.arrayBuffer());
      
      console.log("[TTS] Generated audio:", buffer.length, "bytes");
      
      // Send as base64 for easy client-side handling
      res.json({ 
        audio: buffer.toString("base64"),
        format: "mp3"
      });
    } catch (error: any) {
      console.error("[TTS] Error:", error?.message || error);
      res.status(500).json({ error: "Failed to generate speech", details: error?.message });
    }
  });

  // Audio Transcription Route (public for client chat)
  app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
    try {
      if (!req.file) {
        console.log("[Transcribe] No audio file in request");
        return res.status(400).json({ error: "No audio file provided" });
      }

      console.log("[Transcribe] Received audio:", req.file.originalname, req.file.mimetype, req.file.size, "bytes");

      if (!process.env.OPENAI_API_KEY) {
        console.error("[Transcribe] OPENAI_API_KEY not configured");
        return res.status(500).json({ error: "Voice transcription not configured" });
      }

      // Use the user's OpenAI API key for Whisper transcription
      // The Replit AI integration doesn't support audio APIs, so we need the direct key
      const openai = new OpenAI({ 
        apiKey: process.env.OPENAI_API_KEY 
      });

      // Determine file extension from mime type or original name
      const mimeType = req.file.mimetype || "audio/webm";
      let ext = "webm";
      if (mimeType.includes("mp4") || mimeType.includes("m4a")) ext = "m4a";
      else if (mimeType.includes("ogg")) ext = "ogg";
      else if (mimeType.includes("wav")) ext = "wav";
      else if (mimeType.includes("mpeg") || mimeType.includes("mp3")) ext = "mp3";
      
      const filename = `audio.${ext}`;
      console.log("[Transcribe] Converting to file:", filename, "mimeType:", mimeType);

      const audioFile = await toFile(req.file.buffer, filename, {
        type: mimeType,
      });

      console.log("[Transcribe] Sending to Whisper API...");
      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: "whisper-1",
      });

      console.log("[Transcribe] Result:", transcription.text?.substring(0, 100));
      res.json({ text: transcription.text });
    } catch (error: any) {
      console.error("[Transcribe] Error:", error?.message || error);
      console.error("[Transcribe] Full error:", JSON.stringify(error, null, 2));
      res.status(500).json({ error: "Failed to transcribe audio", details: error?.message });
    }
  });

  return httpServer;
}
