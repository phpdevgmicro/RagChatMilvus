import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key"
});

// No hardcoded prompts - everything comes from database

export interface ChatResponse {
  content: string;
  sources: string[];
  embedding: number[];
}

export async function generateChatResponse(
  query: string, 
  context: string = "",
  options: { temperature?: number; model?: string; maxTokens?: number } = {},
  settings?: Record<string, string>
): Promise<ChatResponse> {
  try {
    const { temperature, model, maxTokens } = options;
    
    // Validate all required parameters are provided
    if (temperature === undefined) {
      throw new Error("Temperature parameter is required");
    }
    if (!model) {
      throw new Error("Model parameter is required");
    }
    if (!maxTokens) {
      throw new Error("MaxTokens parameter is required");
    }
    
    // Use settings from database - no fallbacks
    if (!settings?.systemPrompt) {
      throw new Error("System prompt not configured in database");
    }
    if (!settings?.userPromptTemplate) {
      throw new Error("User prompt template not configured in database");
    }
    if (!settings?.userPromptNoContext) {
      throw new Error("User prompt (no context) not configured in database");
    }
    
    const currentSystemPrompt = settings.systemPrompt;
    const currentUserPromptTemplate = settings.userPromptTemplate;
    const currentUserPromptNoContext = settings.userPromptNoContext;
    
    // Build messages array with context as assistant memory
    const messages: ChatCompletionMessageParam[] = [];
    
    // Enhanced system prompt that includes conversation memory
    let systemPromptWithMemory = currentSystemPrompt;
    if (context) {
      systemPromptWithMemory += `\n\nIMPORTANT: You have access to relevant memories from previous conversations. Use this context naturally as if you remember these past interactions:\n\n${context}\n\nUse this memory to provide more contextual and personalized responses. Reference previous conversations when relevant.`;
    }
    
    messages.push({
      role: "system",
      content: systemPromptWithMemory
    });
    
    // Simple user query without context manipulation
    const userPrompt = context 
      ? currentUserPromptTemplate.replace('{context}', '').replace('{query}', query).trim()
      : currentUserPromptNoContext.replace('{query}', query);
    
    messages.push({
      role: "user", 
      content: userPrompt
    });

    const response = await openai.chat.completions.create({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
      stream: false, // Ensure we're not using streaming
    });

    const content = response.choices[0].message.content || "";
    
    // Generate embedding for the response
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: content,
    });

    return {
      content,
      sources: context ? ["External Knowledge Base"] : [],
      embedding: embeddingResponse.data[0].embedding,
    };
  } catch (error) {
    console.error("OpenAI API error:", error);
    throw new Error("Failed to generate response: " + (error as Error).message);
  }
}

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: text,
    });
    
    return response.data[0].embedding;
  } catch (error) {
    console.error("OpenAI embedding error:", error);
    throw new Error("Failed to generate embedding: " + (error as Error).message);
  }
}

export async function checkOpenAIConnection(): Promise<boolean> {
  try {
    await openai.models.list();
    return true;
  } catch (error) {
    console.error("OpenAI connection failed:", error);
    return false;
  }
}

// Legacy prompt variables kept for fallback compatibility
// These are now managed via database
