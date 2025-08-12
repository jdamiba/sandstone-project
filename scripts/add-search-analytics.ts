import { pool } from "../lib/database";
import fs from "fs";
import path from "path";

async function addSearchAnalytics() {
  try {
    console.log("🔌 Connecting to Neon PostgreSQL...");

    // Test connection
    await pool.query("SELECT NOW()");
    console.log("✅ Database connection successful");

    // Read and execute the SQL file
    const sqlPath = path.join(__dirname, "add-search-analytics.sql");
    const sqlContent = fs.readFileSync(sqlPath, "utf-8");

    console.log("📄 Adding search_analytics table...");
    await pool.query(sqlContent);

    console.log("✅ Search analytics table added successfully");
  } catch (error) {
    console.error("❌ Failed to add search analytics table:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

addSearchAnalytics();
