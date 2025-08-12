import { NextRequest } from "next/server";
import { pool } from "@/lib/database";
import { withAuthAppRouter, createSuccessResponse } from "@/lib/api-middleware";
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
  handleDatabaseError,
  validateString,
  validateUUID,
  validateArray,
} from "@/lib/errors";

interface SingleChangeRequest {
  textToReplace: string;
  newText: string;
}

interface MultipleChangeRequest {
  changes: SingleChangeRequest[];
}

interface DocumentRouteProps {
  params: Promise<{
    id: string;
  }>;
}

// Single change request validator
function validateSingleChangeRequest(
  body: Record<string, unknown>
): SingleChangeRequest {
  validateString(body.textToReplace as string, "textToReplace", 0, 1000000);
  validateString(body.newText as string, "newText", 0, 1000000);

  return {
    textToReplace: body.textToReplace as string,
    newText: body.newText as string,
  };
}

// Multiple change request validator
function validateMultipleChangeRequest(
  body: Record<string, unknown>
): MultipleChangeRequest {
  validateArray(body.changes as unknown[], "changes", (change, index) => {
    if (typeof change !== "object" || change === null) {
      throw new BadRequestError(`changes[${index}] must be an object`);
    }
    const changeObj = change as Record<string, unknown>;
    validateString(
      changeObj.textToReplace as string,
      `changes[${index}].textToReplace`,
      0,
      1000000
    );
    validateString(
      changeObj.newText as string,
      `changes[${index}].newText`,
      0,
      1000000
    );
  });

  return {
    changes: body.changes as SingleChangeRequest[],
  };
}

// Detect if request is for single or multiple changes
function detectChangeRequestType(
  body: Record<string, unknown>
): "single" | "multiple" {
  if (body.changes && Array.isArray(body.changes)) {
    return "multiple";
  }
  if (body.textToReplace !== undefined && body.newText !== undefined) {
    return "single";
  }
  throw new BadRequestError(
    "Invalid request format. Expected either single change (textToReplace, newText) or multiple changes (changes array)"
  );
}

// Apply multiple changes to content
function applyMultipleChanges(
  content: string,
  changes: SingleChangeRequest[]
): {
  updatedContent: string;
  appliedChanges: Array<{
    textReplaced: string;
    newText: string;
    position: number;
    applied: boolean;
  }>;
} {
  let updatedContent = content;
  const appliedChanges: Array<{
    textReplaced: string;
    newText: string;
    position: number;
    applied: boolean;
  }> = [];

  // Sort changes by position (descending) to avoid position shifts
  const changesWithPositions = changes
    .map((change) => ({
      ...change,
      position: content.indexOf(change.textToReplace),
    }))
    .sort((a, b) => b.position - a.position);

  for (const change of changesWithPositions) {
    const position = updatedContent.indexOf(change.textToReplace);
    const applied = position !== -1;

    appliedChanges.push({
      textReplaced: change.textToReplace,
      newText: change.newText,
      position: position,
      applied: applied,
    });

    if (applied) {
      updatedContent = updatedContent.replace(
        change.textToReplace,
        change.newText
      );
    }
  }

  return { updatedContent, appliedChanges };
}

// POST /api/documents/[id]/changes - Apply text changes to document
export const POST = withAuthAppRouter(
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

    // Parse and validate request body
    const body = await req.json();
    const requestType = detectChangeRequestType(body);

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
      const accessResult = await pool.query(accessQuery, [
        id,
        authContext.user.id,
      ]);

      if (accessResult.rows.length === 0) {
        throw new NotFoundError("Document not found");
      }

      const document = accessResult.rows[0];

      // Check if user has edit permission
      const permissionQuery = `
        SELECT permission_level 
        FROM document_collaborators 
        WHERE document_id = $1 AND user_id = $2 AND is_active = TRUE
      `;

      const permissionResult = await pool.query(permissionQuery, [
        id,
        authContext.user.id,
      ]);

      // Check permissions
      const isOwner = document.owner_id === authContext.user.id;
      const isEditor =
        permissionResult.rows.length > 0 &&
        ["owner", "editor"].includes(permissionResult.rows[0].permission_level);
      const isPublic = document.is_public;

      if (!isOwner && !isEditor && !isPublic) {
        throw new ForbiddenError("Access denied");
      }

      // If user is a collaborator, check if they have edit permissions
      if (permissionResult.rows.length > 0) {
        const permission = permissionResult.rows[0].permission_level;
        if (!["owner", "editor"].includes(permission)) {
          throw new ForbiddenError("Insufficient permissions");
        }
      }

      const currentContent = document.content;
      let updatedContent: string;
      let appliedChanges: Array<{
        textReplaced: string;
        newText: string;
        position: number;
        applied: boolean;
      }> = [];

      if (requestType === "single") {
        // Handle single change (backward compatibility)
        const validatedBody = validateSingleChangeRequest(body);

        updatedContent = currentContent.replace(
          validatedBody.textToReplace,
          validatedBody.newText
        );

        // Check if the replacement actually changed anything
        if (currentContent === updatedContent) {
          throw new BadRequestError("Text to replace not found in document");
        }

        appliedChanges = [
          {
            textReplaced: validatedBody.textToReplace,
            newText: validatedBody.newText,
            position: currentContent.indexOf(validatedBody.textToReplace),
            applied: true,
          },
        ];
      } else {
        // Handle multiple changes
        const validatedBody = validateMultipleChangeRequest(body);

        if (validatedBody.changes.length === 0) {
          throw new BadRequestError("No changes provided");
        }

        const result = applyMultipleChanges(
          currentContent,
          validatedBody.changes
        );
        updatedContent = result.updatedContent;
        appliedChanges = result.appliedChanges;

        // Check if any changes were applied
        const appliedCount = appliedChanges.filter(
          (change) => change.applied
        ).length;
        if (appliedCount === 0) {
          throw new BadRequestError(
            "None of the specified text replacements were found in the document"
          );
        }
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
        throw new NotFoundError("Failed to update document");
      }

      // Track the change operations
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

      // Insert operations for each applied change
      for (const change of appliedChanges) {
        if (change.applied) {
          await pool.query(operationQuery, [
            id,
            "replace",
            change.position,
            change.textReplaced.length,
            change.newText,
            authContext.user.id,
          ]);
        }
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

      const appliedCount = appliedChanges.filter(
        (change) => change.applied
      ).length;
      const totalChanges = appliedChanges.length;

      await pool.query(analyticsQuery, [
        id,
        authContext.user.id,
        "edit",
        {
          action: "text_replacement",
          requestType: requestType,
          totalChanges: totalChanges,
          appliedChanges: appliedCount,
          changes: appliedChanges.map((change) => ({
            textReplaced: change.textReplaced,
            newText: change.newText,
            position: change.position,
            applied: change.applied,
          })),
        },
      ]);

      // Return the updated document text as specified in requirements
      return createSuccessResponse({
        documentText: updatedContent,
        message: `Document updated successfully. Applied ${appliedCount} of ${totalChanges} changes.`,
        changes: {
          requestType: requestType,
          totalChanges: totalChanges,
          appliedChanges: appliedCount,
          changes: appliedChanges.map((change) => ({
            textReplaced: change.textReplaced,
            newText: change.newText,
            position: change.position,
            applied: change.applied,
          })),
          documentVersion: updateResult.rows[0].content_version,
        },
      });
    } catch (error) {
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
