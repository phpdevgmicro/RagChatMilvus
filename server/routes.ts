import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generateChatResponse, generateEmbedding, checkOpenAIConnection } from "./services/openai";
import { milvusService } from "./services/milvus";
import { mcpClient } from "./services/mcp";
import { evaluateMemoryValue } from "./services/memory-evaluator";
import { insertChatMessageSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Initialize services
  try {
    await milvusService.connect();
    await mcpClient.connect();
  } catch (error) {
    console.error("Service initialization error:", error);
  }

  // Get chat messages
  app.get("/api/messages", async (req, res) => {
    try {
      const messages = await storage.getChatMessages();
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  // Send chat message and get AI response
  app.post("/api/messages", async (req, res) => {
    try {
      const { content, saveToVector = false, userDecision = null } = req.body;

      if (!content || typeof content !== "string") {
        return res.status(400).json({ message: "Content is required" });
      }

      // Save user message
      const userMessage = await storage.createChatMessage({
        content,
        role: "user",
        savedToVector: false,
        sources: [],
        similarityScore: null,
      });

      // Get context from MCP server
      const mcpResponse = await mcpClient.retrieveContext(content);
      
      // Generate AI response
      const aiResponse = await generateChatResponse(content, mcpResponse.context);

      // Evaluate memory value using intelligent system
      const memoryDecision = await evaluateMemoryValue(
        content, 
        aiResponse.content, 
        mcpResponse.context
      );

      let shouldSaveToVector = saveToVector;
      
      // Apply intelligent memory decision
      if (userDecision === null) {
        if (memoryDecision.action === "auto_save") {
          shouldSaveToVector = true;
        } else if (memoryDecision.action === "skip") {
          shouldSaveToVector = false;
        }
        // For "prompt_user", we'll return the suggestion to the frontend
      } else {
        // User made an explicit decision
        shouldSaveToVector = userDecision;
      }

      // Save AI response
      const assistantMessage = await storage.createChatMessage({
        content: aiResponse.content,
        role: "assistant",
        savedToVector: shouldSaveToVector,
        sources: aiResponse.sources,
        similarityScore: null,
      });

      // Save to vector database if determined
      if (shouldSaveToVector) {
        try {
          const vectorResponse = await storage.createVectorResponse({
            messageId: assistantMessage.id,
            query: content,
            response: aiResponse.content,
            embedding: aiResponse.embedding,
            sources: aiResponse.sources,
          });

          await milvusService.insertVector({
            id: vectorResponse.id!,
            query: content,
            response: aiResponse.content,
            embedding: aiResponse.embedding,
            sources: aiResponse.sources,
            timestamp: vectorResponse.timestamp!.toISOString(),
          });
        } catch (error) {
          console.error("Error saving to vector database:", error);
        }
      }

      res.json({
        userMessage,
        assistantMessage,
        sources: mcpResponse.sources,
        memoryDecision: userDecision === null ? memoryDecision : null,
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

      const message = await storage.updateChatMessage(id, {
        savedToVector: saveToVector,
      });

      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }

      if (saveToVector && message.role === "assistant") {
        // Find the corresponding user message for the query
        const messages = await storage.getChatMessages();
        const messageIndex = messages.findIndex(m => m.id === id);
        const userMessage = messageIndex > 0 ? messages[messageIndex - 1] : null;

        if (userMessage && userMessage.role === "user") {
          const embedding = await generateEmbedding(message.content);
          
          const vectorResponse = await storage.createVectorResponse({
            messageId: message.id,
            query: userMessage.content,
            response: message.content,
            embedding,
            sources: message.sources || [],
          });

          await milvusService.insertVector({
            id: vectorResponse.id!,
            query: userMessage.content,
            response: message.content,
            embedding,
            sources: message.sources || [],
            timestamp: vectorResponse.timestamp!.toISOString(),
          });
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
      const results = await milvusService.searchSimilar(queryEmbedding, threshold, limit);

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
        milvus: milvusService.getConnectionStatus(),
        mcp: mcpClient.getConnectionStatus(),
        openai: openaiStatus.status === "fulfilled" ? openaiStatus.value : false,
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
      const stats = await milvusService.getCollectionStats();
      const lastMessage = (await storage.getChatMessages(1))[0];
      
      res.json({
        ...stats,
        lastUpdated: lastMessage?.timestamp ? 
          getTimeAgo(lastMessage.timestamp) : "Never",
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Clear database
  app.delete("/api/clear-database", async (req, res) => {
    try {
      await milvusService.clearCollection();
      await storage.deleteAllVectorResponses();
      
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
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}
