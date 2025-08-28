import type { Express } from "express";
import { createServer, type Server } from "http";
import {
  generateChatResponse,
  generateEmbedding,
  checkOpenAIConnection,
} from "./services/openai";
import { qdrantService, type ChatMessage } from "./services/qdrant";
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
        temperature = 0.5,
        model = "gpt-4o-mini",
        maxTokens = 2048,
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

      // Generate AI response first for faster user experience
      const aiResponsePromise = generateChatResponse(content, "", {
        temperature,
        model,
        maxTokens,
      });

      // Search vector database in parallel for potential context (for future responses)
      const vectorSearchPromise = (async () => {
        try {
          const queryEmbedding = await generateEmbedding(content);
          return await qdrantService.searchSimilar(queryEmbedding, 0.7, 3); // Reduced from 5 to 3 for speed
        } catch (error) {
          console.error("Error searching vector database:", error);
          return [];
        }
      })();

      // Wait for AI response (priority)
      const aiResponse = await aiResponsePromise;

      // Get vector results (optional for context)
      const similarResults = await vectorSearchPromise;

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
        qdrantService
          .insertVector({
            id: randomUUID(),
            query: content,
            response: aiResponse.content,
            embedding: aiResponse.embedding,
            sources: aiResponse.sources,
            timestamp: new Date().toISOString(),
          })
          .catch((error) => {
            console.error("Error saving to vector database:", error);
          });
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

  // Clear database
  app.delete("/api/clear-database", async (req, res) => {
    try {
      await qdrantService.clearCollection();
      chatMessages = []; // Clear in-memory chat messages

      res.json({ message: "Database cleared successfully" });
    } catch (error) {
      console.error("Error clearing database:", error);
      res.status(500).json({ message: "Failed to clear database" });
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
