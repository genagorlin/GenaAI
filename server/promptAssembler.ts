import { storage } from "./storage";
import { parseFileFromStorage, truncateText, estimateTokens as fileEstimateTokens } from "./fileParser";

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

interface AssembledPrompt {
  systemPrompt: string;
  conversationHistory: ConversationMessage[];
  estimatedTokens: number;
}

interface ExerciseContext {
  exerciseId: string;
  exerciseTitle: string;
  exerciseDescription: string;
  exerciseSystemPrompt: string; // Replaces the default task prompt during exercises
  currentStepTitle: string;
  currentStepPrompt: string;
  currentStepGuidance?: string;
  currentStepOrder: number;
  totalSteps: number;
  allSteps: { order: number; title: string }[]; // All step titles in order for context
  nextStepTitle?: string; // The title of the next step, if any
}

interface PromptContext {
  clientId: string;
  currentMessage: string;
  currentSpeaker?: "client" | "coach"; // Who is sending the current message
  messageAlreadyStored?: boolean; // If true, currentMessage is already in recentMessages
  recentMessages?: { role: string; content: string }[];
  documentSections?: { title: string; content: string }[];
  exerciseContext?: ExerciseContext; // Active exercise session context
}

const TOKEN_BUDGET = 30000;
const CHARS_PER_TOKEN = 4;

