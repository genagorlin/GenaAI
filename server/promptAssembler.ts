import { storage } from "./storage";

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

interface AssembledPrompt {
  systemPrompt: string;
  conversationHistory: ConversationMessage[];
  estimatedTokens: number;
}

interface PromptContext {
  clientId: string;
  currentMessage: string;
  currentSpeaker?: "client" | "coach"; // Who is sending the current message
  messageAlreadyStored?: boolean; // If true, currentMessage is already in recentMessages
  recentMessages?: { role: string; content: string }[];
  documentSections?: { title: string; content: string }[];
}

const TOKEN_BUDGET = 30000;
const CHARS_PER_TOKEN = 4;

const TOKEN_ALLOCATIONS = {
  rolePrompt: 500,
  methodologyFrame: 2000,
  memoryContext: 12000,
  referenceDocuments: 3000,
  currentInput: 1000,
  taskPrompt: 500,
  conversationBuffer: 11000,
};

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function truncateToTokenLimit(text: string, maxTokens: number): string {
  const maxChars = maxTokens * CHARS_PER_TOKEN;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars - 3) + "...";
}

export class PromptAssembler {
  async assemblePrompt(context: PromptContext): Promise<AssembledPrompt> {
    const { clientId, currentMessage, recentMessages, documentSections } = context;

    const rolePrompt = await storage.getOrCreateRolePrompt(clientId);
    const taskPrompt = await storage.getOrCreateTaskPrompt(clientId);

    const roleSection = truncateToTokenLimit(rolePrompt.content, TOKEN_ALLOCATIONS.rolePrompt);
    
    let methodologySection = "";
    const clientMethodologies = await storage.getClientMethodologies(clientId);
    const activeMethodologies = clientMethodologies.filter(cm => cm.isActive === 1);
    if (activeMethodologies.length > 0) {
      const methodologyContent = activeMethodologies
        .map(cm => `## ${cm.methodology.name}\n${cm.methodology.content}`)
        .join("\n\n");
      methodologySection = truncateToTokenLimit(methodologyContent, TOKEN_ALLOCATIONS.methodologyFrame);
    }

    let memorySection = "";
    if (documentSections && documentSections.length > 0) {
      const goalsContent = documentSections
        .filter(s => s.content && s.content.trim())
        .map(s => `## ${s.title}\n${s.content}`)
        .join("\n\n");
      memorySection = truncateToTokenLimit(goalsContent, TOKEN_ALLOCATIONS.memoryContext);
    }

    // Fetch reference documents (coach's writings for AI to reference)
    let referenceSection = "";
    const referenceDocuments = await storage.getAllReferenceDocuments();
    console.log(`[PromptAssembler] Found ${referenceDocuments.length} reference documents`);
    if (referenceDocuments.length > 0) {
      const refContent = referenceDocuments
        .map(doc => `## "${doc.title}"\n${doc.content}`)
        .join("\n\n");
      referenceSection = truncateToTokenLimit(refContent, TOKEN_ALLOCATIONS.referenceDocuments);
    }

    const taskSection = truncateToTokenLimit(taskPrompt.content, TOKEN_ALLOCATIONS.taskPrompt);

    const systemPromptParts: string[] = [];

    if (roleSection) {
      systemPromptParts.push(`# Your Role\n${roleSection}`);
    }

    if (methodologySection) {
      systemPromptParts.push(`# Coaching Framework\n${methodologySection}`);
    }

    if (referenceSection) {
      systemPromptParts.push(`# Gena's Worldview & Philosophy
The following writings by coach Gena Gorlin define your core perspective and way of thinking. These are not just references to cite—they are the foundation of how you understand and approach coaching conversations.

**How to embody this perspective:**
- Internalize these ideas as your own guiding principles
- Let this worldview shape how you frame questions, observations, and responses
- Think and respond AS IF these principles are deeply true and important
- When ideas from these writings are directly relevant, you may attribute them: "As Gena discusses..." or "This connects to what Gena calls..."
- But more importantly, let this perspective infuse ALL your responses, even when not explicitly citing

${referenceSection}`);
    }

    if (memorySection) {
      systemPromptParts.push(`# Client Context\n${memorySection}`);
    }

    if (taskSection) {
      systemPromptParts.push(`# Response Instructions\n${taskSection}`);
    }

    systemPromptParts.push(`# Three-Way Conversation
This conversation includes three participants:
- **Client**: The person receiving coaching (their messages are prefixed with "[CLIENT]:")
- **Coach (Gena)**: The human coach who may join the conversation (their messages are prefixed with "[COACH]:")
- **You**: The AI thinking partner assistant

IMPORTANT: When the coach sends a message:
- Respond directly to the coach's question or comment
- The coach may ask you to do something specific for the client, give you guidance, or ask about observations
- Be collaborative and helpful to the coach while remaining supportive of the client

When the client sends a message:
- Respond to them as their thinking partner
- If the client mentions @Gena or @Coach, note it for the coach's attention

The coach has full visibility of this conversation. Treat coach messages as coming from a trusted collaborator.`);

    const { getSectionGapInfo } = await import("./sessionSummarizer");
    const gapInfo = getSectionGapInfo(documentSections || []);
    if (gapInfo) {
      systemPromptParts.push(gapInfo);
    }

    const systemPrompt = systemPromptParts.join("\n\n---\n\n");

    const conversationHistory: ConversationMessage[] = [];
    
    if (recentMessages && recentMessages.length > 0) {
      // Only reserve tokens for currentMessage if it's not already stored in recentMessages
      const currentMsgTokens = context.messageAlreadyStored ? 0 : estimateTokens(currentMessage);
      const availableTokens = Math.max(0, TOKEN_ALLOCATIONS.conversationBuffer - currentMsgTokens);
      let usedTokens = 0;
      
      const reversedMessages = [...recentMessages].reverse();
      const selectedMessages: { role: string; content: string }[] = [];
      
      for (const msg of reversedMessages) {
        const msgTokens = estimateTokens(msg.content);
        if (usedTokens + msgTokens > availableTokens) break;
        selectedMessages.unshift(msg);
        usedTokens += msgTokens;
      }
      
      for (const msg of selectedMessages) {
        if (msg.role === "coach") {
          conversationHistory.push({
            role: "user",
            content: `[COACH]: ${msg.content}`,
          });
        } else if (msg.role === "user") {
          conversationHistory.push({
            role: "user",
            content: `[CLIENT]: ${msg.content}`,
          });
        } else {
          conversationHistory.push({
            role: "assistant",
            content: msg.content,
          });
        }
      }
    }

    // Add the current message with appropriate speaker label (unless already stored)
    if (!context.messageAlreadyStored) {
      const speaker = context.currentSpeaker || "client";
      const speakerLabel = speaker === "coach" ? "[COACH]" : "[CLIENT]";
      conversationHistory.push({
        role: "user",
        content: `${speakerLabel}: ${currentMessage}`,
      });
    }

    const totalTokens = 
      estimateTokens(systemPrompt) + 
      conversationHistory.reduce((sum, msg) => sum + estimateTokens(msg.content), 0);

    return {
      systemPrompt,
      conversationHistory,
      estimatedTokens: totalTokens,
    };
  }

