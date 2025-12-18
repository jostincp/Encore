import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

const pool = new Pool({
  connectionString: 'postgresql://postgres:password@localhost:5433/encore_db',
});

async function runMigration() {
  console.log('🚀 Starting Database Migration...');
  
  try {
    // Assume running from backend/menu-service
    const sqlPath = path.resolve(process.cwd(), '../../backend/shared/database/migrations/001_initial_schema.sql');


    console.log(`   📂 Reading migration file: ${sqlPath}`);
    
    if (!fs.existsSync(sqlPath)) {
      throw new Error('Migration file not found');
    }
    
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('   🔌 Connecting to database...');
    const client = await pool.connect();
    
    try {
      console.log('   ⚙️ Executing SQL...');
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('COMMIT');
      console.log('   ✅ Migration applied successfully');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    
  } catch (error: any) {
    console.error('   ❌ Migration Failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
