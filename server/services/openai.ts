import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import dotenv from 'dotenv';
dotenv.config();

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key"
});

// No hardcoded prompts - everything comes from database

export interface ChatResponse {
  content: string;
  sources: string[];
}

export async function generateChatResponse(
  query: string, 
  previousAssistantResponses: Array<{query: string, response: string}> = [],
  options: { temperature?: number; model?: string; maxTokens?: number } = {},
  settings?: Record<string, string>
): Promise<ChatResponse> {
  const startTime = Date.now();
  
  try {
    const { temperature, model, maxTokens } = options;
    
    // Fast validation with early returns
    if (temperature === undefined) throw new Error("Temperature parameter is required");
    if (!model) throw new Error("Model parameter is required");
    if (!maxTokens) throw new Error("MaxTokens parameter is required");
    if (!settings?.systemPrompt) throw new Error("System prompt not configured in database");
    
    // Build optimized input string
    let input = settings.systemPrompt + "\n\n";
    
    // Add context only if available (avoid empty context overhead)
    if (previousAssistantResponses.length > 0) {
      input += "Context:\n";
      // Limit context to prevent token overflow
      const contextLimit = Math.min(previousAssistantResponses.length, 2);
      for (let i = 0; i < contextLimit; i++) {
        const prev = previousAssistantResponses[i];
        input += `Q: ${prev.query}\nA: ${prev.response}\n\n`;
      }
    }
    
    input += query;

    // Optimized API call with timeout
    const response = await Promise.race([
      openai.responses.create({
        model,
        input,
        max_output_tokens: maxTokens,
        stream: false,
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('OpenAI API timeout')), 15000)
      )
    ]) as any;

    const duration = Date.now() - startTime;
    console.log(`OpenAI response generated in ${duration}ms`);

    return {
      content: response.output_text || "",
      sources: previousAssistantResponses.length > 0 ? ["Context"] : [],
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`OpenAI API error after ${duration}ms:`, error);
    throw new Error("Failed to generate response: " + (error as Error).message);
  }
}

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
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
