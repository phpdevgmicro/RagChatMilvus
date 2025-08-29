import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { settings } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import dotenv from 'dotenv';
dotenv.config();

// Use Replit database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Initialize Drizzle ORM
export const db = drizzle(pool);

export { pool };

// Settings cache for performance optimization
let settingsCache: Record<string, string> | null = null;
let cacheInitialized = false;

export async function initializeDatabase() {
  try {
    // Check if database has any settings at all
    const existingSettings = await db.select().from(settings).limit(1);
    
    // Only insert defaults if database is completely empty (first time setup)
    if (existingSettings.length === 0) {
      console.log('Database is empty. Inserting minimal default settings for first-time setup...');
      
      const minimalDefaults = [
        { key: 'systemPrompt', value: 'You are a helpful AI assistant.' },
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

    // Initialize settings cache after database setup
    await loadSettingsToCache();
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

// Load all settings into cache for fast access
export async function loadSettingsToCache(): Promise<void> {
  try {
    const allSettings = await db.select().from(settings);
    settingsCache = {};
    
    for (const setting of allSettings) {
      settingsCache[setting.key] = setting.value;
    }
    
    cacheInitialized = true;
    console.log('Settings cache loaded with', Object.keys(settingsCache).length, 'settings');
  } catch (error) {
    console.error('Error loading settings to cache:', error);
    throw error;
  }
}

// Get all settings from cache (fast)
export function getAllSettingsFromCache(): Record<string, string> {
  if (!cacheInitialized || !settingsCache) {
    throw new Error('Settings cache not initialized. Please call loadSettingsToCache() first.');
  }
  return { ...settingsCache };
}

// Invalidate cache when settings are updated
export async function invalidateSettingsCache(): Promise<void> {
  await loadSettingsToCache();
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
    
    // Invalidate cache after updating settings
    await invalidateSettingsCache();
  } catch (error) {
    console.error('Error setting setting:', error);
    throw error;
  }
}

