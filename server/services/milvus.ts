import { MilvusClient } from "@zilliz/milvus2-sdk-node";
import type { VectorResponse } from "@shared/schema";
import { db } from "../db";
import { vectorResponses } from "@shared/schema";
import { eq } from "drizzle-orm";

const COLLECTION_NAME = "chat_responses";
const VECTOR_DIM = 1536; // OpenAI embedding dimension

class MilvusService {
  private client: MilvusClient | null = null;
  private isConnected: boolean = false;
  private inMemoryVectors: Array<{
    id: string;
    query: string;
    response: string;
    embedding: number[];
    sources: string[];
    timestamp: string;
  }> = [];

  constructor() {
    // Only initialize Milvus client if connection info is provided
    if (process.env.MILVUS_ADDRESS) {
      this.client = new MilvusClient({
        address: process.env.MILVUS_ADDRESS,
        username: process.env.MILVUS_USERNAME || "",
        password: process.env.MILVUS_PASSWORD || "",
      });
    }
    // Load existing vectors from database on startup
    this.loadVectorsFromDatabase();
  }

  private async loadVectorsFromDatabase(): Promise<void> {
    try {
      const dbVectors = await db.select().from(vectorResponses);
      this.inMemoryVectors = dbVectors.map(vector => ({
        id: vector.id,
        query: vector.query,
        response: vector.response,
        embedding: vector.embedding,
        sources: vector.sources || [],
        timestamp: vector.timestamp?.toISOString() || new Date().toISOString(),
      }));
      console.log(`Loaded ${this.inMemoryVectors.length} vectors from database`);
    } catch (error) {
      console.error("Failed to load vectors from database:", error);
    }
  }

  async connect(): Promise<void> {
    if (!this.client) {
      console.log("Milvus not configured, using in-memory vector storage");
      this.isConnected = false;
      return;
    }

    try {
      // Test connection by checking collection
      const hasCollection = await this.client.hasCollection({
        collection_name: COLLECTION_NAME,
      });
      
      await this.ensureCollection();
      this.isConnected = true;
      console.log("Connected to Milvus successfully");
    } catch (error) {
      console.error("Failed to connect to Milvus:", error);
      this.isConnected = false;
      console.log("Using in-memory vector storage as fallback");
    }
  }

  async ensureCollection(): Promise<void> {
    if (!this.client) return;
    
    try {
      const hasCollection = await this.client.hasCollection({
        collection_name: COLLECTION_NAME,
      });

      if (!hasCollection.value) {
        await this.client.createCollection({
          collection_name: COLLECTION_NAME,
          fields: [
            {
              name: "id",
              data_type: 5, // VarChar
              max_length: 36,
              is_primary_key: true,
            },
            {
              name: "query",
              data_type: 21, // VarChar
              max_length: 2000,
            },
            {
              name: "response",
              data_type: 21, // VarChar
              max_length: 5000,
            },
            {
              name: "embedding",
              data_type: 101, // FloatVector
              dim: VECTOR_DIM,
            },
            {
              name: "sources",
              data_type: 21, // VarChar (JSON string)
              max_length: 1000,
            },
            {
              name: "timestamp",
              data_type: 21, // VarChar
              max_length: 50,
            }
          ],
        });

        await this.client.createIndex({
          collection_name: COLLECTION_NAME,
          field_name: "embedding",
          index_type: "IVF_FLAT",
          metric_type: "L2",
          params: { nlist: 100 },
        });

        await this.client.loadCollection({
          collection_name: COLLECTION_NAME,
        });
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
    if (this.isConnected && this.client) {
      try {
        await this.client.insert({
          collection_name: COLLECTION_NAME,
          data: [
            {
              id: vectorResponse.id,
              query: vectorResponse.query,
              response: vectorResponse.response,
              embedding: vectorResponse.embedding,
              sources: JSON.stringify(vectorResponse.sources),
              timestamp: vectorResponse.timestamp,
            }
          ],
        });

        await this.client.flush({
          collection_names: [COLLECTION_NAME],
        });
      } catch (error) {
        console.error("Failed to insert vector to Milvus:", error);
        // Fall back to in-memory storage
        this.inMemoryVectors.push(vectorResponse);
      }
    } else {
      // Store in database and in-memory for fast retrieval
      await this.storeVectorToDatabase(vectorResponse);
      this.inMemoryVectors.push(vectorResponse);
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
    if (this.isConnected && this.client) {
      try {
        const searchResults = await this.client.search({
          collection_name: COLLECTION_NAME,
          vectors: [queryEmbedding],
          search_params: {
            anns_field: "embedding",
            topk: limit,
            metric_type: "L2",
            params: { nprobe: 10 },
          },
          output_fields: ["id", "query", "response", "sources", "timestamp"],
        });

        return searchResults.results.map((result: any) => ({
          id: result.id,
          query: result.query,
          response: result.response,
          sources: JSON.parse(result.sources || "[]"),
          similarity: Math.max(0, 1 - result.score), // Convert L2 distance to similarity
          timestamp: result.timestamp,
        })).filter((result: any) => result.similarity >= threshold);
      } catch (error) {
        console.error("Failed to search similar vectors in Milvus:", error);
        // Fall back to in-memory search
      }
    }
    
    // In-memory similarity search using cosine similarity
    return this.inMemoryVectors
      .map(vector => ({
        ...vector,
        similarity: this.cosineSimilarity(queryEmbedding, vector.embedding),
      }))
      .filter(result => result.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  async getCollectionStats(): Promise<{
    totalResponses: number;
    collectionSize: string;
  }> {
    if (this.isConnected && this.client) {
      try {
        const stats = await this.client.getCollectionStatistics({
          collection_name: COLLECTION_NAME,
        });

        return {
          totalResponses: parseInt(stats.data.row_count || "0"),
          collectionSize: "N/A", // Milvus doesn't directly provide size info
        };
      } catch (error) {
        console.error("Failed to get collection stats:", error);
      }
    }
    
    // Return in-memory stats
    return {
      totalResponses: this.inMemoryVectors.length,
      collectionSize: `${(JSON.stringify(this.inMemoryVectors).length / 1024).toFixed(1)} KB`,
    };
  }

  async clearCollection(): Promise<void> {
    if (this.isConnected && this.client) {
      try {
        await this.client.dropCollection({
          collection_name: COLLECTION_NAME,
        });
        await this.ensureCollection();
      } catch (error) {
        console.error("Failed to clear Milvus collection:", error);
      }
    }
    
    // Clear database and in-memory storage
    try {
      await db.delete(vectorResponses);
    } catch (error) {
      console.error("Failed to clear vectors from database:", error);
    }
    this.inMemoryVectors = [];
  }

  private async storeVectorToDatabase(vectorResponse: {
    id: string;
    query: string;
    response: string;
    embedding: number[];
    sources: string[];
    timestamp: string;
  }): Promise<void> {
    try {
      await db.insert(vectorResponses).values({
        id: vectorResponse.id,
        query: vectorResponse.query,
        response: vectorResponse.response,
        embedding: vectorResponse.embedding,
        sources: vectorResponse.sources,
        timestamp: new Date(vectorResponse.timestamp),
      });
    } catch (error) {
      console.error("Failed to store vector to database:", error);
      throw error;
    }
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  // Helper method for cosine similarity calculation
  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return magnitudeA === 0 || magnitudeB === 0 ? 0 : dotProduct / (magnitudeA * magnitudeB);
  }
}

export const milvusService = new MilvusService();