const TOKEN_ALLOCATIONS = {
  rolePrompt: 500,
  methodologyFrame: 2000,
  memoryContext: 12000,
  referenceDocuments: 3000,
  fileAttachments: 4000,
  currentInput: 1000,
  taskPrompt: 500,
  conversationBuffer: 7000,
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
    let fileAttachmentSection = "";
    const referenceDocuments = await storage.getAllReferenceDocuments();
    console.log(`[PromptAssembler] Found ${referenceDocuments.length} reference documents`);
    if (referenceDocuments.length > 0) {
      const refContent = referenceDocuments
        .map(doc => `## "${doc.title}"\n${doc.content}`)
        .join("\n\n");
      referenceSection = truncateToTokenLimit(refContent, TOKEN_ALLOCATIONS.referenceDocuments);
      
      // Fetch file attachments for reference documents
      const fileContents: string[] = [];
      for (const doc of referenceDocuments) {
        const attachments = await storage.getReferenceDocumentAttachments(doc.id);
        for (const attachment of attachments) {
          try {
            const parsed = await parseFileFromStorage(
              attachment.objectPath, 
              attachment.mimeType, 
              attachment.originalName
            );
            if (parsed.text) {
              fileContents.push(`### Attached File: ${attachment.originalName} (from "${doc.title}")\n${parsed.text}`);
              console.log(`[PromptAssembler] Parsed file ${attachment.originalName}: ${parsed.text.length} chars`);
            }
          } catch (error) {
            console.error(`[PromptAssembler] Error parsing attachment ${attachment.originalName}:`, error);
            fileContents.push(`### Attached File: ${attachment.originalName} (from "${doc.title}")\n[File could not be read]`);
          }
        }
      }
      
      if (fileContents.length > 0) {
        const allFileContent = fileContents.join("\n\n");
        fileAttachmentSection = truncateToTokenLimit(allFileContent, TOKEN_ALLOCATIONS.fileAttachments);
      }
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
      let referenceContent = referenceSection;
      if (fileAttachmentSection) {
        referenceContent += `\n\n## Additional Materials\n${fileAttachmentSection}`;
      }
      systemPromptParts.push(`# Gena's Worldview & Philosophy - YOUR CORE OPERATING SYSTEM
The following writings by coach Gena Gorlin ARE your way of thinking. You don't just reference them—you THINK through this framework. This is your psychology, your lens, your method.

**This is not optional guidance—it's your identity as a thinking partner:**

1. **Builder's Mindset is your default frame**: Every conversation, approach it as one builder talking to another. See the client as someone actively constructing their life, not a passive recipient of circumstances. Notice when the client is showing signs of either the "drill sergeant" or "Zen" mindset, and explicitly draw on Gena's "builder's mindset" writings (ideally quoted verbatim) to offer an alternative frame.

2. **The Psychology of Ambition shapes your questions**: When exploring challenges, naturally draw on concepts like rational ambition, building vs. protecting, creative agency, self-honesty vs self-deception, intellectual ambitiousness vs intellectual humility, "death is the default", etc.

3. **Quote directly and often**: When Gena's words illuminate the moment, USE THEM. Say things like:
   - "This reminds me of something Gena writes: '...'"
   - "As Gena puts it, '...'"
   - "There's a line from Gena's work that feels relevant here: '...'"
   Direct quotes ground the conversation in this specific worldview.

4. **Let methodology drive your approach**: Don't just be supportive—be methodologically rigorous. Use the specific frameworks, distinctions, and approaches from these writings.

5. **Think through, not just about**: When helping a client, apply the actual reasoning patterns from this philosophy. If Gena's writing offers a specific way to think through a dilemma, use that approach.

6. **Make connections proactively**: Don't wait for the client to ask about frameworks. When you see a connection between their situation and Gena's ideas, offer it. "This connects to what Gena calls..." should be a frequent move.

**CRITICAL: Do NOT editorialize beyond these writings**
- Your philosophical positions must come ONLY from Gena's writings and exercise instructions—not from generic therapeutic language or your own interpretations.
- If Gena's writings don't address a specific point, ask the client to explore it rather than filling in with your own take.
- Avoid softening, qualifying, or reframing Gena's actual positions. If she views something as a character flaw, don't say "it's not a character flaw." If she takes a strong stance, maintain that stance.
- Common mistakes to avoid:
  - Referring to "intrinsic" motivation, worth, etc (see Gena's writing on how values and motivation arise from felt understanding of how a given activity causally connects to the rest of one's life and values, and how that understanding is not "intrinsic" but rather gets built through thoughtful engagement in the world).
  - Discouraging "perfectionism" instead of interrogating whether the specific standard of "perfection" is actually honest or well-suited to the client's life and goals.
  - Adding "it's human" or "it's understandable" qualifiers that dilute her framework
  - Inserting generic self-compassion language that contradicts her approach
  - Making things "okay" that her writings might frame as problems to address (or vice versa)
- When uncertain about Gena's position on something, default to curiosity: "I'm curious what you think about..." rather than asserting a position.
- The writings below are your CANON. Stay within their bounds.

${referenceContent}`);
    }

    if (memorySection) {
      systemPromptParts.push(`# Client Context\n${memorySection}`);
    }

    // Use exercise's system prompt instead of default task prompt when in an exercise
    // During an exercise, NEVER use the default task prompt - the exercise context provides all needed guidance
    if (context.exerciseContext) {
      // Only add response instructions if the exercise has a custom system prompt
      if (context.exerciseContext.exerciseSystemPrompt && context.exerciseContext.exerciseSystemPrompt.trim()) {
        systemPromptParts.push(`# Response Instructions\n${truncateToTokenLimit(context.exerciseContext.exerciseSystemPrompt, TOKEN_ALLOCATIONS.taskPrompt)}`);
      }
      // If no custom system prompt, the exercise guidance below will be sufficient
    } else if (taskSection) {
      // Only use default task prompt when NOT in an exercise
      systemPromptParts.push(`# Response Instructions\n${taskSection}`);
    }

    // Add exercise context if there's an active exercise session
    if (context.exerciseContext) {
      const ex = context.exerciseContext;
      
      // Fetch file attachments for the active exercise
      let exerciseAttachmentContent = "";
      try {
        const exerciseAttachments = await storage.getExerciseAttachments(ex.exerciseId);
        if (exerciseAttachments.length > 0) {
          const attachmentTexts: string[] = [];
          for (const attachment of exerciseAttachments) {
            try {
              const parsed = await parseFileFromStorage(
                attachment.objectPath,
                attachment.mimeType,
                attachment.originalName
              );
              if (parsed.text) {
                attachmentTexts.push(`### ${attachment.originalName}\n${parsed.text}`);
                console.log(`[PromptAssembler] Parsed exercise attachment ${attachment.originalName}: ${parsed.text.length} chars`);
              }
            } catch (error) {
              console.error(`[PromptAssembler] Error parsing exercise attachment ${attachment.originalName}:`, error);
              attachmentTexts.push(`### ${attachment.originalName}\n[File could not be read]`);
            }
          }
          if (attachmentTexts.length > 0) {
            exerciseAttachmentContent = `\n\n## Exercise Reference Materials\n${truncateToTokenLimit(attachmentTexts.join("\n\n"), 2000)}`;
          }
        }
      } catch (error) {
        console.error(`[PromptAssembler] Error fetching exercise attachments:`, error);
      }
      
      // Build step list for context
      const stepListFormatted = ex.allSteps
        .map(s => `${s.order}. ${s.title}${s.order === ex.currentStepOrder ? ' ← CURRENT' : ''}`)
        .join('\n');

      systemPromptParts.push(`# ACTIVE GUIDED EXERCISE
**CRITICAL**: The client is working through a STRUCTURED exercise with PREDEFINED steps. You MUST follow these exact steps - do NOT invent or suggest different steps.

**Exercise**: ${ex.exerciseTitle}
**Description**: ${ex.exerciseDescription}

## COMPLETE EXERCISE STRUCTURE (follow this exactly):
${stepListFormatted}

## CURRENT STEP: Step ${ex.currentStepOrder} - "${ex.currentStepTitle}"

### Instructions for This Step:
${ex.currentStepPrompt}

${ex.currentStepGuidance ? `### Coach Guidance for This Step:\n${ex.currentStepGuidance}` : ''}${exerciseAttachmentContent}

${ex.nextStepTitle ? `## NEXT STEP PREVIEW: Step ${ex.currentStepOrder + 1} - "${ex.nextStepTitle}"
When the client is ready to advance, they will click "Next Step" in their interface. The ONLY next step is "${ex.nextStepTitle}" - do not suggest any other next step.` : '## FINAL STEP\nThis is the last step of the exercise. When completed, the exercise will be finished.'}

## STRICT RULES FOR THIS EXERCISE:
1. **USE VERBATIM TEXT**: When presenting instructions, questions, or prompts to the client, use the EXACT wording from the step instructions and supporting materials above. Do NOT paraphrase, rephrase, or "improve" the language. Gena wrote these words deliberately - use them as written.
2. **NO EDITORIALIZING**: Do not add your own interpretations, explanations, or elaborations beyond what's in the instructions. If the instructions say "Ask X", ask exactly X - don't add "What I mean by that is..." or soften the question.
3. **QUOTE DIRECTLY**: When referencing concepts from the Coach Guidance or Exercise Reference Materials, quote them directly rather than summarizing. Say "As the exercise puts it: '[exact quote]'" when relevant.
4. **ONLY discuss the current step**: Focus entirely on Step ${ex.currentStepOrder} - "${ex.currentStepTitle}"
5. **NEVER invent steps**: The steps above are the ONLY steps. Do not create or suggest different steps.
6. **When user says "next step"**: Tell them to click the "Next Step" button when ready. The next step will be "${ex.nextStepTitle || 'completion'}"
7. **Stay within the structure**: Your role is to deliver these predefined instructions faithfully, not to create a different journey or add your own therapeutic framing.
8. **Conversational adaptation only**: You may adapt the FORMAT for natural conversation (e.g., breaking a long instruction into dialogue), but the CONTENT and WORDING must remain faithful to the source material.`);
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

  async assembleOpeningPrompt(clientId: string, exerciseId?: string): Promise<{ systemPrompt: string }> {
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

    // Check if this is an exercise opening
    let exercise = null;
    let firstStep = null;
    if (exerciseId) {
      exercise = await storage.getGuidedExercise(exerciseId);
      if (exercise) {
        const steps = await storage.getExerciseSteps(exerciseId);
        firstStep = steps.length > 0 ? steps.sort((a, b) => a.stepOrder - b.stepOrder)[0] : null;
      }
    }

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

    // For exercises, use the exercise's system prompt; otherwise use default task prompt
    if (exercise) {
      if (exercise.systemPrompt && exercise.systemPrompt.trim()) {
        systemPromptParts.push(`# Response Instructions\n${truncateToTokenLimit(exercise.systemPrompt, TOKEN_ALLOCATIONS.taskPrompt)}`);
      }
      
      // Add exercise context for the opening
      systemPromptParts.push(`# EXERCISE OPENING
You are beginning a structured coaching exercise with the client.

**Exercise**: ${exercise.title}
**Description**: ${exercise.description}
${firstStep ? `\n**First Step**: "${firstStep.title}"\n${firstStep.instructions}` : ''}

Your opening message should:
1. Welcome the client to this exercise using the EXACT title and description provided above - do not rephrase or embellish
2. If there's a first step, present it using the VERBATIM instructions above - do not paraphrase or add your own framing
3. Keep your own words minimal - let Gena's written instructions do the talking
4. Do NOT add generic therapeutic encouragement, editorializing, or explanations beyond what's in the materials`);
    } else {
      const taskSection = truncateToTokenLimit(taskPrompt.content, TOKEN_ALLOCATIONS.taskPrompt);
      if (taskSection) {
        systemPromptParts.push(`# Response Instructions\n${taskSection}`);
      }
    }

    const clientName = client?.name?.split(' ')[0] || 'there';
    if (exercise) {
      systemPromptParts.push(`# Opening Message Task\nGenerate an opening message for ${clientName} to begin the "${exercise.title}" exercise. Use the VERBATIM text from the exercise description and first step instructions. Do not add your own framing or editorializing.`);
    } else {
      systemPromptParts.push(`# Opening Message Task\nGenerate an opening message for this new conversation with ${clientName}. Follow the Response Instructions above exactly for how to greet them. This is the very start of a new conversation thread - there is no prior context from the user yet. Ignore any placeholder input and simply deliver your opening greeting as instructed.`);
    }

    const systemPrompt = systemPromptParts.join("\n\n---\n\n");

    return { systemPrompt };
  }

  async getExerciseContext(clientId: string, threadId: string): Promise<ExerciseContext | undefined> {
    console.log(`[Exercise] getExerciseContext called for client ${clientId}, thread ${threadId}`);
    const sessions = await storage.getClientExerciseSessions(clientId);
    console.log(`[Exercise] Found ${sessions.length} sessions for client`);
    
    const activeSession = sessions.find(s => s.threadId === threadId && s.status === "in_progress");
    console.log(`[Exercise] Active session for thread:`, activeSession ? `id=${activeSession.id}, stepId=${activeSession.currentStepId}, status=${activeSession.status}` : 'none');
    
    if (!activeSession) {
      console.log(`[Exercise] No active session found for thread ${threadId}`);
      return undefined;
    }
    
    if (!activeSession.currentStepId) {
      console.log(`[Exercise] Active session has no currentStepId`);
      return undefined;
    }

    const exercise = await storage.getGuidedExercise(activeSession.exerciseId);
    if (!exercise) {
      console.log(`[Exercise] Exercise ${activeSession.exerciseId} not found`);
      return undefined;
    }
    console.log(`[Exercise] Found exercise: ${exercise.title}`);

    const steps = await storage.getExerciseSteps(exercise.id);
    const sortedSteps = [...steps].sort((a, b) => a.stepOrder - b.stepOrder);
    const currentStep = sortedSteps.find(s => s.id === activeSession.currentStepId);
    
    if (!currentStep) {
      return undefined;
    }

    // Find the next step if any
    const currentIndex = sortedSteps.findIndex(s => s.id === currentStep.id);
    const nextStep = currentIndex < sortedSteps.length - 1 ? sortedSteps[currentIndex + 1] : undefined;

    return {
      exerciseId: exercise.id,
      exerciseTitle: exercise.title,
      exerciseDescription: exercise.description,
      exerciseSystemPrompt: exercise.systemPrompt || "",
      currentStepTitle: currentStep.title,
      currentStepPrompt: currentStep.instructions,
      currentStepGuidance: currentStep.supportingMaterial || undefined,
      currentStepOrder: currentStep.stepOrder,
      totalSteps: sortedSteps.length,
      allSteps: sortedSteps.map(s => ({ order: s.stepOrder, title: s.title })),
      nextStepTitle: nextStep?.title,
    };
  }
}

export const promptAssembler = new PromptAssembler();
