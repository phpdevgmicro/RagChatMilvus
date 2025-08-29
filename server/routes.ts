import type { Express } from "express";
import { createServer, type Server } from "http";
import {
  generateChatResponse,
  generateEmbedding,
  checkOpenAIConnection,
} from "./services/openai";
import { qdrantService, type ChatMessage } from "./services/qdrant";
import { getAllSettings, setSetting } from "./services/database";
import { randomUUID } from "crypto";

// In-memory chat storage for the session
let chatMessages: ChatMessage[] = [];

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize services
  try {
    await qdrantService.connect();
  } catch (error) {
    console.error("Service initialization error:", error);
  }

  // Get chat messages
  app.get("/api/messages", async (req, res) => {
    try {
      res.json(chatMessages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  // Send chat message and get AI response
  app.post("/api/messages", async (req, res) => {
    try {
      const {
        content,
        saveToVector = false,
      } = req.body;

      if (!content || typeof content !== "string") {
        return res.status(400).json({ message: "Content is required" });
      }

      // Save user message
      const userMessage: ChatMessage = {
        id: randomUUID(),
        content,
        role: "user",
        timestamp: new Date(),
        sources: [],
      };
      chatMessages.push(userMessage);

      // Search vector database for previous similar conversations
      let previousConversations: Array<{query: string, response: string}> = [];
      try {
        const queryEmbedding = await generateEmbedding(content);
        const similarResults = await qdrantService.searchSimilar(queryEmbedding, 0.7, 3);
        console.log(similarResults);
        if (similarResults.length > 0) {
          previousConversations = similarResults.map(result => ({
            query: result.query,
            response: result.response
          }));
        }
      } catch (error) {
        console.error("Error searching vector database:", error);
      }

      // Get fresh settings from database every time
      const settings = await getAllSettings();
      
      // ALWAYS use database settings only - never use request parameters
      const currentModel = settings.model;
      const currentTemperature = parseFloat(settings.temperature);
      const currentMaxTokens = parseInt(settings.maxTokens);
      
      // Validate required settings exist
      if (!currentModel) {
        return res.status(400).json({ message: "Model not configured. Please set model in settings." });
      }
      if (isNaN(currentTemperature)) {
        return res.status(400).json({ message: "Temperature not configured. Please set temperature in settings." });
      }
      if (!currentMaxTokens) {
        return res.status(400).json({ message: "Max tokens not configured. Please set maxTokens in settings." });
      }
      if (!settings.systemPrompt) {
        return res.status(400).json({ message: "System prompt not configured. Please set system prompt in settings." });
      }

      // Generate AI response with previous conversations as context
      const aiResponse = await generateChatResponse(content, previousConversations, {
        temperature: currentTemperature,
        model: currentModel,
        maxTokens: currentMaxTokens,
      }, settings);

      // Use the saveToVector flag directly from user input
      const shouldSaveToVector = saveToVector;

      // Save AI response
      const assistantMessage: ChatMessage = {
        id: randomUUID(),
        content: aiResponse.content,
        role: "assistant",
        timestamp: new Date(),
        sources: aiResponse.sources,
        savedToVector: shouldSaveToVector,
      };
      chatMessages.push(assistantMessage);

      // Save to vector database asynchronously (don't block response)
      if (shouldSaveToVector) {
        // Fire and forget - don't await this
        (async () => {
          try {
            const embedding = await generateEmbedding(aiResponse.content);
            await qdrantService.insertVector({
              id: randomUUID(),
              query: content,
              response: aiResponse.content,
              embedding,
              sources: aiResponse.sources,
              timestamp: new Date().toISOString(),
            });
          } catch (error) {
            console.error("Error saving to vector database:", error);
          }
        })();
      }

      res.json({
        userMessage,
        assistantMessage,
        sources: aiResponse.sources,
      });
    } catch (error) {
      console.error("Error processing message:", error);
      res.status(500).json({ message: "Failed to process message" });
    }
  });

  // Update message to save/unsave to vector DB
  app.patch("/api/messages/:id/vector-save", async (req, res) => {
    try {
      const { id } = req.params;
      const { saveToVector } = req.body;

      const message = chatMessages.find((m) => m.id === id);
      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }

      // Update the saved status
      if (message.role === "assistant") {
        message.savedToVector = saveToVector;

        if (saveToVector) {
          // Find the corresponding user message for the query
          const messageIndex = chatMessages.findIndex((m) => m.id === id);
          const userMessage =
            messageIndex > 0 ? chatMessages[messageIndex - 1] : null;

          if (userMessage && userMessage.role === "user") {
            const embedding = await generateEmbedding(message.content);

            await qdrantService.insertVector({
              id: randomUUID(),
              query: userMessage.content,
              response: message.content,
              embedding,
              sources: message.sources || [],
              timestamp: new Date().toISOString(),
            });
          }
        } else {
          // Remove from vector database when unchecked
          const messageIndex = chatMessages.findIndex((m) => m.id === id);
          const userMessage =
            messageIndex > 0 ? chatMessages[messageIndex - 1] : null;

          if (userMessage && userMessage.role === "user") {
            // Search for similar vectors to find and delete the specific one
            try {
              const embedding = await generateEmbedding(message.content);
              const similarResults = await qdrantService.searchSimilar(embedding, 0.95, 5);
              
              // Find the exact match by comparing the response content
              const exactMatch = similarResults.find(result => 
                result.response.trim() === message.content.trim() && 
                result.query.trim() === userMessage.content.trim()
              );
              
              if (exactMatch) {
                await qdrantService.deleteVector(exactMatch.id);
              }
            } catch (error) {
              console.error("Error deleting from vector database:", error);
            }
          }
        }
      }

      res.json(message);
    } catch (error) {
      console.error("Error updating message:", error);
      res.status(500).json({ message: "Failed to update message" });
    }
  });

  // Vector similarity search
  app.post("/api/search-similar", async (req, res) => {
    try {
      const { query, threshold = 0.7, limit = 10 } = req.body;

      if (!query || typeof query !== "string") {
        return res.status(400).json({ message: "Query is required" });
      }

      const queryEmbedding = await generateEmbedding(query);
      const results = await qdrantService.searchSimilar(
        queryEmbedding,
        threshold,
        limit,
      );

      res.json(results);
    } catch (error) {
      console.error("Error searching similar responses:", error);
      res.status(500).json({ message: "Failed to search similar responses" });
    }
  });

  // Get connection status
  app.get("/api/status", async (req, res) => {
    try {
      const [openaiStatus] = await Promise.allSettled([
        checkOpenAIConnection(),
      ]);

      const status = {
        qdrant: qdrantService.getConnectionStatus(),
        openai:
          openaiStatus.status === "fulfilled" ? openaiStatus.value : false,
      };

      res.json(status);
    } catch (error) {
      console.error("Error checking status:", error);
      res.status(500).json({ message: "Failed to check status" });
    }
  });

  // Get database statistics
  app.get("/api/stats", async (req, res) => {
    try {
      const stats = await qdrantService.getCollectionStats();
      const lastMessage = chatMessages[chatMessages.length - 1];

      res.json({
        ...stats,
        lastUpdated: lastMessage?.timestamp
          ? getTimeAgo(lastMessage.timestamp)
          : "Never",
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Clear chat history
  app.delete("/api/clear-database", async (req, res) => {
    try {
      chatMessages = []; // Clear in-memory chat messages only

      res.json({ message: "Chat history cleared successfully" });
    } catch (error) {
      console.error("Error clearing chat history:", error);
      res.status(500).json({ message: "Failed to clear chat history" });
    }
  });

  // Get system prompt
  app.get("/api/prompts", async (req, res) => {
    try {
      const settings = await getAllSettings();
      res.json({
        systemPrompt: settings.systemPrompt || "You are a helpful AI assistant."
      });
    } catch (error) {
      console.error("Error fetching system prompt:", error);
      res.status(500).json({ message: "Failed to fetch system prompt" });
    }
  });

  // Update system prompt
  app.put("/api/prompts", async (req, res) => {
    try {
      const { systemPrompt } = req.body;
      
      if (systemPrompt) await setSetting('systemPrompt', systemPrompt);

      res.json({ message: "System prompt updated successfully" });
    } catch (error) {
      console.error("Error updating system prompt:", error);
      res.status(500).json({ message: "Failed to update system prompt" });
    }
  });

  // Update all settings (model configuration + system prompt)
  app.put("/api/settings", async (req, res) => {
    try {
      const { 
        systemPrompt, 
        model,
        temperature,
        maxTokens 
      } = req.body;
      
      // Update system prompt
      if (systemPrompt) await setSetting('systemPrompt', systemPrompt);
      
      // Update model settings
      if (model) await setSetting('model', model);
      if (temperature !== undefined) await setSetting('temperature', temperature.toString());
      if (maxTokens !== undefined) await setSetting('maxTokens', maxTokens.toString());

      res.json({ message: "Settings updated successfully" });
    } catch (error) {
      console.error("Error updating settings:", error);
      res.status(500).json({ message: "Failed to update settings" });
    }
  });

  // Get all settings including model configuration
  app.get("/api/settings", async (req, res) => {
    try {
      const settings = await getAllSettings();
      res.json({
        systemPrompt: settings.systemPrompt || "You are a helpful AI assistant.",
        model: settings.model || "gpt-4o-mini",
        temperature: parseFloat(settings.temperature || "1.0"),
        maxTokens: parseInt(settings.maxTokens || "2048")
      });
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ message: "Failed to update settings" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
}
