import { QdrantClient } from "@qdrant/js-client-rest";
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  sources?: string[];
  savedToVector?: boolean;
}

export interface VectorResponse {
  id: string;
  query: string;
  response: string;
  embedding: number[];
  sources: string[];
  timestamp: string;
}

const COLLECTION_NAME = "chat_responses";
const VECTOR_DIM = 1536; // OpenAI embedding dimension

class QdrantService {
  private client: QdrantClient | null = null;
  private isConnected: boolean = false;

  constructor() {
    // Only initialize Qdrant client if connection info is provided
    if (process.env.QDRANT_URL) {
      this.client = new QdrantClient({
        url: process.env.QDRANT_URL,
        apiKey: process.env.QDRANT_API_KEY,
      });
    }
  }

  async connect(): Promise<void> {
    if (!this.client) {
      throw new Error("Qdrant URL and API key must be configured. Please set QDRANT_URL and QDRANT_API_KEY environment variables.");
    }

    try {
      // Test connection by checking if collection exists
      const collections = await this.client.getCollections();
      
      await this.ensureCollection();
      this.isConnected = true;
      console.log("Connected to Qdrant cloud successfully");
    } catch (error) {
      console.error("Failed to connect to Qdrant cloud:", error);
      this.isConnected = false;
      throw error;
    }
  }

  async ensureCollection(): Promise<void> {
    if (!this.client) return;
    
    try {
      // Check if collection exists
      const collections = await this.client.getCollections();
      const collectionExists = collections.collections.some(
        (col) => col.name === COLLECTION_NAME
      );

      if (!collectionExists) {
        await this.client.createCollection(COLLECTION_NAME, {
          vectors: {
            size: VECTOR_DIM,
            distance: "Cosine",
          },
        });
        console.log(`Created Qdrant collection: ${COLLECTION_NAME}`);
      }
    } catch (error) {
      console.error("Failed to ensure collection:", error);
      throw error;
    }
  }

  async insertVector(vectorResponse: {
    id: string;
    query: string;
    response: string;
    embedding: number[];
    sources: string[];
    timestamp: string;
  }): Promise<void> {
    if (!this.isConnected || !this.client) {
      throw new Error("Qdrant is not connected. Please ensure QDRANT_URL and QDRANT_API_KEY are configured.");
    }

    try {
      await this.client.upsert(COLLECTION_NAME, {
        wait: true,
        points: [
          {
            id: vectorResponse.id,
            vector: vectorResponse.embedding,
            payload: {
              query: vectorResponse.query,
              response: vectorResponse.response,
              sources: vectorResponse.sources,
              timestamp: vectorResponse.timestamp,
            },
          },
        ],
      });
    } catch (error) {
      console.error("Failed to insert vector to Qdrant:", error);
      throw error;
    }
  }

  async searchSimilar(queryEmbedding: number[], threshold: number = 0.7, limit: number = 10): Promise<Array<{
    id: string;
    query: string;
    response: string;
    sources: string[];
    similarity: number;
    timestamp: string;
  }>> {
    if (!this.isConnected || !this.client) {
      throw new Error("Qdrant is not connected. Please ensure QDRANT_URL and QDRANT_API_KEY are configured.");
    }

    try {
      const searchResults = await this.client.search(COLLECTION_NAME, {
        vector: queryEmbedding,
        limit,
        score_threshold: threshold,
        with_payload: true,
      });

      return searchResults.map((result: any) => ({
        id: result.id,
        query: result.payload.query,
        response: result.payload.response,
        sources: result.payload.sources || [],
        similarity: result.score,
        timestamp: result.payload.timestamp,
      }));
    } catch (error) {
      console.error("Failed to search similar vectors in Qdrant:", error);
      throw error;
    }
  }

  async getCollectionStats(): Promise<{
    totalResponses: number;
    collectionSize: string;
  }> {
    if (!this.isConnected || !this.client) {
      throw new Error("Qdrant is not connected. Please ensure QDRANT_URL and QDRANT_API_KEY are configured.");
    }

    try {
      const info = await this.client.getCollection(COLLECTION_NAME);

      return {
        totalResponses: info.points_count || 0,
        collectionSize: "N/A", // Qdrant doesn't directly provide size info
      };
    } catch (error) {
      console.error("Failed to get collection stats:", error);
      throw error;
    }
  }

  async clearCollection(): Promise<void> {
    if (!this.isConnected || !this.client) {
      throw new Error("Qdrant is not connected. Please ensure QDRANT_URL and QDRANT_API_KEY are configured.");
    }

    try {
      await this.client.deleteCollection(COLLECTION_NAME);
      await this.ensureCollection();
    } catch (error) {
      console.error("Failed to clear Qdrant collection:", error);
      throw error;
    }
  }

  async deleteVector(vectorId: string): Promise<void> {
    if (!this.isConnected || !this.client) {
      throw new Error("Qdrant is not connected. Please ensure QDRANT_URL and QDRANT_API_KEY are configured.");
    }

    try {
      await this.client.delete(COLLECTION_NAME, {
        wait: true,
        points: [vectorId],
      });
      console.log(`Deleted vector with ID: ${vectorId}`);
    } catch (error) {
      console.error("Failed to delete vector from Qdrant:", error);
      throw error;
    }
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }
}

export const qdrantService = new QdrantService();