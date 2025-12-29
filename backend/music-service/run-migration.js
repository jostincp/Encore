#!/usr/bin/env node
/**
 * Database Migration Runner
 * Executes SQL migrations in order
 * Usage: node run-migration.js [migration-file]
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database configuration from environment
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'encore',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function runMigration(migrationFile) {
  const client = await pool.connect();
  
  try {
    console.log(`\n🔄 Running migration: ${migrationFile}`);
    console.log('='.repeat(60));
    
    // Read migration file
    const migrationPath = path.join(__dirname, 'migrations', migrationFile);
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    // Start transaction
    await client.query('BEGIN');
    
    // Execute migration
    const startTime = Date.now();
    await client.query(sql);
    const duration = Date.now() - startTime;
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log(`✅ Migration completed successfully in ${duration}ms`);
    console.log('='.repeat(60));
    
    // Verify indexes were created
    console.log('\n📊 Verifying indexes...');
    const indexCheck = await client.query(`
      SELECT 
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename IN ('songs', 'queue')
        AND schemaname = 'public'
      ORDER BY tablename, indexname
    `);
    
    console.log(`\nFound ${indexCheck.rows.length} indexes:`);
    indexCheck.rows.forEach(row => {
      console.log(`  ✓ ${row.tablename}.${row.indexname}`);
    });
    
    // Verify columns were added
    console.log('\n📋 Verifying columns...');
    const columnCheck = await client.query(`
      SELECT 
        table_name,
        column_name,
        data_type,
        is_generated
      FROM information_schema.columns
      WHERE table_name = 'songs'
        AND column_name IN ('search_vector', 'popularity_score')
      ORDER BY column_name
    `);
    
    console.log(`\nFound ${columnCheck.rows.length} new columns:`);
    columnCheck.rows.forEach(row => {
      const generated = row.is_generated === 'ALWAYS' ? ' (GENERATED)' : '';
      console.log(`  ✓ ${row.table_name}.${row.column_name} (${row.data_type})${generated}`);
    });
    
    console.log('\n✅ Migration verification complete!');
    console.log('\n💡 Next steps:');
    console.log('   1. Test search performance with: npm run test:search');
    console.log('   2. Run test queries from: migrations/test_queries.sql');
    console.log('   3. Monitor query performance in production\n');
    
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    console.error('\n❌ Migration failed:', error.message);
    console.error('\n🔄 Transaction rolled back');
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  const migrationFile = process.argv[2] || '001_add_search_indexes.sql';
  
  console.log('\n🗄️  Encore Database Migration Runner');
  console.log('Database:', process.env.DB_NAME || 'encore');
  console.log('Host:', process.env.DB_HOST || 'localhost');
  
  try {
    await runMigration(migrationFile);
    process.exit(0);
  } catch (error) {
    console.error('\n💥 Migration runner failed');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { runMigration };
