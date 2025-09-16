import { createClient } from '@supabase/supabase-js';
import winston from 'winston';
import pg from 'pg';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Generic Postgres (e.g., Vercel Postgres/Neon)
const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL_NON_POOLING;
let pgPool = null;
if (DATABASE_URL) {
  try {
    const { Pool } = pg;
    pgPool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  } catch (e) {
    logger.error('Failed to initialize pg pool', { error: e.message });
  }
}

// Create Supabase clients
export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export const supabaseAdmin = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

// Database helper functions
export class DatabaseService {
  constructor() {
    this.client = supabase;
    this.adminClient = supabaseAdmin;
  }

  // User management
  async createUser(userData) {
    try {
      const { data, error } = await this.adminClient
        .from('users')
        .insert([{
          email: userData.email,
          phone: userData.phone,
          full_name: userData.fullName,
          password_hash: userData.passwordHash,
          subscription_level: userData.subscriptionLevel || 'جيش جونسون',
          is_verified: userData.isVerified || false,
          metadata: userData.metadata || {}
        }])
        .select()
        .single();

      if (error) throw error;
      return { success: true, user: data };
    } catch (error) {
      logger.error('Error creating user:', error);
      return { success: false, error: error.message };
    }
  }

  async getUserByEmail(email) {
    try {
      const { data, error } = await this.adminClient
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return { success: true, user: data };
    } catch (error) {
      logger.error('Error getting user by email:', error);
      return { success: false, error: error.message };
    }
  }

  async getUserById(id) {
    try {
      const { data, error } = await this.adminClient
        .from('users')
        .select('*')
        .eq('id', id)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return { success: true, user: data };
    } catch (error) {
      logger.error('Error getting user by id:', error);
      return { success: false, error: error.message };
    }
  }

  async getUserByPhone(phone) {
    try {
      const { data, error } = await this.adminClient
        .from('users')
        .select('*')
        .eq('phone', phone)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return { success: true, user: data };
    } catch (error) {
      logger.error('Error getting user by phone:', error);
      return { success: false, error: error.message };
    }
  }

  async updateUser(userId, updates) {
    try {
      const { data, error } = await this.adminClient
        .from('users')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;
      return { success: true, user: data };
    } catch (error) {
      logger.error('Error updating user:', error);
      return { success: false, error: error.message };
    }
  }

  // Session management
  async createSession(sessionData) {
    try {
      const { data, error } = await this.adminClient
        .from('user_sessions')
        .insert([{
          user_id: sessionData.userId,
          session_token: sessionData.sessionToken,
          refresh_token: sessionData.refreshToken,
          expires_at: sessionData.expiresAt,
          ip_address: sessionData.ipAddress,
          user_agent: sessionData.userAgent
        }])
        .select()
        .single();

      if (error) throw error;
      return { success: true, session: data };
    } catch (error) {
      logger.error('Error creating session:', error);
      return { success: false, error: error.message };
    }
  }

  async getSession(sessionToken) {
    try {
      const { data, error } = await this.adminClient
        .from('user_sessions')
        .select(`
          *,
          users (
            id,
            email,
            full_name,
            subscription_level,
            is_verified,
            is_active
          )
        `)
        .eq('session_token', sessionToken)
        .eq('is_active', true)
        .gte('expires_at', new Date().toISOString())
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return { success: true, session: data };
    } catch (error) {
      logger.error('Error getting session:', error);
      return { success: false, error: error.message };
    }
  }

  async invalidateSession(sessionToken) {
    try {
      const { error } = await this.adminClient
        .from('user_sessions')
        .update({ is_active: false })
        .eq('session_token', sessionToken);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      logger.error('Error invalidating session:', error);
      return { success: false, error: error.message };
    }
  }

  // OTP management
  async createOTP(identifier, otpCode, otpType, expiresAt) {
    try {
      // Invalidate existing OTPs for this identifier
      await this.adminClient
        .from('otp_verifications')
        .update({ is_verified: true })
        .eq('identifier', identifier)
        .eq('otp_type', otpType);

      const { data, error } = await this.adminClient
        .from('otp_verifications')
        .insert([{
          identifier,
          otp_code: otpCode,
          otp_type: otpType,
          expires_at: expiresAt
        }])
        .select()
        .single();

      if (error) throw error;
      return { success: true, otp: data };
    } catch (error) {
      logger.error('Error creating OTP:', error);
      return { success: false, error: error.message };
    }
  }

