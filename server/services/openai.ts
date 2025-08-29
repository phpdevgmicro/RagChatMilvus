import OpenAI from "openai";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key"
});

// Configurable prompts
let systemPrompt = "You are a helpful AI assistant. Provide clear, concise, and accurate responses. When context is provided, use it to enhance your answers.";
let userPromptTemplate = "Context: {context}\n\nUser Question: {query}\n\nPlease provide a comprehensive answer based on the context and your knowledge.";
let userPromptNoContext = "User Question: {query}\n\nPlease provide a comprehensive and helpful answer.";

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
    const { temperature = 0.7, model = "gpt-4o-mini", maxTokens = 1000 } = options;
    
    // Use settings from database if provided, otherwise fall back to defaults
    const currentSystemPrompt = settings?.systemPrompt || systemPrompt;
    const currentUserPromptTemplate = settings?.userPromptTemplate || userPromptTemplate;
    const currentUserPromptNoContext = settings?.userPromptNoContext || userPromptNoContext;
    
    const prompt = context 
      ? currentUserPromptTemplate.replace('{context}', context).replace('{query}', query)
      : currentUserPromptNoContext.replace('{query}', query);

    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: currentSystemPrompt
        },
        {
          role: "user",
          content: prompt
        }
      ],
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
