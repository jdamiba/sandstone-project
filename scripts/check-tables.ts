#!/usr/bin/env tsx

import { Pool } from "pg";

async function checkTables() {
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
    console.log("🔍 Checking database tables...");

    const client = await pool.connect();

    // List all tables
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    console.log("📋 Tables found:", tablesResult.rows.length);

    if (tablesResult.rows.length === 0) {
      console.log("❌ No tables found in the database");
    } else {
      console.log("✅ Tables:");
      tablesResult.rows.forEach((row, index) => {
        console.log(`  ${index + 1}. ${row.table_name}`);
      });
    }

    // Check if users table exists specifically
    const usersTableResult = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);

    if (usersTableResult.rows[0].exists) {
      console.log("✅ Users table exists");

      // Check table structure
      const columnsResult = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        ORDER BY ordinal_position;
      `);

      console.log("📊 Users table columns:");
      columnsResult.rows.forEach((row) => {
        console.log(
          `  - ${row.column_name}: ${row.data_type} (${
            row.is_nullable === "YES" ? "nullable" : "not null"
          })`
        );
      });
    } else {
      console.log("❌ Users table does not exist");
    }

    client.release();
  } catch (error) {
    console.error("❌ Error checking tables:", error);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  checkTables();
}

export { checkTables };
