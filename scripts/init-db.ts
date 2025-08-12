#!/usr/bin/env tsx

import { Pool } from "pg";
import { readFileSync } from "fs";
import { join } from "path";

async function initializeDatabase() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl:
      process.env.NODE_ENV === "production"
        ? {
            rejectUnauthorized: false,
          }
        : false,
  });

  try {
    console.log("🔌 Connecting to Neon PostgreSQL...");

    // Test connection
    const client = await pool.connect();
    await client.query("SELECT NOW()");
    console.log("✅ Database connection successful");

    // Read and execute schema
    const schemaPath = join(process.cwd(), "database-schema.sql");
    const schema = readFileSync(schemaPath, "utf8");

    console.log("📄 Executing database schema...");
    await client.query(schema);
    console.log("✅ Database schema created successfully");

    // Test basic queries
    console.log("🧪 Testing database operations...");

    // Test users table
    const userTableTest = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);

    if (userTableTest.rows[0].exists) {
      console.log("✅ Users table exists");
    } else {
      console.log("❌ Users table not found");
    }

    // Test documents table
    const docsTableTest = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'documents'
      );
    `);

    if (docsTableTest.rows[0].exists) {
      console.log("✅ Documents table exists");
    } else {
      console.log("❌ Documents table not found");
    }

    client.release();
    console.log("🎉 Database initialization completed successfully!");
  } catch (error) {
    console.error("❌ Database initialization failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  initializeDatabase();
}

export { initializeDatabase };
