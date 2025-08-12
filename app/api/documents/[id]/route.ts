import { NextRequest } from "next/server";
import { pool } from "@/lib/database";
import { UpdateDocumentRequest } from "@/types/database";
import { withAuthAppRouter, createSuccessResponse } from "@/lib/api-middleware";
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
  handleDatabaseError,
  validateString,
  validateArray,
  validateBoolean,
  validateUUID,
} from "@/lib/errors";

interface DocumentRouteProps {
  params: Promise<{
    id: string;
  }>;
}

// Document update validator
function validateUpdateDocument(
  body: Record<string, unknown>
): UpdateDocumentRequest {
  const updateData: UpdateDocumentRequest = {};

  if (body.title !== undefined && body.title !== null) {
    validateString(body.title as string, "title", 1, 255);
    updateData.title = (body.title as string).trim();
  }

  if (body.content !== undefined && body.content !== null) {
    validateString(body.content as string, "content", 0, 1000000); // 1MB max
    updateData.content = body.content as string;
  }

  if (body.description !== undefined && body.description !== null) {
    validateString(body.description as string, "description", 0, 1000);
    updateData.description = body.description as string;
  }

  if (body.tags !== undefined && body.tags !== null) {
    validateArray(body.tags as unknown[], "tags", (tag, index) => {
      validateString(tag, `tags[${index}]`, 1, 50);
    });
    updateData.tags = body.tags as string[];
  }

  if (body.is_public !== undefined && body.is_public !== null) {
    validateBoolean(body.is_public as boolean, "is_public");
    updateData.is_public = body.is_public as boolean;
  }

  if (body.allow_comments !== undefined && body.allow_comments !== null) {
    validateBoolean(body.allow_comments as boolean, "allow_comments");
    updateData.allow_comments = body.allow_comments as boolean;
  }

  if (body.allow_suggestions !== undefined && body.allow_suggestions !== null) {
    validateBoolean(body.allow_suggestions as boolean, "allow_suggestions");
    updateData.allow_suggestions = body.allow_suggestions as boolean;
  }

  if (body.require_approval !== undefined && body.require_approval !== null) {
    validateBoolean(body.require_approval as boolean, "require_approval");
    updateData.require_approval = body.require_approval as boolean;
  }

  if (Object.keys(updateData).length === 0) {
    throw new BadRequestError("No valid fields to update");
  }

  return updateData;
}

// GET /api/documents/[id] - Get a specific document
export const GET = withAuthAppRouter(
  async (
    req: NextRequest,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    context: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    params: any
  ) => {
    // Type assertion for authenticated context
    const authContext = context as { user: { id: string }; userId: string };
    const { id } = await (params as unknown as DocumentRouteProps).params;

    // Validate document ID
    validateUUID(id, "documentId");

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

    try {
      const result = await pool.query(accessQuery, [id, authContext.user.id]);

      if (result.rows.length === 0) {
        throw new NotFoundError("Document not found");
      }

      return createSuccessResponse({ document: result.rows[0] });
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw handleDatabaseError(error);
    }
  }
);

