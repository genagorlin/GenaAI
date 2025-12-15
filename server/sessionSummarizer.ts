import Anthropic from "@anthropic-ai/sdk";
import { storage } from "./storage";
import type { Message, DocumentSection } from "@shared/schema";

const anthropic = new Anthropic({
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
});

interface SectionUpdate {
  sectionId: string;
  newContent: string;
}

export async function summarizeSession(clientId: string): Promise<{ success: boolean; updatedSections: number; error?: string }> {
  try {
    const recentMessages = await storage.getMessagesSinceSummarization(clientId);
    
    if (recentMessages.length < 2) {
      return { success: true, updatedSections: 0 };
    }

    const document = await storage.getOrCreateClientDocument(clientId);
    const sections = await storage.getDocumentSections(document.id);
    
    if (sections.length === 0) {
      return { success: true, updatedSections: 0 };
    }

    const sectionUpdates = await generateSectionUpdates(recentMessages, sections);
    
    for (const update of sectionUpdates) {
      if (update.newContent && update.newContent.trim()) {
        await storage.updateSectionByAI(update.sectionId, update.newContent);
      }
    }
    
    await storage.updateClientLastSummarized(clientId);
    
    return { success: true, updatedSections: sectionUpdates.length };
  } catch (error: any) {
    console.error("[SessionSummarizer] Error:", error);
    return { success: false, updatedSections: 0, error: error.message };
  }
}

async function generateSectionUpdates(messages: Message[], sections: DocumentSection[]): Promise<SectionUpdate[]> {
  const conversationText = messages
    .map(m => `${m.role === "user" ? "Client" : "AI"}: ${m.content}`)
    .join("\n\n");
  
  const sectionsInfo = sections.map(s => ({
    id: s.id,
    title: s.title,
    sectionType: s.sectionType,
    currentContent: s.content || "(empty)",
  }));

  const systemPrompt = `You are an expert coaching assistant helping to maintain a client's living document. 
Your task is to analyze a recent conversation and update relevant document sections with new insights.

Guidelines:
- Only update sections where the conversation provides NEW, MEANINGFUL information
- Preserve existing important content while integrating new insights
- Write in clear, professional language appropriate for coaching notes
- Focus on actionable insights, patterns, and client growth
- Do not add fluff or repeat what's already captured
- If a section doesn't need updating based on this conversation, return its current content unchanged

Current document sections:
${sectionsInfo.map(s => `
### ${s.title} (${s.sectionType})
ID: ${s.id}
Current Content:
${s.currentContent}
`).join("\n")}

Respond with a JSON array of section updates. Each update should have:
- sectionId: the ID of the section to update
- newContent: the updated content (or existing content if no update needed)

Only include sections that have meaningful updates from this conversation.`;

  const userMessage = `Recent conversation to analyze:

${conversationText}

Based on this conversation, generate updates for the relevant document sections. Return a JSON array of updates.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      messages: [{ role: "user", content: userMessage }],
      system: systemPrompt,
    });

    const content = response.content[0];
    if (content.type !== "text") {
      return [];
    }

    const jsonMatch = content.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.log("[SessionSummarizer] No JSON array found in response");
      return [];
    }

    const updates: SectionUpdate[] = JSON.parse(jsonMatch[0]);
    
    const validSectionIds = new Set(sections.map(s => s.id));
    return updates.filter(u => validSectionIds.has(u.sectionId) && u.newContent);
  } catch (error) {
    console.error("[SessionSummarizer] AI generation error:", error);
    return [];
  }
}

const GOODBYE_PATTERNS = [
  /\b(bye|goodbye|goodnight|see you|talk later|gotta go|have to go|signing off|logging off|heading out|ttyl|cya|later)\b/i,
  /\b(thanks?|thank you).*(bye|later|now)\b/i,
  /\b(that'?s all|all for now|done for today|wrap up|wrapping up)\b/i,
];

export function isGoodbyeMessage(content: string): boolean {
  return GOODBYE_PATTERNS.some(pattern => pattern.test(content));
}

export async function updateDocumentRealtime(
  clientId: string, 
  userMessage: string, 
  aiResponse: string
): Promise<{ success: boolean; updatedSections: number }> {
  try {
    const document = await storage.getOrCreateClientDocument(clientId);
    const sections = await storage.getDocumentSections(document.id);
    
    if (sections.length === 0) {
      return { success: true, updatedSections: 0 };
    }

    const sectionsInfo = sections.map(s => ({
      id: s.id,
      title: s.title,
      sectionType: s.sectionType,
      currentContent: s.content || "",
      isEmpty: !s.content || s.content.trim().length < 20,
    }));

    const systemPrompt = `You are maintaining a coaching client's living document in real-time.
Analyze this single exchange and determine if any sections should be updated.

SECTIONS TO UPDATE:
${sectionsInfo.map(s => `
### ${s.title} (${s.sectionType}) ${s.isEmpty ? "[NEEDS CONTENT]" : ""}
ID: ${s.id}
Current: ${s.currentContent || "(empty)"}
`).join("\n")}

GUIDELINES:
- Only update if this exchange reveals NEW meaningful information
- For empty sections, add content if the exchange provides relevant info
- Keep updates concise and additive (append, don't replace unless correcting)
- Overview: High-level summary of who the client is and their journey
- Key Highlights: Notable patterns, breakthroughs, or important moments
- Current Focus Areas: What the client is actively working on right now
- Background & Context: Life history, relationships, career, values

Return a JSON array: [{"sectionId": "...", "newContent": "..."}]
Return [] if no updates needed.`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [{ 
        role: "user", 
        content: `Exchange to analyze:\nClient: ${userMessage}\nAI: ${aiResponse}\n\nGenerate section updates as JSON array.`
      }],
      system: systemPrompt,
    });

    const content = response.content[0];
    if (content.type !== "text") {
      return { success: true, updatedSections: 0 };
    }

    const jsonMatch = content.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return { success: true, updatedSections: 0 };
    }

    const updates: SectionUpdate[] = JSON.parse(jsonMatch[0]);
    const validSectionIds = new Set(sections.map(s => s.id));
    const validUpdates = updates.filter(u => validSectionIds.has(u.sectionId) && u.newContent?.trim());

    for (const update of validUpdates) {
      await storage.updateSectionByAI(update.sectionId, update.newContent);
    }

    if (validUpdates.length > 0) {
      console.log(`[RealtimeUpdate] Client ${clientId}: Updated ${validUpdates.length} sections`);
    }

    return { success: true, updatedSections: validUpdates.length };
  } catch (error: any) {
    console.error("[RealtimeUpdate] Error:", error.message);
    return { success: false, updatedSections: 0 };
  }
}

export function getSectionGapInfo(sections: { title: string; content: string }[]): string {
  const gaps: string[] = [];
  
  for (const section of sections) {
    const isEmpty = !section.content || section.content.trim().length < 30;
    if (isEmpty) {
      gaps.push(section.title);
    }
  }
  
  if (gaps.length === 0) return "";
  
  return `\n\n# Areas to Explore\nThe following areas of the client's profile need more information. When natural, weave questions into the conversation that help gather this context:\n- ${gaps.join("\n- ")}\n\nDo NOT explicitly mention you're gathering information. Let curiosity guide your questions naturally.`;
}
