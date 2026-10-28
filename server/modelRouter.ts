import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

type ModelTier = "fast" | "balanced" | "deep";
type Provider = "anthropic" | "openai";

interface RoutingResult {
  tier: ModelTier;
  model: string;
  provider: Provider;
  reasoning: string;
}

interface MessageCharacteristics {
  length: number;
  hasEmotionalKeywords: boolean;
  hasDeepQuestions: boolean;
  isSimpleGreeting: boolean;
}

const EMOTIONAL_KEYWORDS = [
  "feel", "feeling", "felt", "emotion", "scared", "afraid", "anxious", "worried",
  "sad", "depressed", "angry", "frustrated", "overwhelmed", "stressed", "hurt",
  "confused", "lost", "stuck", "hopeless", "excited", "happy", "grateful",
  "love", "hate", "fear", "grief", "shame", "guilt", "jealous", "lonely"
];

const DEEP_QUESTION_PATTERNS = [
  /why (do|did|am|is|are|was|were) (i|we|they|he|she)/i,
  /what (does|do) .+ mean/i,
  /how (do|can|should) i .+ (life|career|relationship|meaning|purpose)/i,
  /what is (the meaning|my purpose|wrong with)/i,
  /(struggle|struggling) (with|to)/i,
  /can('t| not) (seem to|stop|figure out)/i,
  /keep (thinking|wondering|asking)/i,
  /deeper|underlying|root cause/i,
];

const SIMPLE_GREETING_PATTERNS = [
  /^(hi|hello|hey|good morning|good afternoon|good evening)[\s!.]*$/i,
  /^(thanks|thank you|ok|okay|got it|sure|yes|no)[\s!.]*$/i,
  /^(bye|goodbye|see you|talk later)[\s!.]*$/i,
];

function analyzeMessage(content: string): MessageCharacteristics {
  const lowerContent = content.toLowerCase();
  
  const hasEmotionalKeywords = EMOTIONAL_KEYWORDS.some(keyword => 
    lowerContent.includes(keyword)
  );
  
  const hasDeepQuestions = DEEP_QUESTION_PATTERNS.some(pattern => 
    pattern.test(content)
  );
  
  const isSimpleGreeting = SIMPLE_GREETING_PATTERNS.some(pattern => 
    pattern.test(content.trim())
  );
  
  return {
    length: content.length,
    hasEmotionalKeywords,
    hasDeepQuestions,
    isSimpleGreeting,
  };
}

export function routeMessage(content: string): RoutingResult {
  const characteristics = analyzeMessage(content);
  
  if (characteristics.isSimpleGreeting || characteristics.length < 20) {
    return {
      tier: "fast",
      model: "gpt-4o-mini",
      provider: "openai",
      reasoning: "Simple message - using fast OpenAI model",
    };
  }
  
  if (characteristics.hasDeepQuestions) {
    return {
      tier: "deep",
      model: "claude-opus-4-7",
      provider: "anthropic",
      reasoning: "Deep existential/complex question detected - using Anthropic for thoughtful response",
    };
  }
  
  if (characteristics.hasEmotionalKeywords || characteristics.length > 200) {
    return {
      tier: "balanced",
      model: "claude-opus-4-7",
      provider: "anthropic",
      reasoning: "Emotional content detected - using Anthropic for empathetic response",
    };
  }
  
  return {
    tier: "fast",
    model: "gpt-4o-mini",
    provider: "openai",
    reasoning: "Standard message - using fast OpenAI model",
  };
}

interface GenerateResponseParams {
  systemPrompt: string;
  conversationHistory: { role: "user" | "assistant"; content: string }[];
  model?: string;
  provider?: Provider;
  // Optional tool support (e.g. wiki navigation). Only the Anthropic path uses
  // these; the OpenAI path is reserved for trivial messages that don't need tools.
  tools?: any[];
  executeTool?: (name: string, input: any) => Promise<string>;
}

export async function generateAIResponse(params: GenerateResponseParams): Promise<string> {
  const { systemPrompt, conversationHistory, model = "claude-opus-4-7", provider = "anthropic", tools, executeTool } = params;

  if (provider === "openai") {
    return generateOpenAIResponse({ systemPrompt, conversationHistory, model });
  }

  return generateAnthropicResponse({ systemPrompt, conversationHistory, model, tools, executeTool });
}

async function generateAnthropicResponse(params: Omit<GenerateResponseParams, "provider">): Promise<string> {
  const { systemPrompt, conversationHistory, model = "claude-opus-4-7", tools, executeTool } = params;

  const anthropic = new Anthropic({
    baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
    apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  });

  // System prompt as a content block array with ephemeral cache_control. This
  // caches the ~30k token system prompt (and the tool definitions, which render
  // before it) so back-to-back turns within ~5 minutes only pay ~10% of the
  // input cost on the cached prefix.
  const systemBlocks = [
    {
      type: "text" as const,
      text: systemPrompt,
      cache_control: { type: "ephemeral" as const },
    },
  ];

  const logUsage = (usage: any) => {
    if (usage?.cache_read_input_tokens || usage?.cache_creation_input_tokens) {
      console.log(`[Cache] read=${usage.cache_read_input_tokens || 0} write=${usage.cache_creation_input_tokens || 0} uncached=${usage.input_tokens}`);
    }
  };

  // Mutable message list we can extend as the model calls tools.
  const messages: any[] = conversationHistory.map(m => ({ role: m.role, content: m.content }));
  const hasTools = !!(tools && tools.length && executeTool);
  const MAX_TOOL_ITERATIONS = 5;

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const response = await anthropic.messages.create({
      model,
      max_tokens: 4096,
      system: systemBlocks,
      messages,
      ...(hasTools ? { tools } : {}),
    });
    logUsage(response.usage as any);

    if (hasTools && response.stop_reason === "tool_use") {
      // Record the assistant's tool-use turn verbatim, then resolve each tool call.
      messages.push({ role: "assistant", content: response.content });

      const toolResults: any[] = [];
      for (const block of response.content as any[]) {
        if (block.type === "tool_use") {
          console.log(`[Wiki] tool call: ${block.name}(${JSON.stringify(block.input)})`);
          let resultText: string;
          try {
            resultText = await executeTool!(block.name, block.input);
          } catch (err: any) {
            resultText = `Error executing ${block.name}: ${err?.message || "unknown error"}`;
          }
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: resultText });
        }
      }
      messages.push({ role: "user", content: toolResults });
      continue; // loop so the model can use the tool results
    }

    const textContent = (response.content as any[]).find(b => b.type === "text");
    if (textContent && textContent.type === "text") {
      return textContent.text;
    }
    break; // ended without text — fall through to the safety call
  }

  // Safety net: if we exhausted the tool loop or got no text, make one final
  // call WITHOUT tools to force a plain text answer.
  const finalResponse = await anthropic.messages.create({
    model,
    max_tokens: 4096,
    system: systemBlocks,
    messages,
  });
  logUsage(finalResponse.usage as any);
  const finalText = (finalResponse.content as any[]).find(b => b.type === "text");
  if (!finalText || finalText.type !== "text") {
    throw new Error("No text response from AI");
  }
  return finalText.text;
}

async function generateOpenAIResponse(params: Omit<GenerateResponseParams, "provider">): Promise<string> {
  const { systemPrompt, conversationHistory, model = "gpt-4o" } = params;
  
  const openai = new OpenAI({
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  });
  
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...conversationHistory.map(msg => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    })),
  ];
  
  const response = await openai.chat.completions.create({
    model,
    max_tokens: 4096,
    messages,
  });
  
  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No text response from AI");
  }
  
  return content;
}