// PUT /api/documents/[id] - Update a document
export const PUT = withAuthAppRouter(
  async (
    req: NextRequest,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    context: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    params: any
  ) => {
    console.log("PUT /api/documents/[id] - Starting request");

    // Type assertion for authenticated context
    const authContext = context as { user: { id: string }; userId: string };

    // Extract document ID from params or URL
    let id: string;
    if (params && (params as any).params) {
      const paramsData = await (params as unknown as DocumentRouteProps).params;
      id = paramsData.id;
    } else {
      // Fallback: extract from URL path
      const url = new URL(req.url);
      const pathParts = url.pathname.split("/");
      id = pathParts[pathParts.length - 1];
    }

    console.log("PUT /api/documents/[id] - Document ID:", id);
    console.log("PUT /api/documents/[id] - User ID:", authContext.user.id);

    // Validate document ID
    validateUUID(id, "documentId");

    // Parse and validate request body
    const body = await req.json();
    const validatedBody = validateUpdateDocument(body);

    // Check if user has edit permission
    const permissionQuery = `
    SELECT 
      d.owner_id,
      d.is_public,
      dc.permission_level
    FROM documents d
    LEFT JOIN document_collaborators dc ON d.id = dc.document_id AND dc.user_id = $2 AND dc.is_active = TRUE
    WHERE d.id = $1
  `;

    try {
      const permissionResult = await pool.query(permissionQuery, [
        id,
        authContext.user.id,
      ]);

      if (permissionResult.rows.length === 0) {
        throw new NotFoundError("Document not found");
      }

      const document = permissionResult.rows[0];

      // Check permissions
      const isOwner = document.owner_id === authContext.user.id;
      const isEditor =
        document.permission_level &&
        ["owner", "editor"].includes(document.permission_level);
      const isPublic = document.is_public;

      if (!isOwner && !isEditor && !isPublic) {
        throw new ForbiddenError("Access denied");
      }

      // Build update query dynamically
      const updateFields: string[] = [];
      const values: (string | boolean | string[] | null)[] = [];
      let paramCount = 1;

      if (validatedBody.title !== undefined) {
        updateFields.push(`title = $${paramCount++}`);
        values.push(validatedBody.title);
      }
      if (validatedBody.content !== undefined) {
        updateFields.push(`content = $${paramCount++}`);
        values.push(validatedBody.content);
      }
      if (validatedBody.description !== undefined) {
        updateFields.push(`description = $${paramCount++}`);
        values.push(validatedBody.description);
      }
      if (validatedBody.tags !== undefined) {
        updateFields.push(`tags = $${paramCount++}`);
        values.push(validatedBody.tags);
      }
      if (validatedBody.is_public !== undefined) {
        updateFields.push(`is_public = $${paramCount++}`);
        values.push(validatedBody.is_public);
      }
      if (validatedBody.allow_comments !== undefined) {
        updateFields.push(`allow_comments = $${paramCount++}`);
        values.push(validatedBody.allow_comments);
      }
      if (validatedBody.allow_suggestions !== undefined) {
        updateFields.push(`allow_suggestions = $${paramCount++}`);
        values.push(validatedBody.allow_suggestions);
      }
      if (validatedBody.require_approval !== undefined) {
        updateFields.push(`require_approval = $${paramCount++}`);
        values.push(validatedBody.require_approval);
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
        throw new NotFoundError("Document not found or access denied");
      }

      // Track analytics (completely optional - skip if any issues)
      try {
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
          authContext.user.id,
          "edit",
          { action: "document_updated", fields: Object.keys(validatedBody) },
        ]);
      } catch (analyticsError) {
        // Silently ignore analytics errors - don't fail the main operation
        console.warn("Analytics tracking failed (ignored):", analyticsError);
      }

      return createSuccessResponse({
        document: result.rows[0],
        message: "Document updated successfully",
      });
    } catch (error) {
      console.error("PUT /api/documents/[id] error:", error);

      if (
        error instanceof NotFoundError ||
        error instanceof ForbiddenError ||
        error instanceof BadRequestError
      ) {
        throw error;
      }
      throw handleDatabaseError(error);
    }
  }
);

// DELETE /api/documents/[id] - Delete a document
export const DELETE = withAuthAppRouter(
  async (
    req: NextRequest,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    context: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    params: any
  ) => {
    // Type assertion for authenticated context
    const authContext = context as { user: { id: string }; userId: string };
    const { id } = await (params as unknown as DocumentRouteProps).params;

    // Validate document ID
    validateUUID(id, "documentId");

    // Check if user is the owner
    const ownershipQuery = `
    SELECT id FROM documents 
    WHERE id = $1 AND owner_id = $2
  `;

    try {
      const ownershipResult = await pool.query(ownershipQuery, [
        id,
        authContext.user.id,
      ]);

      if (ownershipResult.rows.length === 0) {
        throw new NotFoundError("Document not found or access denied");
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
        authContext.user.id,
        "edit",
        { action: "document_deleted" },
      ]);

      // Hard delete the document
      const deleteQuery = `
      DELETE FROM documents 
      WHERE id = $1 AND owner_id = $2
      RETURNING id
    `;

      const result = await pool.query(deleteQuery, [id, authContext.user.id]);

      if (result.rows.length === 0) {
        throw new NotFoundError("Failed to delete document");
      }

      return createSuccessResponse({
        message: "Document deleted successfully",
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw handleDatabaseError(error);
    }
  }
);