  async verifyOTP(identifier, otpCode, otpType) {
    try {
      const { data, error } = await this.adminClient
        .from('otp_verifications')
        .select('*')
        .eq('identifier', identifier)
        .eq('otp_code', otpCode)
        .eq('otp_type', otpType)
        .eq('is_verified', false)
        .gte('expires_at', new Date().toISOString())
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return { success: false, error: 'Invalid or expired OTP' };
        }
        throw error;
      }

      // Mark OTP as verified
      await this.adminClient
        .from('otp_verifications')
        .update({ is_verified: true })
        .eq('id', data.id);

      return { success: true, otp: data };
    } catch (error) {
      logger.error('Error verifying OTP:', error);
      return { success: false, error: error.message };
    }
  }

  // Conversation management
  async createConversation(userId, agentType, title) {
    try {
      const { data, error } = await this.adminClient
        .from('conversations')
        .insert([{
          user_id: userId,
          agent_type: agentType,
          title: title || `محادثة ${agentType}`
        }])
        .select()
        .single();

      if (error) throw error;
      return { success: true, conversation: data };
    } catch (error) {
      logger.error('Error creating conversation:', error);
      return { success: false, error: error.message };
    }
  }

  async getUserConversations(userId, limit = 50) {
    try {
      const { data, error } = await this.adminClient
        .from('conversations')
        .select(`
          *,
          messages (
            id,
            role,
            content,
            created_at
          )
        `)
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return { success: true, conversations: data };
    } catch (error) {
      logger.error('Error getting user conversations:', error);
      return { success: false, error: error.message };
    }
  }

  // Message management
  async createMessage(conversationId, userId, role, content, tokensUsed = 0, modelUsed = null) {
    try {
      const { data, error } = await this.adminClient
        .from('messages')
        .insert([{
          conversation_id: conversationId,
          user_id: userId,
          role,
          content,
          tokens_used: tokensUsed,
          model_used: modelUsed
        }])
        .select()
        .single();

      if (error) throw error;

      // Update conversation timestamp
      await this.adminClient
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);

      return { success: true, message: data };
    } catch (error) {
      logger.error('Error creating message:', error);
      return { success: false, error: error.message };
    }
  }

  // Usage tracking
  async trackUsage(userId, actionType, resourceUsed, quantity = 1, costTokens = 0) {
    try {
      const { data, error } = await this.adminClient
        .from('usage_tracking')
        .insert([{
          user_id: userId,
          action_type: actionType,
          resource_used: resourceUsed,
          quantity,
          cost_tokens: costTokens
        }])
        .select()
        .single();

      if (error) throw error;
      return { success: true, usage: data };
    } catch (error) {
      logger.error('Error tracking usage:', error);
      return { success: false, error: error.message };
    }
  }

  async getUserQuota(userId) {
    try {
      const { data, error } = await this.adminClient
        .rpc('get_user_quota', { user_uuid: userId });

      if (error) throw error;
      return { success: true, quota: data[0] };
    } catch (error) {
      logger.error('Error getting user quota:', error);
      return { success: false, error: error.message };
    }
  }

  // System logging
  async logEvent(level, message, source, userId = null, metadata = {}) {
    try {
      const { error } = await this.adminClient
        .from('system_logs')
        .insert([{
          level,
          message,
          source,
          user_id: userId,
          metadata
        }]);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      logger.error('Error logging event:', error);
      return { success: false, error: error.message };
    }
  }

  // Health check
  async healthCheck() {
    try {
      const { data, error } = await this.client
        .from('users')
        .select('count')
        .limit(1);

      if (error) throw error;
      return { success: true, status: 'healthy' };
    } catch (error) {
      logger.error('Database health check failed:', error);
      return { success: false, status: 'unhealthy', error: error.message };
    }
  }
}

