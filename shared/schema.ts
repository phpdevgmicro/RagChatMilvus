import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, real, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  content: text("content").notNull(),
  role: varchar("role", { length: 20 }).notNull(), // 'user' or 'assistant'
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  savedToVector: boolean("saved_to_vector").default(false),
  sources: json("sources").$type<string[]>().default([]),
  similarityScore: real("similarity_score"),
});

export const vectorResponses = pgTable("vector_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: varchar("message_id").references(() => chatMessages.id),
  query: text("query").notNull(),
  response: text("response").notNull(),
  embedding: json("embedding").$type<number[]>().notNull(),
  sources: json("sources").$type<string[]>().default([]),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  timestamp: true,
});

export const insertVectorResponseSchema = createInsertSchema(vectorResponses).omit({
  id: true,
  timestamp: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type VectorResponse = typeof vectorResponses.$inferSelect;
export type InsertVectorResponse = z.infer<typeof insertVectorResponseSchema>;