  async getClientContext(clientId: string): Promise<{ documentSections: { title: string; content: string }[] }> {
    const document = await storage.getClientDocument(clientId);
    if (!document) {
      return { documentSections: [] };
    }

    const sections = await storage.getDocumentSections(document.id);
    return {
      documentSections: sections.map(s => ({
        title: s.title,
        content: s.content,
      })),
    };
  }

  async getRecentMessages(clientId: string, limit: number = 50): Promise<{ role: string; content: string }[]> {
    const messages = await storage.getClientMessages(clientId);
    return messages
      .slice(-limit)
      .map(m => ({
        role: m.role,
        content: m.content,
      }));
  }

  async getThreadMessages(threadId: string, limit: number = 50): Promise<{ role: string; content: string }[]> {
    const messages = await storage.getThreadMessages(threadId);
    return messages
      .slice(-limit)
      .map(m => ({
        role: m.role,
        content: m.content,
      }));
  }

  async assembleConsultationPrompt(clientId: string): Promise<string> {
    const client = await storage.getClient(clientId);
    const clientName = client?.name || "Unknown Client";
    
    const clientContext = await this.getClientContext(clientId);
    let memorySection = "";
    if (clientContext.documentSections && clientContext.documentSections.length > 0) {
      const goalsContent = clientContext.documentSections
        .filter(s => s.content && s.content.trim())
        .map(s => `## ${s.title}\n${s.content}`)
        .join("\n\n");
      memorySection = truncateToTokenLimit(goalsContent, TOKEN_ALLOCATIONS.memoryContext);
    }

    const recentMessages = await this.getRecentMessages(clientId, 30);
    let recentConversations = "";
    if (recentMessages.length > 0) {
      recentConversations = recentMessages
        .map(m => `${m.role.toUpperCase()}: ${m.content}`)
        .join("\n\n");
      recentConversations = truncateToTokenLimit(recentConversations, 8000);
    }

    const systemPromptParts: string[] = [];

    systemPromptParts.push(`# Private Coach Consultation
You are now in a private consultation with the coach (Gena) about their client, ${clientName}. This conversation is completely separate from the client-facing interactions.

The coach is asking you questions about their client to:
- Better understand the client's patterns, themes, or struggles
- Get insights or observations you've noticed
- Discuss strategies for upcoming sessions
- Explore what might be helpful for the client

Be direct, insightful, and collaborative. You can share observations, patterns you've noticed, and thoughtful suggestions. This is a professional discussion between two people trying to help the client.`);

    if (memorySection) {
      systemPromptParts.push(`# Client Profile (Living Document)\n${memorySection}`);
    }

    if (recentConversations) {
      systemPromptParts.push(`# Recent Client-AI Conversations\n${recentConversations}`);
    }

    systemPromptParts.push(`# Response Guidelines
- Be concise but thorough
- Share specific observations from conversations
- Offer actionable insights
- Be honest about uncertainty
- Support the coach's thinking process`);

    return systemPromptParts.join("\n\n---\n\n");
  }

