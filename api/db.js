import { Client, Pool } from 'pg';

// Database configuration
const dbConfig = {
  host: 'aws-1-us-east-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.msfhsfpvhbzvpzalwxoz',
  password: 'aKpFI9eQCxAUn0eN',
  ssl: {
    rejectUnauthorized: false
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Create connection pool
const pool = new Pool(dbConfig);

// Database service
class Database {
  constructor() {
    this.pool = pool;
  }

  async query(text, params = []) {
    try {
      const result = await this.pool.query(text, params);
      return result;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }

  async testConnection() {
    try {
      const result = await this.query('SELECT NOW() as time');
      return { success: true, time: result.rows[0].time };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Save chat message
  async saveChatMessage(userEmail, message, response, agentType) {
    const query = `
      INSERT INTO chat_messages (user_email, message, response, agent_type)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const result = await this.query(query, [userEmail, message, response, agentType]);
    return result.rows[0];
  }

  // Get chat history
  async getChatHistory(userEmail, limit = 10) {
    const query = `
      SELECT * FROM chat_messages 
      WHERE user_email = $1 
      ORDER BY created_at DESC 
      LIMIT $2
    `;
    const result = await this.query(query, [userEmail, limit]);
    return result.rows;
  }

  // Create or get user
  async createUser(email, name) {
    const query = `
      INSERT INTO users (email, name) 
      VALUES ($1, $2) 
      ON CONFLICT (email) DO UPDATE SET name = $2
      RETURNING *
    `;
    const result = await this.query(query, [email, name]);
    return result.rows[0];
  }
}

export default new Database();