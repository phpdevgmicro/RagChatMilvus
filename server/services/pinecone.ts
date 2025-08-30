import { Pinecone } from '@pinecone-database/pinecone';
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

const INDEX_NAME = "chat-responses";
const VECTOR_DIM = 1536; // OpenAI embedding dimension

class PineconeService {
  private client: Pinecone | null = null;
  private isConnected: boolean = false;
  private index: any = null;
  private connectionRetries: number = 0;
  private readonly maxRetries: number = 3;

  constructor() {
    // Only initialize Pinecone client if API key is provided
    if (process.env.PINECONE_API_KEY) {
      this.client = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY,
      });
    }
  }

  async connect(): Promise<void> {
    if (!this.client) {
      throw new Error("Pinecone API key must be configured. Please set PINECONE_API_KEY environment variable.");
    }

    while (this.connectionRetries < this.maxRetries) {
      try {
        // Test connection by listing indexes
        await this.client.listIndexes();
        
        await this.ensureIndex();
        this.index = this.client.index(INDEX_NAME);
        this.isConnected = true;
        this.connectionRetries = 0; // Reset retry counter on success
        console.log("Connected to Pinecone successfully");
        return;
      } catch (error) {
        this.connectionRetries++;
        console.error(`Failed to connect to Pinecone (attempt ${this.connectionRetries}/${this.maxRetries}):`, error);
        
        if (this.connectionRetries >= this.maxRetries) {
          this.isConnected = false;
          throw new Error(`Failed to connect to Pinecone after ${this.maxRetries} attempts`);
        }
        
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, this.connectionRetries) * 1000));
      }
    }
  }

  async ensureIndex(): Promise<void> {
    if (!this.client) return;
    
    try {
      // Check if index exists
      const indexes = await this.client.listIndexes();
      const indexExists = indexes.indexes?.some(
        (idx) => idx.name === INDEX_NAME
      );

      if (!indexExists) {
        await this.client.createIndex({
          name: INDEX_NAME,
          dimension: VECTOR_DIM,
          metric: 'cosine',
          spec: {
            serverless: {
              cloud: 'aws',
              region: 'us-east-1'
            }
          }
        });
        console.log(`Created Pinecone index: ${INDEX_NAME}`);
        
        // Wait for index to be ready
        let isReady = false;
        while (!isReady) {
          const indexStats = await this.client.describeIndex(INDEX_NAME);
          isReady = indexStats.status?.ready === true;
          if (!isReady) {
            console.log('Waiting for index to be ready...');
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }
    } catch (error) {
      console.error("Failed to ensure index:", error);
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
    if (!this.isConnected || !this.index) {
      throw new Error("Pinecone is not connected. Please ensure PINECONE_API_KEY is configured.");
    }

    // Validate inputs
    if (!Array.isArray(vectorResponse.embedding) || vectorResponse.embedding.length !== VECTOR_DIM) {
      throw new Error(`Invalid embedding dimension. Expected ${VECTOR_DIM}, got ${vectorResponse.embedding.length}`);
    }

    try {
      // Ensure metadata strings are truncated to prevent Pinecone limits
      const metadata = {
        query: vectorResponse.query.substring(0, 1000), // Limit query length
        response: vectorResponse.response.substring(0, 5000), // Limit response length
        sources: Array.isArray(vectorResponse.sources) ? vectorResponse.sources.slice(0, 10) : [], // Limit sources count
        timestamp: vectorResponse.timestamp,
      };

      await this.index.upsert([
        {
          id: vectorResponse.id,
          values: vectorResponse.embedding,
          metadata,
        },
      ]);
      
      console.log(`✅ Successfully inserted vector with ID: ${vectorResponse.id}`);
    } catch (error) {
      console.error("Failed to insert vector to Pinecone:", error);
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
    if (!this.isConnected || !this.index) {
      console.warn("Pinecone is not connected, returning empty results");
      return [];
    }

    // Validate inputs
    if (!Array.isArray(queryEmbedding) || queryEmbedding.length !== VECTOR_DIM) {
      throw new Error(`Invalid embedding dimension. Expected ${VECTOR_DIM}, got ${queryEmbedding.length}`);
    }

    try {
      const searchResults = await this.index.query({
        vector: queryEmbedding,
        topK: Math.min(limit, 50), // Cap limit to prevent excessive results
        includeMetadata: true,
        includeValues: false, // Don't return vectors for performance
      });

      const results = searchResults.matches
        ?.filter((result: any) => result.score >= threshold && result.metadata)
        .map((result: any) => ({
          id: result.id,
          query: result.metadata.query || '',
          response: result.metadata.response || '',
          sources: Array.isArray(result.metadata.sources) ? result.metadata.sources : [],
          similarity: Number(result.score.toFixed(4)), // Round to 4 decimal places
          timestamp: result.metadata.timestamp || '',
        })) || [];

      return results.sort((a: any, b: any) => b.similarity - a.similarity); // Sort by similarity descending
    } catch (error) {
      console.error("Failed to search similar vectors in Pinecone:", error);
      // Return empty array instead of throwing to maintain app functionality
      return [];
    }
  }

  async getCollectionStats(): Promise<{
    totalResponses: number;
    collectionSize: string;
  }> {
    if (!this.isConnected || !this.index) {
      return {
        totalResponses: 0,
        collectionSize: "Disconnected",
      };
    }

    try {
      const stats = await this.index.describeIndexStats();
      const vectorCount = stats.totalVectorCount || 0;
      
      // Estimate size based on vector count (rough calculation)
      const estimatedSizeMB = Math.round((vectorCount * VECTOR_DIM * 4) / (1024 * 1024));
      const sizeDisplay = estimatedSizeMB > 0 ? `~${estimatedSizeMB}MB` : "<1MB";

      return {
        totalResponses: vectorCount,
        collectionSize: sizeDisplay,
      };
    } catch (error) {
      console.error("Failed to get index stats:", error);
      return {
        totalResponses: 0,
        collectionSize: "Error",
      };
    }
  }

  async clearCollection(): Promise<void> {
    if (!this.isConnected || !this.index) {
      throw new Error("Pinecone is not connected. Please ensure PINECONE_API_KEY is configured.");
    }

    try {
      await this.index.deleteAll();
      console.log("✅ Successfully cleared all vectors from Pinecone index");
    } catch (error) {
      console.error("Failed to clear Pinecone index:", error);
      throw error;
    }
  }

  async deleteVector(vectorId: string): Promise<void> {
    if (!this.isConnected || !this.index) {
      throw new Error("Pinecone is not connected. Please ensure PINECONE_API_KEY is configured.");
    }

    try {
      await this.index.deleteOne(vectorId);
      console.log(`Deleted vector with ID: ${vectorId}`);
    } catch (error) {
      console.error("Failed to delete vector from Pinecone:", error);
      throw error;
    }
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }
}

export const pineconeService = new PineconeService();