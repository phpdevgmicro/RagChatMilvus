import { type User, type InsertUser, type ChatMessage, type InsertChatMessage, type VectorResponse, type InsertVectorResponse, users, chatMessages, vectorResponses } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Chat message methods
  getChatMessages(limit?: number): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  updateChatMessage(id: string, updates: Partial<ChatMessage>): Promise<ChatMessage | undefined>;
  
  // Vector response methods
  getVectorResponses(): Promise<VectorResponse[]>;
  createVectorResponse(vectorResponse: InsertVectorResponse): Promise<VectorResponse>;
  deleteAllVectorResponses(): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private chatMessages: Map<string, ChatMessage>;
  private vectorResponses: Map<string, VectorResponse>;

  constructor() {
    this.users = new Map();
    this.chatMessages = new Map();
    this.vectorResponses = new Map();
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Chat message methods
  async getChatMessages(limit: number = 50): Promise<ChatMessage[]> {
    const messages = Array.from(this.chatMessages.values())
      .sort((a, b) => (a.timestamp?.getTime() || 0) - (b.timestamp?.getTime() || 0))
      .slice(-limit);
    return messages;
  }

  async createChatMessage(insertMessage: InsertChatMessage): Promise<ChatMessage> {
    const id = randomUUID();
    const message: ChatMessage = {
      ...insertMessage,
      id,
      timestamp: new Date(),
      savedToVector: insertMessage.savedToVector ?? false,
      sources: Array.isArray(insertMessage.sources) ? insertMessage.sources as string[] : [],
      similarityScore: insertMessage.similarityScore ?? null,
    };
    this.chatMessages.set(id, message);
    return message;
  }

  async updateChatMessage(id: string, updates: Partial<ChatMessage>): Promise<ChatMessage | undefined> {
    const message = this.chatMessages.get(id);
    if (!message) return undefined;
    
    const updatedMessage = { ...message, ...updates };
    this.chatMessages.set(id, updatedMessage);
    return updatedMessage;
  }

  // Vector response methods
  async getVectorResponses(): Promise<VectorResponse[]> {
    return Array.from(this.vectorResponses.values())
      .sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0));
  }

  async createVectorResponse(insertVectorResponse: InsertVectorResponse): Promise<VectorResponse> {
    const id = randomUUID();
    const vectorResponse: VectorResponse = {
      ...insertVectorResponse,
      id,
      timestamp: new Date(),
      sources: Array.isArray(insertVectorResponse.sources) ? insertVectorResponse.sources as string[] : [],
      messageId: insertVectorResponse.messageId ?? null,
    };
    this.vectorResponses.set(id, vectorResponse);
    return vectorResponse;
  }

  async deleteAllVectorResponses(): Promise<void> {
    this.vectorResponses.clear();
  }
}

// Production-ready database storage with PostgreSQL
export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  // Chat message methods
  async getChatMessages(limit: number = 50): Promise<ChatMessage[]> {
    const messages = await db
      .select()
      .from(chatMessages)
      .orderBy(chatMessages.timestamp)
      .limit(limit);
    return messages;
  }

  async createChatMessage(insertMessage: InsertChatMessage): Promise<ChatMessage> {
    const [message] = await db
      .insert(chatMessages)
      .values({
        ...insertMessage,
        sources: insertMessage.sources || []
      })
      .returning();
    return message;
  }

  async updateChatMessage(id: string, updates: Partial<ChatMessage>): Promise<ChatMessage | undefined> {
    const [message] = await db
      .update(chatMessages)
      .set(updates)
      .where(eq(chatMessages.id, id))
      .returning();
    return message || undefined;
  }

  // Vector response methods
  async getVectorResponses(): Promise<VectorResponse[]> {
    const responses = await db
      .select()
      .from(vectorResponses)
      .orderBy(desc(vectorResponses.timestamp));
    return responses;
  }

  async createVectorResponse(insertVectorResponse: InsertVectorResponse): Promise<VectorResponse> {
    const [vectorResponse] = await db
      .insert(vectorResponses)
      .values({
        ...insertVectorResponse,
        sources: insertVectorResponse.sources || [],
        embedding: insertVectorResponse.embedding as number[]
      })
      .returning();
    return vectorResponse;
  }

  async deleteAllVectorResponses(): Promise<void> {
    await db.delete(vectorResponses);
  }
}

// Use production database storage
export const storage = new DatabaseStorage();
