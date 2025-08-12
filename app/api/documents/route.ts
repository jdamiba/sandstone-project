import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCurrentUser } from "@/lib/auth";
import { pool } from "@/lib/database";
import { CreateDocumentRequest } from "@/types/database";

// GET /api/documents - List user's documents
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
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = parseInt(searchParams.get("offset") || "0");
    const search = searchParams.get("search") || "";

    let query = `
      SELECT 
        d.*,
        u.first_name || ' ' || u.last_name as owner_name,
        COUNT(dc.user_id) as collaborator_count,
        d.updated_at as last_modified
      FROM documents d
      LEFT JOIN users u ON d.owner_id = u.id
      LEFT JOIN document_collaborators dc ON d.id = dc.document_id AND dc.is_active = TRUE
      WHERE (
        d.owner_id = $1 OR 
        d.is_public = TRUE OR
        EXISTS (
          SELECT 1 FROM document_collaborators 
          WHERE document_id = d.id AND user_id = $1 AND is_active = TRUE
        )
      )
    `;

    const queryParams: (string | number)[] = [user.id];
    let paramCount = 1;

    if (search) {
      paramCount++;
      query += ` AND (d.title ILIKE $${paramCount} OR d.description ILIKE $${paramCount})`;
      queryParams.push(`%${search}%`);
    }

    query += `
      GROUP BY d.id, u.first_name, u.last_name
      ORDER BY d.updated_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    queryParams.push(limit, offset);

    const result = await pool.query(query, queryParams);

    return NextResponse.json({
      documents: result.rows,
      total: result.rows.length,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching documents:", error);
    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 }
    );
  }
}

// POST /api/documents - Create a new document
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body: CreateDocumentRequest = await req.json();

    // Validate required fields
    if (!body.title || body.title.trim().length === 0) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    // Create document
    const query = `
      INSERT INTO documents (
        title, 
        content, 
        description, 
        tags, 
        is_public, 
        allow_comments, 
        allow_suggestions, 
        require_approval,
        owner_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [
      body.title.trim(),
      body.content || "",
      body.description || null,
      body.tags || [],
      body.is_public || false,
      body.allow_comments !== false, // Default to true
      body.allow_suggestions !== false, // Default to true
      body.require_approval || false,
      user.id,
    ];

    const result = await pool.query(query, values);
    const newDocument = result.rows[0];

    // Add owner as collaborator with 'owner' permission
    const collaboratorQuery = `
      INSERT INTO document_collaborators (
        document_id, 
        user_id, 
        permission_level, 
        invited_at, 
        accepted_at
      ) VALUES ($1, $2, $3, NOW(), NOW())
    `;

    await pool.query(collaboratorQuery, [newDocument.id, user.id, "owner"]);

    // Track analytics
    const analyticsQuery = `
      INSERT INTO document_analytics (
        document_id, 
        user_id, 
        action_type, 
        metadata
      ) VALUES ($1, $2, $3, $4)
    `;

    await pool.query(analyticsQuery, [
      newDocument.id,
      user.id,
      "edit",
      { action: "document_created" },
    ]);

    return NextResponse.json(
      {
        document: newDocument,
        message: "Document created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating document:", error);
    return NextResponse.json(
      { error: "Failed to create document" },
      { status: 500 }
    );
  }
}
