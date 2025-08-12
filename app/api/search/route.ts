import { NextRequest } from "next/server";
import { pool } from "@/lib/database";
import {
  withAuthAppRouter,
  createPaginatedResponse,
  validateQueryParams,
  queryValidators,
} from "@/lib/api-middleware";
import { handleDatabaseError, validateString } from "@/lib/errors";
import { User } from "@/types/database";

// GET /api/search - Search documents with full-text search
export const GET = withAuthAppRouter(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (req: NextRequest, context: any) => {
    // Type assertion for authenticated context
    const authContext = context as { user: User; userId: string };
    const { searchParams } = new URL(req.url);

    // Validate query parameters
    const params = validateQueryParams(searchParams, ["q"], {
      limit: queryValidators.integer(1, 100),
      offset: queryValidators.integer(0),
      tags: queryValidators.array(","),
      public: queryValidators.boolean(),
    });

    const query = (params.q as string).trim();
    const limit = (params.limit as number) || 20;
    const offset = (params.offset as number) || 0;
    const tags = (params.tags as string[]) || [];
    const publicOnly = (params.public as boolean) || false;

    // Validate search query
    validateString(query, "query", 1, 200);

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
        OR (d.is_public = TRUE ${
          publicOnly
            ? ""
            : `OR EXISTS (
          SELECT 1 FROM document_collaborators 
          WHERE document_id = d.id AND user_id = $2 AND is_active = TRUE
        )`
        })
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
      ${
        tags.length > 0
          ? "AND EXISTS (SELECT 1 FROM unnest(d.tags) tag WHERE tag = ANY($6))"
          : ""
      }
      ${publicOnly ? "AND d.is_public = TRUE" : ""}
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
        OR (d.is_public = TRUE ${
          publicOnly
            ? ""
            : `OR EXISTS (
          SELECT 1 FROM document_collaborators 
          WHERE document_id = d.id AND user_id = $1 AND is_active = TRUE
        )`
        })
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
      ${
        tags.length > 0
          ? "AND EXISTS (SELECT 1 FROM unnest(d.tags) tag WHERE tag = ANY($5))"
          : ""
      }
      ${publicOnly ? "AND d.is_public = TRUE" : ""}
  `;

    const searchPattern = `%${query}%`;

    try {
      // Execute search query
      const searchResult = await pool.query(searchQuery, [
        query,
        authContext.user.id,
        searchPattern,
        limit,
        offset,
        tags.length > 0 ? tags : null,
      ]);

      // Execute count query
      const countResult = await pool.query(countQuery, [
        authContext.user.id,
        query,
        searchPattern,
        tags.length > 0 ? tags : null,
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

      await pool.query(analyticsQuery, [authContext.user.id, query, total]);

      return createPaginatedResponse(searchResult.rows, total, limit, offset, {
        query,
        tags: tags.length > 0 ? tags : undefined,
        publicOnly,
        message: `Found ${total} document${total === 1 ? "" : "s"}`,
      });
    } catch (error) {
      throw handleDatabaseError(error);
    }
  }
);
