import { Pool } from "pg";
import { User } from "@/types/database";

// Database connection pool for Neon PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test database connection
export async function testConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query("SELECT NOW()");
    client.release();
    return true;
  } catch (error) {
    console.error("Database connection failed:", error);
    return false;
  }
}

// User management functions
export async function createUser(userData: {
  clerk_user_id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
}): Promise<User> {
  const client = await pool.connect();

  try {
    const query = `
      INSERT INTO users (clerk_user_id, email, first_name, last_name, avatar_url)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const values = [
      userData.clerk_user_id,
      userData.email,
      userData.first_name,
      userData.last_name,
      userData.avatar_url,
    ];

    const result = await client.query(query, values);
    return result.rows[0];
  } finally {
    client.release();
  }
}

export async function updateUser(
  clerkUserId: string,
  userData: {
    email?: string;
    first_name?: string;
    last_name?: string;
    avatar_url?: string;
  }
): Promise<User | null> {
  const client = await pool.connect();

  try {
    const updateFields: string[] = [];
    const values: (string | null)[] = [];
    let paramCount = 1;

    // Build dynamic update query
    if (userData.email !== undefined) {
      updateFields.push(`email = $${paramCount++}`);
      values.push(userData.email);
    }
    if (userData.first_name !== undefined) {
      updateFields.push(`first_name = $${paramCount++}`);
      values.push(userData.first_name);
    }
    if (userData.last_name !== undefined) {
      updateFields.push(`last_name = $${paramCount++}`);
      values.push(userData.last_name);
    }
    if (userData.avatar_url !== undefined) {
      updateFields.push(`avatar_url = $${paramCount++}`);
      values.push(userData.avatar_url);
    }

    if (updateFields.length === 0) {
      return null;
    }

    values.push(clerkUserId);

    const query = `
      UPDATE users 
      SET ${updateFields.join(", ")}, updated_at = NOW()
      WHERE clerk_user_id = $${paramCount}
      RETURNING *
    `;

    const result = await client.query(query, values);
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

export async function deleteUser(clerkUserId: string): Promise<boolean> {
  const client = await pool.connect();

  try {
    const query = `
      UPDATE users 
      SET is_active = FALSE, updated_at = NOW()
      WHERE clerk_user_id = $1
    `;

    const result = await client.query(query, [clerkUserId]);
    return (result.rowCount || 0) > 0;
  } finally {
    client.release();
  }
}

export async function getUserByClerkId(
  clerkUserId: string
): Promise<User | null> {
  const client = await pool.connect();

  try {
    const query = `
      SELECT * FROM users 
      WHERE clerk_user_id = $1 AND is_active = TRUE
    `;

    const result = await client.query(query, [clerkUserId]);
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

export async function getUserById(userId: string): Promise<User | null> {
  const client = await pool.connect();

  try {
    const query = `
      SELECT * FROM users 
      WHERE id = $1 AND is_active = TRUE
    `;

    const result = await client.query(query, [userId]);
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

// Update user's last active timestamp
export async function updateUserActivity(clerkUserId: string): Promise<void> {
  const client = await pool.connect();

  try {
    const query = `
      UPDATE users 
      SET last_active_at = NOW()
      WHERE clerk_user_id = $1
    `;

    await client.query(query, [clerkUserId]);
  } finally {
    client.release();
  }
}

// Close database pool on app shutdown
export async function closePool(): Promise<void> {
  await pool.end();
}

// Export pool for direct access if needed
export { pool };
