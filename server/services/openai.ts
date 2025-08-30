import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export interface VectorMemoryContext {
  query: string;
  response: string;
  similarity: number;
  timestamp: string;
}
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
  vectorMemoryContext: VectorMemoryContext[] = [],
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
    
    // Build message array with vector memory context for optimal Response API usage
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: settings.systemPrompt
      }
    ];

    // Add vector memory context as proper user/assistant message pairs
    if (vectorMemoryContext.length > 0) {
      // Limit context to prevent token overflow - use top 3 most relevant
      const contextLimit = Math.min(vectorMemoryContext.length, 3);
      
      for (let i = 0; i < contextLimit; i++) {
        const memory = vectorMemoryContext[i];
        messages.push(
          {
            role: "user",
            content: memory.query
          },
          {
            role: "assistant", 
            content: memory.response
          }
        );
      }
      
      console.log(`📚 Added ${contextLimit} conversation pairs from vector memory (similarities: ${vectorMemoryContext.slice(0, contextLimit).map(m => m.similarity.toFixed(3)).join(', ')})`);
    }

    // Add current user query
    messages.push({
      role: "user",
      content: query
    });

    // For Response API, we'll convert messages to input format
    let input = messages.map(msg => {
      if (msg.role === 'system') return msg.content;
      if (msg.role === 'user') return `User: ${msg.content}`;
      if (msg.role === 'assistant') return `Assistant: ${msg.content}`;
      return msg.content;
    }).join('\n\n') + '\n\nAssistant:';

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
      sources: vectorMemoryContext.length > 0 ? 
        [`Vector Memory (${vectorMemoryContext.length} conversations)`] : [],
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
