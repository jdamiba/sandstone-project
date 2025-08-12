import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCurrentUser } from "@/lib/auth";
import { pool } from "@/lib/database";

// GET /api/search - Search documents with full-text search
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q")?.trim();
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    if (!query || query.length === 0) {
      return NextResponse.json({
        documents: [],
        total: 0,
        query: "",
        message: "No search query provided",
      });
    }

    // Full-text search query using PostgreSQL tsvector
    const searchQuery = `
      SELECT 
        d.*,
        u.first_name || ' ' || u.last_name as owner_name,
        ts_rank(d.search_vector, plainto_tsquery('english', $1)) as rank,
        ts_headline('english', d.content, plainto_tsquery('english', $1), 'MaxWords=50, MinWords=10') as snippet
      FROM documents d
      LEFT JOIN users u ON d.owner_id = u.id
      WHERE 
        d.is_archived = FALSE
        AND (
          d.owner_id = $2 
          OR d.is_public = TRUE
          OR EXISTS (
            SELECT 1 FROM document_collaborators 
            WHERE document_id = d.id AND user_id = $2 AND is_active = TRUE
          )
        )
        AND (
          d.search_vector @@ plainto_tsquery('english', $1)
          OR d.title ILIKE $3
          OR d.description ILIKE $3
          OR EXISTS (
            SELECT 1 FROM unnest(d.tags) tag 
            WHERE tag ILIKE $3
          )
        )
      ORDER BY 
        CASE 
          WHEN d.title ILIKE $3 THEN 1
          WHEN d.description ILIKE $3 THEN 2
          ELSE 3
        END,
        rank DESC,
        d.updated_at DESC
      LIMIT $4 OFFSET $5
    `;

    // Count total results
    const countQuery = `
      SELECT COUNT(*) as total
      FROM documents d
      WHERE 
        d.is_archived = FALSE
        AND (
          d.owner_id = $1 
          OR d.is_public = TRUE
          OR EXISTS (
            SELECT 1 FROM document_collaborators 
            WHERE document_id = d.id AND user_id = $1 AND is_active = TRUE
          )
        )
        AND (
          d.search_vector @@ plainto_tsquery('english', $2)
          OR d.title ILIKE $3
          OR d.description ILIKE $3
          OR EXISTS (
            SELECT 1 FROM unnest(d.tags) tag 
            WHERE tag ILIKE $3
          )
        )
    `;

    const searchPattern = `%${query}%`;

    // Execute search query
    const searchResult = await pool.query(searchQuery, [
      query,
      user.id,
      searchPattern,
      limit,
      offset,
    ]);

    // Execute count query
    const countResult = await pool.query(countQuery, [
      user.id,
      query,
      searchPattern,
    ]);

    const total = parseInt(countResult.rows[0].total);

    // Track search analytics
    const analyticsQuery = `
      INSERT INTO search_analytics (
        user_id,
        search_query,
        results_count,
        search_timestamp
      ) VALUES ($1, $2, $3, NOW())
    `;

    await pool.query(analyticsQuery, [user.id, query, total]);

    return NextResponse.json({
      documents: searchResult.rows,
      total,
      query,
      limit,
      offset,
      message: `Found ${total} document${total === 1 ? "" : "s"}`,
    });
  } catch (error) {
    console.error("Error searching documents:", error);
    return NextResponse.json(
      { error: "Failed to search documents" },
      { status: 500 }
    );
  }
}
