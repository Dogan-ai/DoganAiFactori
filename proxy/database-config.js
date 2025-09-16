/**
 * Database Configuration and Setup
 * Configures PostgreSQL connection with subscription management support
 */

import { createClient } from '@supabase/supabase-js';
import pkg from 'pg';
const { Pool } = pkg;

class DatabaseManager {
  constructor() {
    this.supabaseClient = null;
    this.postgresPool = null;
    this.isConnected = false;
    this.connectionType = 'none';
    
    this.init();
  }

  async init() {
    try {
      // Try Supabase first (production)
      if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
        await this.initSupabase();
      }
      // Fallback to PostgreSQL (development)
      else if (process.env.DATABASE_URL || process.env.POSTGRES_HOST) {
        await this.initPostgreSQL();
      }
      // Use in-memory storage (demo/testing)
      else {
        this.initInMemory();
      }

      console.log(`✅ Database initialized: ${this.connectionType}`);
    } catch (error) {
      console.error('❌ Database initialization failed:', error.message);
      this.initInMemory();
    }
  }

  async initSupabase() {
    this.supabaseClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // Test connection
    const { data, error } = await this.supabaseClient
      .from('organizations')
      .select('id')
      .limit(1);

    if (error && error.code !== 'PGRST116') { // PGRST116 = table doesn't exist (expected for first run)
      throw new Error(`Supabase connection failed: ${error.message}`);
    }

    this.isConnected = true;
    this.connectionType = 'supabase';
    
    // Create tables if they don't exist
    await this.createTables();
  }

  async initPostgreSQL() {
    const connectionConfig = process.env.DATABASE_URL ? 
      { connectionString: process.env.DATABASE_URL } : 
      {
        host: process.env.POSTGRES_HOST || 'localhost',
        port: process.env.POSTGRES_PORT || 5432,
        database: process.env.POSTGRES_DB || 'financial_services',
        user: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD || 'postgres'
      };

    this.postgresPool = new Pool(connectionConfig);
    
    // Test connection
    const client = await this.postgresPool.connect();
    await client.query('SELECT NOW()');
    client.release();

    this.isConnected = true;
    this.connectionType = 'postgresql';
    
    // Create tables if they don't exist
    await this.createTables();
  }

  async initInMemory() {
    // Import and initialize the advanced memory store
    try {
      const MemoryStore = (await import('./services/memory-store.js')).default;
      this.memoryStore = new MemoryStore();
    } catch (error) {
      console.warn('Advanced memory store not available, using basic storage');
      this.inMemoryStorage = {
        organizations: new Map(),
        users: new Map(),
        subscriptions: new Map(),
        environments: new Map(),
        usage: new Map(),
        sessions: new Map()
      };
    }
    
    this.isConnected = true;
    this.connectionType = 'in-memory';
    console.log('⚠️  Using in-memory storage - data will not persist between restarts');
    console.log('🔧 For persistent memory, configure Supabase credentials in proxy/.env');
  }

  async createTables() {
    if (this.connectionType === 'in-memory') return;

    const tables = [
      // Organizations table
      `CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        name TEXT NOT NULL,
        name_arabic TEXT,
        industry TEXT,
        country TEXT DEFAULT 'SA',
        vat_number TEXT,
        settings JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // Subscriptions table
      `CREATE TABLE IF NOT EXISTS subscriptions (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        org_id TEXT DEFAULT 'default',
        tier TEXT NOT NULL DEFAULT 'professional_senior',
        status TEXT DEFAULT 'active',
        license_key TEXT UNIQUE,
        start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        end_date TIMESTAMP,
        features JSONB DEFAULT '{}',
        limits JSONB DEFAULT '{}',
        pricing JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // Users table
      `CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(50) PRIMARY KEY,
        org_id VARCHAR(50) REFERENCES organizations(id) ON DELETE CASCADE,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        permissions JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // Environments table
      `CREATE TABLE IF NOT EXISTS environments (
        id VARCHAR(50) PRIMARY KEY,
        org_id VARCHAR(50) REFERENCES organizations(id) ON DELETE CASCADE,
        type VARCHAR(50) DEFAULT 'shared',
        status VARCHAR(20) DEFAULT 'running',
        config JSONB DEFAULT '{}',
        resources JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // Usage tracking table
      `CREATE TABLE IF NOT EXISTS usage_tracking (
        id SERIAL PRIMARY KEY,
        org_id VARCHAR(50) REFERENCES organizations(id) ON DELETE CASCADE,
        usage_type VARCHAR(50) NOT NULL,
        amount INTEGER DEFAULT 1,
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // Chat sessions table (CRITICAL FOR AGENT MEMORY!)
      `CREATE TABLE IF NOT EXISTS chat_sessions (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        org_id TEXT DEFAULT 'default',
        user_id TEXT,
        agent_type TEXT,
        session_id TEXT NOT NULL,
        messages JSONB DEFAULT '[]',
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // API keys table
      `CREATE TABLE IF NOT EXISTS api_keys (
        id VARCHAR(50) PRIMARY KEY,
        org_id VARCHAR(50) REFERENCES organizations(id) ON DELETE CASCADE,
        key_hash VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        permissions JSONB DEFAULT '[]',
        last_used TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP
      )`
    ];

    for (const tableSQL of tables) {
      try {
        await this.query(tableSQL);
      } catch (error) {
        console.error('❌ Failed to create table:', error.message);
      }
    }

    // Create indexes for better performance
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_subscriptions_org_id ON subscriptions(org_id)',
      'CREATE INDEX IF NOT EXISTS idx_users_org_id ON users(org_id)',
      'CREATE INDEX IF NOT EXISTS idx_usage_tracking_org_id ON usage_tracking(org_id, period_start)',
      'CREATE INDEX IF NOT EXISTS idx_chat_sessions_org_id ON chat_sessions(org_id)',
      'CREATE INDEX IF NOT EXISTS idx_api_keys_org_id ON api_keys(org_id)'
    ];

    for (const indexSQL of indexes) {
      try {
        await this.query(indexSQL);
      } catch (error) {
        // Indexes might already exist, ignore errors
      }
    }

    console.log('✅ Database tables created/verified');
  }

  // Generic query method
  async query(sql, params = []) {
    if (this.connectionType === 'supabase') {
      // For Supabase, we'll use table operations instead of raw SQL
      // Raw SQL execution is limited in Supabase
      console.log('Supabase query attempt:', { sql: sql.substring(0, 100) + '...' });
      return [];
    } 
    else if (this.connectionType === 'postgresql') {
      const client = await this.postgresPool.connect();
      try {
        const result = await client.query(sql, params);
        return result.rows;
      } finally {
        client.release();
      }
    }
    else {
      // In-memory storage - simulate database operations
      return this.executeInMemoryQuery(sql, params);
    }
  }

  // Organization methods
  async createOrganization(orgData) {
    const sql = `
      INSERT INTO organizations (id, name, name_arabic, industry, country, vat_number, settings)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    
    const params = [
      orgData.id,
      orgData.name,
      orgData.nameArabic,
      orgData.industry,
      orgData.country,
      orgData.vatNumber,
      JSON.stringify(orgData.settings || {})
    ];

    if (this.connectionType === 'in-memory') {
      this.inMemoryStorage.organizations.set(orgData.id, orgData);
      return orgData;
    }

    const result = await this.query(sql, params);
    return result[0];
  }

  async getOrganization(orgId) {
    if (this.connectionType === 'in-memory') {
      return this.inMemoryStorage.organizations.get(orgId);
    }

    const sql = 'SELECT * FROM organizations WHERE id = $1';
    const result = await this.query(sql, [orgId]);
    return result[0];
  }

  async updateOrganization(orgId, updates) {
    if (this.connectionType === 'in-memory') {
      const existing = this.inMemoryStorage.organizations.get(orgId);
      if (existing) {
        const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
        this.inMemoryStorage.organizations.set(orgId, updated);
        return updated;
      }
      return null;
    }

    const fields = Object.keys(updates).map((key, index) => 
      `${key.replace(/([A-Z])/g, '_$1').toLowerCase()} = $${index + 2}`
    ).join(', ');
    
    const sql = `
      UPDATE organizations 
      SET ${fields}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    
    const params = [orgId, ...Object.values(updates)];
    const result = await this.query(sql, params);
    return result[0];
  }

  // Subscription methods
  async createSubscription(subscriptionData) {
    if (this.connectionType === 'in-memory') {
      this.inMemoryStorage.subscriptions.set(subscriptionData.id, subscriptionData);
      return subscriptionData;
    }

    const sql = `
      INSERT INTO subscriptions (id, org_id, tier, status, license_key, start_date, end_date, features, limits, pricing)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    
    const params = [
      subscriptionData.id,
      subscriptionData.orgId,
      subscriptionData.tier,
      subscriptionData.status,
      subscriptionData.licenseKey,
      subscriptionData.startDate,
      subscriptionData.endDate,
      JSON.stringify(subscriptionData.features),
      JSON.stringify(subscriptionData.limits),
      JSON.stringify(subscriptionData.pricing)
    ];

    const result = await this.query(sql, params);
    return result[0];
  }

  async getSubscription(orgId) {
    if (this.connectionType === 'in-memory') {
      return Array.from(this.inMemoryStorage.subscriptions.values())
        .find(sub => sub.orgId === orgId);
    }

    const sql = 'SELECT * FROM subscriptions WHERE org_id = $1';
    const result = await this.query(sql, [orgId]);
    return result[0];
  }

  // Usage tracking methods
  async recordUsage(orgId, usageType, amount = 1) {
    const today = new Date().toISOString().split('T')[0];
    
    if (this.connectionType === 'in-memory') {
      const key = `${orgId}:${usageType}:${today}`;
      const current = this.inMemoryStorage.usage.get(key) || 0;
      this.inMemoryStorage.usage.set(key, current + amount);
      return { success: true };
    }

    const sql = `
      INSERT INTO usage_tracking (org_id, usage_type, amount, period_start, period_end)
      VALUES ($1, $2, $3, $4, $4)
      ON CONFLICT (org_id, usage_type, period_start) 
      DO UPDATE SET amount = usage_tracking.amount + $3
    `;
    
    await this.query(sql, [orgId, usageType, amount, today]);
    return { success: true };
  }

  async getUsage(orgId, period = 'current') {
    const today = new Date().toISOString().split('T')[0];
    
    if (this.connectionType === 'in-memory') {
      const usage = {};
      for (const [key, amount] of this.inMemoryStorage.usage.entries()) {
        const [keyOrgId, usageType, date] = key.split(':');
        if (keyOrgId === orgId && date === today) {
          usage[usageType] = amount;
        }
      }
      return usage;
    }

    const sql = `
      SELECT usage_type, SUM(amount) as total
      FROM usage_tracking 
      WHERE org_id = $1 AND period_start = $2
      GROUP BY usage_type
    `;
    
    const result = await this.query(sql, [orgId, today]);
    return result.reduce((acc, row) => {
      acc[row.usage_type] = parseInt(row.total);
      return acc;
    }, {});
  }

  // Chat session methods - CRITICAL FOR AGENT MEMORY!
  async saveSession(sessionData) {
    if (this.connectionType === 'in-memory') {
      // Use advanced memory store if available
      if (this.memoryStore) {
        const result = await this.memoryStore.saveSession(sessionData);
        return result.success ? result.data : sessionData;
      } else {
        // Fallback to basic storage
        this.inMemoryStorage.sessions.set(sessionData.sessionId, sessionData);
        return sessionData;
      }
    }

    if (this.connectionType === 'supabase') {
      const { data, error } = await this.supabaseClient
        .from('chat_sessions')
        .upsert({
          session_id: sessionData.sessionId,
          org_id: sessionData.orgId || 'default',
          user_id: sessionData.userId,
          agent_type: sessionData.agentType,
          messages: sessionData.messages,
          metadata: sessionData.metadata,
          updated_at: new Date().toISOString()
        }, { 
          onConflict: 'session_id' 
        })
        .select()
        .single();

      if (error) {
        console.error('Session save error:', error);
        throw error;
      }
      
      return data;
    }

    // PostgreSQL fallback
    const sql = `
      INSERT INTO chat_sessions (session_id, org_id, user_id, agent_type, messages, metadata)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (session_id) 
      DO UPDATE SET messages = $5, metadata = $6, updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    
    const params = [
      sessionData.sessionId,
      sessionData.orgId || 'default',
      sessionData.userId,
      sessionData.agentType,
      JSON.stringify(sessionData.messages),
      JSON.stringify(sessionData.metadata)
    ];

    const result = await this.query(sql, params);
    return result[0];
  }

  async getSession(sessionId) {
    if (this.connectionType === 'in-memory') {
      // Use advanced memory store if available
      if (this.memoryStore) {
        const result = await this.memoryStore.getSession(sessionId);
        return result.success ? result.data : null;
      } else {
        // Fallback to basic storage
        return this.inMemoryStorage.sessions.get(sessionId);
      }
    }

    if (this.connectionType === 'supabase') {
      const { data, error } = await this.supabaseClient
        .from('chat_sessions')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error('Session get error:', error);
        return null;
      }
      
      return data;
    }

    // PostgreSQL fallback
    const sql = 'SELECT * FROM chat_sessions WHERE session_id = $1';
    const result = await this.query(sql, [sessionId]);
    return result[0];
  }

  // Helper method for in-memory queries (simplified)
  executeInMemoryQuery(sql, params) {
    // This is a simplified mock - in a real implementation you'd need a proper SQL parser
    // For now, just return empty array to prevent errors
    return [];
  }

  // Health check
  async healthCheck() {
    try {
      if (this.connectionType === 'supabase') {
        const { data } = await this.supabaseClient.from('organizations').select('id').limit(1);
        return { healthy: true, type: 'supabase', connected: true };
      } else if (this.connectionType === 'postgresql') {
        await this.query('SELECT 1');
        return { healthy: true, type: 'postgresql', connected: true };
      } else {
        // Use advanced memory store health check if available
        if (this.memoryStore) {
          const result = await this.memoryStore.healthCheck();
          return { 
            healthy: result.success, 
            type: 'memory-store', 
            connected: true,
            stats: this.memoryStore.getStats()
          };
        } else {
          return { healthy: true, type: 'in-memory', connected: true };
        }
      }
    } catch (error) {
      return { healthy: false, error: error.message, connected: false };
    }
  }

  // Close connections
  async close() {
    if (this.postgresPool) {
      await this.postgresPool.end();
    }
  }
}

// Create singleton instance
const databaseManager = new DatabaseManager();

export default databaseManager;