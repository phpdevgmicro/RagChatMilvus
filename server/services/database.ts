import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { settings } from '../../shared/schema';
import { eq } from 'drizzle-orm';

// Handle Supabase connection string and SSL configuration
let connectionString = process.env.DATABASE_URL;
const isSupabase = connectionString?.includes('supabase.com');

if (isSupabase && connectionString) {
  // Replace sslmode=require with sslmode=disable to avoid certificate issues in development
  connectionString = connectionString.replace('sslmode=require', 'sslmode=disable');
}

const pool = new Pool({
  connectionString,
  ssl: isSupabase ? false : undefined
});

// Initialize Drizzle ORM
export const db = drizzle(pool);

export { pool };

export async function initializeDatabase() {
  try {
    // Check if database has any settings at all
    const existingSettings = await db.select().from(settings).limit(1);
    
    // Only insert defaults if database is completely empty (first time setup)
    if (existingSettings.length === 0) {
      console.log('Database is empty. Inserting minimal default settings for first-time setup...');
      
      const minimalDefaults = [
        { key: 'systemPrompt', value: 'You are a helpful AI assistant.' },
        { key: 'userPromptTemplate', value: 'Context: {context}\n\nUser Question: {query}\n\nPlease provide a comprehensive answer based on the context and your knowledge.' },
        { key: 'userPromptNoContext', value: 'User Question: {query}\n\nPlease provide a comprehensive and helpful answer.' },
        { key: 'model', value: 'gpt-4o-mini' },
        { key: 'temperature', value: '1.0' },
        { key: 'maxTokens', value: '2048' }
      ];

      for (const setting of minimalDefaults) {
        await db.insert(settings).values({
          key: setting.key,
          value: setting.value
        });
      }
      
      console.log('Minimal default settings inserted for first-time setup');
    } else {
      console.log('Database already contains settings - skipping defaults');
    }

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

export async function getSetting(key: string): Promise<string | null> {
  try {
    const result = await db.select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, key))
      .limit(1);
    
    return result[0]?.value || null;
  } catch (error) {
    console.error('Error getting setting:', error);
    throw error;
  }
}

export async function setSetting(key: string, value: string): Promise<void> {
  try {
    await db.insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({
        target: settings.key,
        set: { 
          value: value,
          updatedAt: new Date()
        }
      });
  } catch (error) {
    console.error('Error setting setting:', error);
    throw error;
  }
}

export async function getAllSettings(): Promise<Record<string, string>> {
  try {
    const result = await db.select({ key: settings.key, value: settings.value })
      .from(settings);
    
    const settingsObj: Record<string, string> = {};
    for (const row of result) {
      settingsObj[row.key] = row.value;
    }
    return settingsObj;
  } catch (error) {
    console.error('Error getting all settings:', error);
    throw error;
  }
}