import { NextRequest } from "next/server";
import { pool } from "@/lib/database";
import { CreateDocumentRequest } from "@/types/database";
import {
  withAuthAppRouter,
  createSuccessResponse,
  createPaginatedResponse,
  validateQueryParams,
  queryValidators,
} from "@/lib/api-middleware";
import {
  handleDatabaseError,
  validateString,
  validateArray,
  validateBoolean,
} from "@/lib/errors";

// Document creation validator
function validateCreateDocument(
  body: Record<string, unknown>
): CreateDocumentRequest {
  validateString(body.title as string, "title", 1, 255);

  if (body.content !== undefined) {
    validateString(body.content as string, "content", 0, 1000000); // 1MB max
  }

  if (body.description !== undefined) {
    validateString(body.description as string, "description", 0, 1000);
  }

  if (body.tags !== undefined) {
    validateArray(body.tags as unknown[], "tags", (tag, index) => {
      validateString(tag as string, `tags[${index}]`, 1, 50);
    });
  }

  if (body.is_public !== undefined) {
    validateBoolean(body.is_public as boolean, "is_public");
  }

  if (body.allow_comments !== undefined) {
    validateBoolean(body.allow_comments as boolean, "allow_comments");
  }

  if (body.allow_suggestions !== undefined) {
    validateBoolean(body.allow_suggestions as boolean, "allow_suggestions");
  }

  if (body.require_approval !== undefined) {
    validateBoolean(body.require_approval as boolean, "require_approval");
  }

  return {
    title: (body.title as string).trim(),
    content: (body.content as string) || "",
    description: (body.description as string) || undefined,
    tags: (body.tags as string[]) || [],
    is_public: (body.is_public as boolean) || false,
    allow_comments: (body.allow_comments as boolean) !== false, // Default to true
    allow_suggestions: (body.allow_suggestions as boolean) !== false, // Default to true
    require_approval: (body.require_approval as boolean) || false,
  };
}

// GET /api/documents - List user's documents
export const GET = withAuthAppRouter(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (req: NextRequest, context: any) => {
    // Type assertion for authenticated context
    const authContext = context as { user: { id: string }; userId: string };
    const { searchParams } = new URL(req.url);

    // Validate query parameters
    const params = validateQueryParams(searchParams, [], {
      limit: queryValidators.integer(1, 100),
      offset: queryValidators.integer(0),
      search: queryValidators.string(1, 100),
      public: queryValidators.boolean(),
    });

    const limit = (params.limit as number) || 10;
    const offset = (params.offset as number) || 0;
    const search = (params.search as string) || "";
    const publicOnly = (params.public as boolean) || false;

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
      d.is_public = TRUE ${
        publicOnly
          ? ""
          : `OR EXISTS (
        SELECT 1 FROM document_collaborators 
        WHERE document_id = d.id AND user_id = $1 AND is_active = TRUE
      )`
      }
    )
  `;

    const queryParams: (string | number)[] = [authContext.user.id];
    let paramCount = 1;

    if (search) {
      paramCount++;
      query += ` AND (d.title ILIKE $${paramCount} OR d.description ILIKE $${paramCount})`;
      queryParams.push(`%${search}%`);
    }

    if (publicOnly) {
      query += ` AND d.is_public = TRUE`;
    }

    query += `
    GROUP BY d.id, u.first_name, u.last_name
    ORDER BY d.updated_at DESC
    LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
  `;

    queryParams.push(limit, offset);

    // Get total count for pagination
    const countQuery = `
    SELECT COUNT(DISTINCT d.id) as total
    FROM documents d
    WHERE (
      d.owner_id = $1 OR 
      d.is_public = TRUE ${
        publicOnly
          ? ""
          : `OR EXISTS (
        SELECT 1 FROM document_collaborators 
        WHERE document_id = d.id AND user_id = $1 AND is_active = TRUE
      )`
      }
    )
    ${search ? `AND (d.title ILIKE $2 OR d.description ILIKE $2)` : ""}
    ${publicOnly ? "AND d.is_public = TRUE" : ""}
  `;

    const countParams = [authContext.user.id];
    if (search) {
      countParams.push(`%${search}%`);
    }

    try {
      const [result, countResult] = await Promise.all([
        pool.query(query, queryParams),
        pool.query(countQuery, countParams),
      ]);

      const total = parseInt(countResult.rows[0].total);

      return createPaginatedResponse(result.rows, total, limit, offset, {
        search,
        publicOnly,
      });
    } catch (error) {
      throw handleDatabaseError(error);
    }
  }
);

// POST /api/documents - Create a new document
export const POST = withAuthAppRouter(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (req: NextRequest, context: any) => {
    // Type assertion for authenticated context
    const authContext = context as { user: { id: string }; userId: string };
    const body = await req.json();
    const validatedBody = validateCreateDocument(body);

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
      validatedBody.title,
      validatedBody.content,
      validatedBody.description,
      validatedBody.tags,
      validatedBody.is_public,
      validatedBody.allow_comments,
      validatedBody.allow_suggestions,
      validatedBody.require_approval,
      authContext.user.id,
    ];

    try {
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

      await pool.query(collaboratorQuery, [
        newDocument.id,
        authContext.user.id,
        "owner",
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
        newDocument.id,
        authContext.user.id,
        "edit",
        { action: "document_created" },
      ]);

      return createSuccessResponse(
        {
          document: newDocument,
          message: "Document created successfully",
        },
        201
      );
    } catch (error) {
      throw handleDatabaseError(error);
    }
  }
);
