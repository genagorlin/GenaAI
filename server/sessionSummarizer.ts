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
    console.log(`[SessionSummarizer] Client ${clientId}: Found ${recentMessages.length} messages since last summarization`);
    
    if (recentMessages.length < 2) {
      console.log(`[SessionSummarizer] Client ${clientId}: Not enough messages to summarize (need at least 2)`);
      return { success: true, updatedSections: 0 };
    }

    const document = await storage.getOrCreateClientDocument(clientId);
    const sections = await storage.getDocumentSections(document.id);
    
    if (sections.length === 0) {
      console.log(`[SessionSummarizer] Client ${clientId}: No sections found in document`);
      return { success: true, updatedSections: 0 };
    }

    const emptySections = sections.filter(s => !s.content || s.content.trim().length < 20);
    console.log(`[SessionSummarizer] Client ${clientId}: ${emptySections.length}/${sections.length} sections are empty/minimal`);

    const sectionUpdates = await generateSectionUpdates(recentMessages, sections);
    console.log(`[SessionSummarizer] Client ${clientId}: AI returned ${sectionUpdates.length} section updates`);
    
    let appliedCount = 0;
    for (const update of sectionUpdates) {
      if (update.newContent && update.newContent.trim()) {
        await storage.updateSectionByAI(update.sectionId, update.newContent);
        appliedCount++;
        console.log(`[SessionSummarizer] Updated section ${update.sectionId.slice(0, 8)}...`);
      }
    }
    
    await storage.updateClientLastSummarized(clientId);
    console.log(`[SessionSummarizer] Client ${clientId}: Applied ${appliedCount} updates, marked as summarized`);
    
    return { success: true, updatedSections: appliedCount };
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
Your task is to analyze a recent conversation and SYNTHESIZE insights into concise, updated document sections.

CRITICAL: This is a SYNTHESIS document, not a changelog. Each section should be a distilled summary that captures the most important, current understanding of the client.

WORD LIMITS (strictly enforce):
- Overview: 150 words max - Who is this client? Their core identity and journey.
- Key Highlights: 200 words max - Most significant patterns, breakthroughs, themes.
- Current Focus Areas: 100 words max - What they're actively working on RIGHT NOW.
- Background & Context: 150 words max - Essential life context (career, relationships, values).
- Exercise Reflections: 200 words max - Key insights from completed exercises.
- Open Questions: 100 words max - Unresolved questions to explore.

SYNTHESIS STRATEGY:
- Read existing content and NEW conversation, then write a FRESH synthesis that captures the best current understanding
- Prioritize recency - newer insights may replace or update older ones
- Keep only what's most relevant and meaningful - not everything needs to be preserved
- If new information contradicts or updates old info, use the new understanding
- Distill, don't accumulate - a tighter summary is better than a comprehensive one
- Use concise language; every word should earn its place

Current document sections:
${sectionsInfo.map(s => `
### ${s.title} (${s.sectionType}) ${!s.currentContent || s.currentContent === "(empty)" ? "[EMPTY - NEEDS CONTENT]" : ""}
ID: ${s.id}
Current Content:
${s.currentContent}
`).join("\n")}

Respond with a JSON array of section updates. Each update should have:
- sectionId: the ID of the section to update
- newContent: the SYNTHESIZED content (respecting word limits)

Only update sections where this conversation adds meaningful new understanding.`;

  const userMessage = `Recent conversation to analyze:

${conversationText}

Based on this conversation, generate updates for the relevant document sections. Return a JSON array of updates.`;

  try {
    console.log(`[SessionSummarizer] Calling AI to generate section updates for ${messages.length} messages...`);
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 4000,
      messages: [{ role: "user", content: userMessage }],
      system: systemPrompt,
    });

    const content = response.content[0];
    if (content.type !== "text") {
      console.log("[SessionSummarizer] AI response was not text");
      return [];
    }

    const jsonMatch = content.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.log("[SessionSummarizer] No JSON array found in response. AI said:", content.text.slice(0, 200));
      return [];
    }

    const updates: SectionUpdate[] = JSON.parse(jsonMatch[0]);
    console.log(`[SessionSummarizer] AI returned ${updates.length} raw updates`);
    
    const validSectionIds = new Set(sections.map(s => s.id));
    const validUpdates = updates.filter(u => validSectionIds.has(u.sectionId) && u.newContent);
    console.log(`[SessionSummarizer] ${validUpdates.length} updates have valid section IDs and content`);
    
    return validUpdates;
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

export async function generateConversationTitle(threadId: string, messages: Message[]): Promise<string | null> {
  try {
    if (messages.length < 2) {
      return null;
    }

    const conversationText = messages
      .slice(0, 10) // Use first 10 messages for context
      .map(m => `${m.role === "user" ? "Client" : "AI"}: ${m.content}`)
      .join("\n\n");

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 100,
      messages: [{ 
        role: "user", 
        content: `Based on this coaching conversation, generate a short, descriptive title (3-6 words) that captures the main theme or topic discussed. Return ONLY the title, no quotes or explanation.

Conversation:
${conversationText}`
      }],
      system: "You are a helpful assistant that generates concise, meaningful titles for coaching conversations. Focus on the emotional or thematic core of what was discussed. Examples: 'Processing Career Uncertainty', 'Navigating Family Boundaries', 'Finding Work-Life Balance', 'Exploring Self-Worth Questions'",
    });

    const content = response.content[0];
    if (content.type !== "text") {
      return null;
    }

    const title = content.text.trim().replace(/^["']|["']$/g, ''); // Remove any quotes
    console.log(`[TitleGenerator] Generated title for thread ${threadId}: "${title}"`);
    
    // Update the thread title
    await storage.updateThreadTitle(threadId, title);
    
    return title;
  } catch (error: any) {
    console.error("[TitleGenerator] Error:", error.message);
    return null;
  }
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
Analyze this single exchange and determine if any sections should be updated with a fresh synthesis.

SECTIONS:
${sectionsInfo.map(s => `
### ${s.title} (${s.sectionType}) ${s.isEmpty ? "[NEEDS CONTENT]" : ""}
ID: ${s.id}
Current: ${s.currentContent || "(empty)"}
`).join("\n")}

WORD LIMITS (strictly enforce):
- Overview: 150 words max
- Key Highlights: 200 words max
- Current Focus Areas: 100 words max
- Background & Context: 150 words max
- Exercise Reflections: 200 words max
- Open Questions: 100 words max

GUIDELINES:
- Only update if this exchange reveals meaningful NEW information
- SYNTHESIZE, don't accumulate - write a fresh, distilled summary incorporating new insights
- Newer information can replace or update older understanding
- Keep sections concise; every word should earn its place
- If content would exceed word limit, prioritize most important/recent insights

Return a JSON array: [{"sectionId": "...", "newContent": "synthesized content within word limit"}]
Return [] if no updates needed.`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
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