  async assembleOpeningPrompt(clientId: string): Promise<{ systemPrompt: string }> {
    const rolePrompt = await storage.getOrCreateRolePrompt(clientId);
    const taskPrompt = await storage.getOrCreateTaskPrompt(clientId);
    const client = await storage.getClient(clientId);

    const roleSection = truncateToTokenLimit(rolePrompt.content, TOKEN_ALLOCATIONS.rolePrompt);
    
    let methodologySection = "";
    const clientMethodologies = await storage.getClientMethodologies(clientId);
    const activeMethodologies = clientMethodologies.filter(cm => cm.isActive === 1);
    if (activeMethodologies.length > 0) {
      const methodologyContent = activeMethodologies
        .map(cm => `## ${cm.methodology.name}\n${cm.methodology.content}`)
        .join("\n\n");
      methodologySection = truncateToTokenLimit(methodologyContent, TOKEN_ALLOCATIONS.methodologyFrame);
    }

    const clientContext = await this.getClientContext(clientId);
    let memorySection = "";
    if (clientContext.documentSections && clientContext.documentSections.length > 0) {
      const goalsContent = clientContext.documentSections
        .filter(s => s.content && s.content.trim())
        .map(s => `## ${s.title}\n${s.content}`)
        .join("\n\n");
      memorySection = truncateToTokenLimit(goalsContent, TOKEN_ALLOCATIONS.memoryContext);
    }

    const taskSection = truncateToTokenLimit(taskPrompt.content, TOKEN_ALLOCATIONS.taskPrompt);

    const systemPromptParts: string[] = [];

    if (roleSection) {
      systemPromptParts.push(`# Your Role\n${roleSection}`);
    }

    if (methodologySection) {
      systemPromptParts.push(`# Coaching Framework\n${methodologySection}`);
    }

    if (memorySection) {
      systemPromptParts.push(`# Client Context\n${memorySection}`);
    }

    if (taskSection) {
      systemPromptParts.push(`# Response Instructions\n${taskSection}`);
    }

    const clientName = client?.name?.split(' ')[0] || 'there';
    systemPromptParts.push(`# Opening Message Task\nGenerate an opening message for this new conversation with ${clientName}. Follow the Response Instructions above exactly for how to greet them. This is the very start of a new conversation thread - there is no prior context from the user yet. Ignore any placeholder input and simply deliver your opening greeting as instructed.`);

    const systemPrompt = systemPromptParts.join("\n\n---\n\n");

    return { systemPrompt };
  }
}

export const promptAssembler = new PromptAssembler();
