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
    
    // Only need system prompt from database
    if (!settings?.systemPrompt) {
      throw new Error("System prompt not configured in database");
    }
    
    // Build input string for Response API
    let input = settings.systemPrompt + "\n\n";
    console.log(previousAssistantResponses);
    // Add previous relevant conversations as context
    if (previousAssistantResponses.length > 0) {
      input += "Previous conversation context:\n";
      for (const prev of previousAssistantResponses) {
        input += `User: ${prev.query}\nAssistant: ${prev.response}\n\n`;
      }
      input += "Current query:\n";
    }
    
    // Add current user query
    input += query;

    // Use Response API with correct parameter name
    const response = await openai.responses.create({
      model,
      input,
      max_output_tokens: maxTokens,
      stream: false,
    });
  console.log(response);
    const content = response.output_text || "";

    return {
      content,
      sources: previousAssistantResponses.length > 0 ? ["Previous Conversations"] : [],
    };
  } catch (error) {
    console.error("OpenAI API error:", error);
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
