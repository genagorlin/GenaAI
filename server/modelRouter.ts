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
      model: "claude-sonnet-4-5",
      provider: "anthropic",
      reasoning: "Deep existential/complex question detected - using Anthropic for thoughtful response",
    };
  }
  
  if (characteristics.hasEmotionalKeywords || characteristics.length > 200) {
    return {
      tier: "balanced",
      model: "claude-sonnet-4-5",
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
}

export async function generateAIResponse(params: GenerateResponseParams): Promise<string> {
  const { systemPrompt, conversationHistory, model = "claude-sonnet-4-5", provider = "anthropic" } = params;
  
  if (provider === "openai") {
    return generateOpenAIResponse({ systemPrompt, conversationHistory, model });
  }
  
  return generateAnthropicResponse({ systemPrompt, conversationHistory, model });
}

async function generateAnthropicResponse(params: Omit<GenerateResponseParams, "provider">): Promise<string> {
  const { systemPrompt, conversationHistory, model = "claude-sonnet-4-5" } = params;
  
  const anthropic = new Anthropic({
    baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
    apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  });
  
  const response = await anthropic.messages.create({
    model,
    max_tokens: 4096,
    system: systemPrompt,
    messages: conversationHistory,
  });
  
  const textContent = response.content.find(block => block.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("No text response from AI");
  }
  
  return textContent.text;
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
