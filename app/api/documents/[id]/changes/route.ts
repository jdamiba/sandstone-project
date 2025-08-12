import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCurrentUser } from "@/lib/auth";
import { pool } from "@/lib/database";

interface ChangeRequest {
  textToReplace: string;
  newText: string;
}

interface DocumentRouteProps {
  params: Promise<{
    id: string;
  }>;
}

// POST /api/documents/[id]/changes - Apply text changes to document
export async function POST(req: NextRequest, { params }: DocumentRouteProps) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id } = await params;
    const body: ChangeRequest = await req.json();

    // Validate request body
    if (
      body.textToReplace === undefined ||
      body.textToReplace === null ||
      body.newText === undefined ||
      body.newText === null
    ) {
      return NextResponse.json(
        { error: "textToReplace and newText are required" },
        { status: 400 }
      );
    }

    // Check if user has access to this document
    const accessQuery = `
      SELECT d.*, u.first_name || ' ' || u.last_name as owner_name
      FROM documents d
      LEFT JOIN users u ON d.owner_id = u.id
      WHERE d.id = $1 AND (
        d.owner_id = $2 OR 
        d.is_public = TRUE OR
        EXISTS (
          SELECT 1 FROM document_collaborators 
          WHERE document_id = d.id AND user_id = $2 AND is_active = TRUE
        )
      )
    `;

    const accessResult = await pool.query(accessQuery, [id, user.id]);

    if (accessResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    const document = accessResult.rows[0];

    // Check if user has edit permission
    const permissionQuery = `
      SELECT permission_level 
      FROM document_collaborators 
      WHERE document_id = $1 AND user_id = $2 AND is_active = TRUE
    `;

    const permissionResult = await pool.query(permissionQuery, [id, user.id]);

    // If user is not the owner and has no collaborator permissions, check if document is public
    // Public documents can be edited by any logged-in user
    if (
      document.owner_id !== user.id &&
      permissionResult.rows.length === 0 &&
      !document.is_public
    ) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // If user is a collaborator, check if they have edit permissions
    if (permissionResult.rows.length > 0) {
      const permission = permissionResult.rows[0].permission_level;
      if (!["owner", "editor"].includes(permission)) {
        return NextResponse.json(
          { error: "Insufficient permissions" },
          { status: 403 }
        );
      }
    }

    // Apply the text replacement
    const currentContent = document.content;
    const updatedContent = currentContent.replace(
      body.textToReplace,
      body.newText
    );

    // Check if the replacement actually changed anything
    if (currentContent === updatedContent) {
      return NextResponse.json(
        {
          error: "Text to replace not found in document",
          documentText: currentContent,
        },
        { status: 400 }
      );
    }

    // Update the document with new content
    const updateQuery = `
      UPDATE documents 
      SET content = $1, updated_at = NOW(), last_edited_at = NOW(), content_version = content_version + 1
      WHERE id = $2
      RETURNING *
    `;

    const updateResult = await pool.query(updateQuery, [updatedContent, id]);

    if (updateResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Failed to update document" },
        { status: 500 }
      );
    }

    // Track the change operation
    const operationQuery = `
      INSERT INTO document_operations (
        document_id,
        operation_type,
        position,
        length,
        content,
        user_id,
        timestamp,
        sequence_number
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), (
        SELECT COALESCE(MAX(sequence_number), 0) + 1 
        FROM document_operations 
        WHERE document_id = $1
      ))
    `;

    // Find the position of the replaced text
    const position = currentContent.indexOf(body.textToReplace);
    const length = body.textToReplace.length;

    await pool.query(operationQuery, [
      id,
      "replace",
      position,
      length,
      body.newText,
      user.id,
    ]);

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
      {
        action: "text_replacement",
        replacedLength: body.textToReplace.length,
        newLength: body.newText.length,
        position: position,
      },
    ]);

    // Return the updated document text as specified in requirements
    return NextResponse.json({
      documentText: updatedContent,
      message: "Document updated successfully",
      changes: {
        textReplaced: body.textToReplace,
        newText: body.newText,
        position: position,
        documentVersion: updateResult.rows[0].content_version,
      },
    });
  } catch (error) {
    console.error("Error applying document changes:", error);
    return NextResponse.json(
      { error: "Failed to apply changes" },
      { status: 500 }
    );
  }
}
