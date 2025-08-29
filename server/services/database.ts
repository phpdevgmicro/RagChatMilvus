import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

export { pool };

export async function initializeDatabase() {
  try {
    // Create settings table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        key VARCHAR(255) UNIQUE NOT NULL,
        value TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert default settings if they don't exist
    const defaultSettings = [
      { key: 'systemPrompt', value: 'You are a helpful AI assistant.' },
      { key: 'userPromptTemplate', value: 'Context: {context}\n\nUser Question: {query}\n\nPlease provide a comprehensive answer based on the context and your knowledge.' },
      { key: 'userPromptNoContext', value: 'User Question: {query}\n\nPlease provide a comprehensive and helpful answer.' },
      { key: 'model', value: 'gpt-4o-mini' },
      { key: 'temperature', value: '1.0' },
      { key: 'maxTokens', value: '2048' }
    ];

    for (const setting of defaultSettings) {
      await pool.query(
        'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING',
        [setting.key, setting.value]
      );
    }

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

export async function getSetting(key: string): Promise<string | null> {
  try {
    const result = await pool.query('SELECT value FROM settings WHERE key = $1', [key]);
    return result.rows[0]?.value || null;
  } catch (error) {
    console.error('Error getting setting:', error);
    throw error;
  }
}

export async function setSetting(key: string, value: string): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO settings (key, value, updated_at) 
       VALUES ($1, $2, CURRENT_TIMESTAMP) 
       ON CONFLICT (key) 
       DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP`,
      [key, value]
    );
  } catch (error) {
    console.error('Error setting setting:', error);
    throw error;
  }
}

export async function getAllSettings(): Promise<Record<string, string>> {
  try {
    const result = await pool.query('SELECT key, value FROM settings');
    const settings: Record<string, string> = {};
    for (const row of result.rows) {
      settings[row.key] = row.value;
    }
    return settings;
  } catch (error) {
    console.error('Error getting all settings:', error);
    throw error;
  }
}