// Postgres-backed implementation (Vercel Postgres/Neon)
class DatabaseServicePg {
  constructor() {
    this.pool = pgPool;
  }

  async createUser(userData) {
    try {
      const { rows } = await this.pool.query(
        `INSERT INTO users (email, phone, full_name, password_hash, subscription_level, is_verified, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING *`,
        [
          userData.email || null,
          userData.phone || null,
          userData.fullName || null,
          userData.passwordHash || null,
          userData.subscriptionLevel || 'basic',
          userData.isVerified || false,
          userData.metadata || {}
        ]
      );
      return { success: true, user: rows[0] };
    } catch (error) {
      logger.error('PG createUser error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  async getUserByEmail(email) {
    try {
      const { rows } = await this.pool.query(
        `SELECT * FROM users WHERE email = $1 AND is_active = TRUE LIMIT 1`,
        [email]
      );
      return { success: true, user: rows[0] };
    } catch (error) {
      logger.error('PG getUserByEmail error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  async getUserById(id) {
    try {
      const { rows } = await this.pool.query(
        `SELECT * FROM users WHERE id = $1 AND is_active = TRUE LIMIT 1`,
        [id]
      );
      return { success: true, user: rows[0] };
    } catch (error) {
      logger.error('PG getUserById error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  async getUserByPhone(phone) {
    try {
      const { rows } = await this.pool.query(
        `SELECT * FROM users WHERE phone = $1 AND is_active = TRUE LIMIT 1`,
        [phone]
      );
      return { success: true, user: rows[0] };
    } catch (error) {
      logger.error('PG getUserByPhone error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  async updateUser(userId, updates) {
    try {
      const fields = [];
      const values = [];
      let idx = 1;
      for (const [k, v] of Object.entries(updates)) {
        fields.push(`${k} = $${idx++}`);
        values.push(v);
      }
      values.push(userId);
      const { rows } = await this.pool.query(
        `UPDATE users SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`,
        values
      );
      return { success: true, user: rows[0] };
    } catch (error) {
      logger.error('PG updateUser error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  async createOTP(identifier, otpCode, otpType, expiresAt) {
    try {
      await this.pool.query(
        `UPDATE otp_verifications SET is_verified = TRUE WHERE identifier = $1 AND otp_type = $2`,
        [identifier, otpType]
      );
      const { rows } = await this.pool.query(
        `INSERT INTO otp_verifications (identifier, otp_code, otp_type, expires_at)
         VALUES ($1,$2,$3,$4) RETURNING *`,
        [identifier, otpCode, otpType, expiresAt]
      );
      return { success: true, otp: rows[0] };
    } catch (error) {
      logger.error('PG createOTP error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  async verifyOTP(identifier, otpCode, otpType) {
    try {
      const { rows } = await this.pool.query(
        `SELECT * FROM otp_verifications WHERE identifier = $1 AND otp_code = $2 AND otp_type = $3 AND is_verified = FALSE AND expires_at >= NOW() LIMIT 1`,
        [identifier, otpCode, otpType]
      );
      const row = rows[0];
      if (!row) return { success: false, error: 'Invalid or expired OTP' };
      await this.pool.query(`UPDATE otp_verifications SET is_verified = TRUE WHERE id = $1`, [row.id]);
      return { success: true, otp: row };
    } catch (error) {
      logger.error('PG verifyOTP error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  async healthCheck() {
    try { await this.pool.query('SELECT 1'); return { success: true, status: 'healthy' }; }
    catch (error) { return { success: false, status: 'unhealthy', error: error.message }; }
  }
}

// Export singleton instance
export const db = (pgPool ? new DatabaseServicePg() : new DatabaseService());

// Connection status
export const isDatabaseConnected = () => {
  return !!(pgPool || (supabaseUrl && supabaseAnonKey));
};

export const isDatabaseAdminConnected = () => {
  return !!(pgPool || (supabaseUrl && supabaseServiceKey));
};

// Import new database manager
import databaseManager from './database-config.js';

// Initialize database connection
if (isDatabaseConnected()) {
  logger.info('✅ Database connection initialized');
} else {
  // Use new database manager which handles the warning internally
  logger.info('🔄 Initializing database manager...');
}
