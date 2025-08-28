import { type User, type InsertUser, type ChatMessage, type InsertChatMessage, type VectorResponse, type InsertVectorResponse } from "@shared/schema";
import { randomUUID } from "crypto";

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
      sources: Array.isArray(insertMessage.sources) ? insertMessage.sources : [],
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
      sources: Array.isArray(insertVectorResponse.sources) ? insertVectorResponse.sources : [],
      messageId: insertVectorResponse.messageId ?? null,
    };
    this.vectorResponses.set(id, vectorResponse);
    return vectorResponse;
  }

  async deleteAllVectorResponses(): Promise<void> {
    this.vectorResponses.clear();
  }
}

export const storage = new MemStorage();
