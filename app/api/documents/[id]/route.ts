import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCurrentUser } from "@/lib/auth";
import { pool } from "@/lib/database";
import { UpdateDocumentRequest } from "@/types/database";

interface DocumentRouteProps {
  params: Promise<{
    id: string;
  }>;
}

// GET /api/documents/[id] - Get a specific document
export async function GET(req: NextRequest, { params }: DocumentRouteProps) {
  const { id } = await params;
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if user has access to this document
    const accessQuery = `
      SELECT d.*, u.first_name || ' ' || u.last_name as owner_name
      FROM documents d
      LEFT JOIN users u ON d.owner_id = u.id
      WHERE d.id = $1 AND (
        d.owner_id = $2 OR 
        EXISTS (
          SELECT 1 FROM document_collaborators 
          WHERE document_id = d.id AND user_id = $2 AND is_active = TRUE
        )
      )
    `;

    const result = await pool.query(accessQuery, [id, user.id]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ document: result.rows[0] });
  } catch (error) {
    console.error("Error fetching document:", error);
    return NextResponse.json(
      { error: "Failed to fetch document" },
      { status: 500 }
    );
  }
}

// PUT /api/documents/[id] - Update a document
export async function PUT(req: NextRequest, { params }: DocumentRouteProps) {
  const { id } = await params;
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body: UpdateDocumentRequest = await req.json();

    // Check if user has edit permission (owner or collaborator with editor permissions)
    const permissionQuery = `
      SELECT 
        d.owner_id,
        d.is_public,
        dc.permission_level
      FROM documents d
      LEFT JOIN document_collaborators dc ON d.id = dc.document_id AND dc.user_id = $2 AND dc.is_active = TRUE
      WHERE d.id = $1
    `;

    const permissionResult = await pool.query(permissionQuery, [id, user.id]);

    if (permissionResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    const document = permissionResult.rows[0];

    // Check if user is owner
    if (document.owner_id === user.id) {
      // Owner has full permissions
    } else if (
      document.permission_level &&
      ["owner", "editor"].includes(document.permission_level)
    ) {
      // Collaborator with editor permissions
    } else if (document.is_public) {
      // Public documents can be edited by any logged-in user
    } else {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Build update query dynamically
    const updateFields: string[] = [];
    const values: (string | boolean | string[] | null)[] = [];
    let paramCount = 1;

    if (body.title !== undefined) {
      updateFields.push(`title = $${paramCount++}`);
      values.push(body.title.trim());
    }
    if (body.content !== undefined) {
      updateFields.push(`content = $${paramCount++}`);
      values.push(body.content);
    }
    if (body.description !== undefined) {
      updateFields.push(`description = $${paramCount++}`);
      values.push(body.description);
    }
    if (body.tags !== undefined) {
      updateFields.push(`tags = $${paramCount++}`);
      values.push(body.tags);
    }
    if (body.is_public !== undefined) {
      updateFields.push(`is_public = $${paramCount++}`);
      values.push(body.is_public);
    }
    if (body.allow_comments !== undefined) {
      updateFields.push(`allow_comments = $${paramCount++}`);
      values.push(body.allow_comments);
    }
    if (body.allow_suggestions !== undefined) {
      updateFields.push(`allow_suggestions = $${paramCount++}`);
      values.push(body.allow_suggestions);
    }
    if (body.require_approval !== undefined) {
      updateFields.push(`require_approval = $${paramCount++}`);
      values.push(body.require_approval);
    }

    if (updateFields.length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    values.push(id);

    const updateQuery = `
      UPDATE documents 
      SET ${updateFields.join(", ")}, updated_at = NOW(), last_edited_at = NOW()
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(updateQuery, values);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Document not found or access denied" },
        { status: 404 }
      );
    }

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
      id,
      user.id,
      "edit",
      { action: "document_updated", fields: Object.keys(body) },
    ]);

    return NextResponse.json({
      document: result.rows[0],
      message: "Document updated successfully",
    });
  } catch (error) {
    console.error("Error updating document:", error);
    return NextResponse.json(
      { error: "Failed to update document" },
      { status: 500 }
    );
  }
}

// DELETE /api/documents/[id] - Delete a document
export async function DELETE(req: NextRequest, { params }: DocumentRouteProps) {
  const { id } = await params;
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if user is the owner
    const ownershipQuery = `
      SELECT id FROM documents 
      WHERE id = $1 AND owner_id = $2
    `;

    const ownershipResult = await pool.query(ownershipQuery, [id, user.id]);

    if (ownershipResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Document not found or access denied" },
        { status: 404 }
      );
    }

    // Track analytics before deletion
    const analyticsQuery = `
      INSERT INTO document_analytics (
        document_id, 
        user_id, 
        action_type, 
        metadata
      ) VALUES ($1, $2, $3, $4)
    `;

    await pool.query(analyticsQuery, [
      id,
      user.id,
      "edit",
      { action: "document_deleted" },
    ]);

    // Hard delete the document
    const deleteQuery = `
      DELETE FROM documents 
      WHERE id = $1 AND owner_id = $2
      RETURNING id
    `;

    const result = await pool.query(deleteQuery, [id, user.id]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Failed to delete document" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Document deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting document:", error);
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 }
    );
  }
}
