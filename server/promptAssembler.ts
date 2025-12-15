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
  recentMessages?: { role: string; content: string }[];
  documentSections?: { title: string; content: string }[];
}

const TOKEN_BUDGET = 30000;
const CHARS_PER_TOKEN = 4;

const TOKEN_ALLOCATIONS = {
  rolePrompt: 500,
  methodologyFrame: 2000,
  memoryContext: 15000,
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

    const { getSectionGapInfo } = await import("./sessionSummarizer");
    const gapInfo = getSectionGapInfo(documentSections || []);
    if (gapInfo) {
      systemPromptParts.push(gapInfo);
    }

    const systemPrompt = systemPromptParts.join("\n\n---\n\n");

    const conversationHistory: ConversationMessage[] = [];
    
    if (recentMessages && recentMessages.length > 0) {
      const availableTokens = TOKEN_ALLOCATIONS.conversationBuffer - estimateTokens(currentMessage);
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
        conversationHistory.push({
          role: msg.role === "user" ? "user" : "assistant",
          content: msg.content,
        });
      }
    }

    conversationHistory.push({
      role: "user",
      content: currentMessage,
    });

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
}

export const promptAssembler = new PromptAssembler();
