#!/usr/bin/env tsx

import { Pool } from "pg";

async function testPublicDocuments() {
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
    console.log("🔌 Testing public documents functionality...");

    const client = await pool.connect();

    // First, let's see if there are any users
    const users = await client.query("SELECT id, email FROM users LIMIT 1");

    if (users.rows.length === 0) {
      console.log("❌ No users found. Please create a user first.");
      return;
    }

    const userId = users.rows[0].id;
    console.log(`✅ Using user: ${users.rows[0].email}`);

    // Create a public document
    const publicDoc = await client.query(
      `
      INSERT INTO documents (
        title, 
        content, 
        description, 
        owner_id, 
        is_public, 
        tags
      ) VALUES (
        'Public Legal Document',
        'This is a sample public legal document that should be visible to all users.',
        'A sample public document for testing',
        $1,
        true,
        ARRAY['legal', 'public', 'sample']
      ) RETURNING id, title, is_public
    `,
      [userId]
    );

    console.log(`✅ Created public document: ${publicDoc.rows[0].title}`);

    // Create a private document
    const privateDoc = await client.query(
      `
      INSERT INTO documents (
        title, 
        content, 
        description, 
        owner_id, 
        is_public, 
        tags
      ) VALUES (
        'Private Legal Document',
        'This is a sample private legal document that should only be visible to the owner.',
        'A sample private document for testing',
        $1,
        false,
        ARRAY['legal', 'private', 'sample']
      ) RETURNING id, title, is_public
    `,
      [userId]
    );

    console.log(`✅ Created private document: ${privateDoc.rows[0].title}`);

    // Test querying all documents (should include both public and private)
    const allDocs = await client.query(
      `
      SELECT id, title, is_public, owner_id 
      FROM documents 
      WHERE owner_id = $1 OR is_public = true
      ORDER BY created_at DESC
    `,
      [userId]
    );

    console.log(`\n📋 All accessible documents (${allDocs.rows.length}):`);
    allDocs.rows.forEach((doc) => {
      console.log(`  - ${doc.title} (${doc.is_public ? "Public" : "Private"})`);
    });

    // Test querying only public documents
    const publicDocs = await client.query(
      `
      SELECT id, title, is_public, owner_id 
      FROM documents 
      WHERE (owner_id = $1 OR is_public = true) AND is_public = true
      ORDER BY created_at DESC
    `,
      [userId]
    );

    console.log(`\n🌐 Public documents only (${publicDocs.rows.length}):`);
    publicDocs.rows.forEach((doc) => {
      console.log(`  - ${doc.title} (${doc.is_public ? "Public" : "Private"})`);
    });

    client.release();
    console.log("\n🎉 Public documents test completed!");
  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  testPublicDocuments();
}

export { testPublicDocuments };
