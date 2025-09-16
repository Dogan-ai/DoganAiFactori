import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Try direct connection parameters
const client = new Client({
  host: 'aws-1-us-east-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.msfhsfpvhbzvpzalwxoz',
  password: 'aKpFI9eQCxAUn0eN',
  ssl: {
    rejectUnauthorized: false
  }
});

async function testDatabase() {
  try {
    console.log('🔗 Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully!');

    // Test basic query
    const result = await client.query('SELECT NOW() as time, version() as version');
    console.log('📅 Database time:', result.rows[0].time);
    console.log('🗄️  Database version:', result.rows[0].version.split(' ')[0]);

    // Create tables
    console.log('🏗️  Creating tables...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_email VARCHAR(255),
        message TEXT NOT NULL,
        response TEXT,
        agent_type VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log('✅ Tables created!');

    // Test insert
    await client.query(`
      INSERT INTO users (email, name) 
      VALUES ('test@doganai.com', 'Test User') 
      ON CONFLICT (email) DO NOTHING
    `);

    // Check tables
    const tables = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' ORDER BY table_name
    `);
    
    console.log('📊 Available tables:');
    tables.rows.forEach(row => console.log(`   ✅ ${row.table_name}`));

    const userCount = await client.query('SELECT COUNT(*) FROM users');
    console.log(`👥 Users in database: ${userCount.rows[0].count}`);

    console.log('\n🎉 Database setup complete!');

  } catch (error) {
    console.error('❌ Database error:', error.message);
  } finally {
    await client.end();
  }
}

testDatabase();